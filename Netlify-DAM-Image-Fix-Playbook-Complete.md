# Netlify DAM Image Fix Playbook — Complete Edition (Best‑of‑Both Worlds)

**Goal:** Fix image loading in a Next.js + Netlify Blobs + Netlify Image CDN gallery (2048‑wide display, JPG/WebP).  
**Format:** Staged execution with verification checkpoints so Claude Code can apply changes in chunks.  
**Time:** ~60 minutes including tests.

---

## ✅ Stage 0 — Critical Pre‑Flight Checks

**Must verify before ANY code changes:**

- [ ] **Run the correct dev server** (Image CDN won’t work under `next dev`):
  ```bash
  # ❌ WRONG
  next dev

  # ✅ CORRECT (required for /.netlify/images locally)
  netlify dev
  ```

- [ ] **Test that Image CDN is wired**:
  ```bash
  # This MUST return 200 (a tiny transformed response), not 404
  open "http://localhost:8888/.netlify/images?url=$(node -e 'console.log(encodeURIComponent("http://localhost:8888/robots.txt"))')&w=200"
  ```

- [ ] **Blob store name:** `property-assets`  
- [ ] **Gallery location:** e.g. `app/enhanced-gallery/page.tsx` (or similar)  
- [ ] **Keys include timestamps:** e.g. `property_20250101123045_PICKED_img.jpg`

> ⚠️ **STOP if the Image CDN test fails** — fix `netlify dev` and the Next plugin first.

---

## 🔧 Stage 1 — Netlify Configuration

### 1.1 Update `netlify.toml`
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[dev]
  command = "next dev"
  port = 8888
  targetPort = 3000

# Optional: headers. Images service usually sets its own; keep if you want.
[[headers]]
  for = "/.netlify/images/*"
  [headers.values]
    Cache-Control = "public, max-age=604800"

[[headers]]
  for = "/api/asset-handler/serve"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### 1.2 Install plugin
```bash
npm install --save-dev @netlify/plugin-nextjs
```

### 🧪 Stage 1 Test
```bash
# Restart local
pkill -f "netlify" || true
netlify dev

# Verify CDN endpoint
curl -I "http://localhost:8888/.netlify/images?url=http://localhost:8888/robots.txt&w=200"
# EXPECT: HTTP/1.1 200 OK
```

- [ ] Plugin installed  
- [ ] Server restarted via `netlify dev`  
- [ ] CDN test passes (200 OK)

---

## 🚀 Stage 2 — Serve Route (Streaming + Headers)

**Path:** `app/api/asset-handler/serve/route.ts`

Replace or update to:

```ts
import { NextRequest } from 'next/server'
import { getStore } from '@netlify/blobs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    
    if (!key) {
      return new Response(JSON.stringify({ error: 'Missing key' }), {
        status: 400, 
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Security: validate key format (adapt to your naming scheme)
    if (!/^[A-Za-z0-9._-]+$/.test(key)) {
      return new Response(JSON.stringify({ error: 'Invalid key format' }), {
        status: 400, 
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const store = getStore('property-assets')
    
    // Single call with streaming to avoid buffering large files
    const { data, metadata } = await store.getWithMetadata(key, { type: 'stream' })
    if (!data) {
      return new Response(JSON.stringify({ error: 'Asset not found' }), {
        status: 404, 
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const contentType = (metadata as any)?.contentType || 'application/octet-stream'
    
    // Optional: support downloads
    const headers: HeadersInit = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Netlify-CDN-Cache-Control': 'public, s-maxage=31536000, immutable',
      'Netlify-Cache-Tag': key, // Enable surgical cache purging
      'X-Content-Type-Options': 'nosniff',
    }
    if (searchParams.get('download') === '1') {
      const filename = key.split('/').pop() || 'download'
      headers['Content-Disposition'] = `attachment; filename="${filename}"`
    }

    return new Response(data as unknown as ReadableStream, {
      status: 200,
      headers
    })
  } catch (error) {
    console.error('Serve error:', error)
    return new Response(JSON.stringify({ error: 'Failed to serve asset' }), {
      status: 500, 
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

### 🧪 Stage 2 Test
```bash
# Get a real key from your list API
curl -s "http://localhost:8888/api/asset-handler/list" | jq '.assets[0].key'

# Test direct serve (replace YOUR_KEY)
curl -I "http://localhost:8888/api/asset-handler/serve?key=YOUR_KEY"
# EXPECT: 200 OK and a correct Content-Type

# Test download mode
open "http://localhost:8888/api/asset-handler/serve?key=YOUR_KEY&download=1"
# EXPECT: File downloads
```

- [ ] Serve route updated  
- [ ] Direct serve works  
- [ ] Correct `Content-Type`

---

## 🌐 Stage 3 — Origin Helper (absolute URLs)

**Why:** Netlify Image CDN requires an **absolute** inner URL (`url=`).

**Path:** `app/utils/getOrigin.ts`
```ts
import { headers } from 'next/headers'

export function getOrigin(): string {
  // Client-side
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  
  // Server-side
  try {
    const headersList = headers()
    const proto = headersList.get('x-forwarded-proto') ?? 'https'
    const host  = headersList.get('x-forwarded-host') ?? headersList.get('host') ?? 'localhost:8888'
    return process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`
  } catch {
    // Build-time fallback
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8888'
  }
}

// Client-only helper (if you need it in client components)
export function getClientOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8888'
}
```

- [ ] File created  
- [ ] No import errors

---

## 🖼️ Stage 4 — Gallery Component (Critical)

**Why:** `next/image` conflicts with Netlify Image CDN URLs. Use plain `<img>` or set `unoptimized`. We’ll use `<img>`.

### 4.1 Remove Next/Image
```ts
// ❌ REMOVE
import Image from 'next/image'
// ❌ Replace any <Image> usage with <img>
```

### 4.2 Build absolute URLs
```ts
import { getClientOrigin } from '@/app/utils/getOrigin'

const origin = getClientOrigin()
const serve = `${origin}/api/asset-handler/serve?key=${encodeURIComponent(key)}`

const thumbUrl  = `/.netlify/images?url=${encodeURIComponent(serve)}&w=400&h=400&fit=cover&q=75&fm=webp`
const mediumUrl = `/.netlify/images?url=${encodeURIComponent(serve)}&w=1024&q=85&fm=webp`
const largeUrl  = `/.netlify/images?url=${encodeURIComponent(serve)}&w=2048&q=90&fm=webp`

const originalUrl = serve // for fallback
```

### 4.3 Use plain `<img>` and correct `onError`
```tsx
<img
  src={photo.thumbUrl}
  alt={photo.filename || photo.key}
  loading="lazy"
  decoding="async"
  className="gallery-image"
  style={{
    width: '100%',
    height: 'auto',
    aspectRatio: '1/1',
    objectFit: 'cover',
    opacity: imageLoaded ? 1 : 0,
    transition: 'opacity 0.3s ease'
  }}
  onLoad={() => setImageLoaded(true)}
  onError={(e) => {
    setImageError(true)
    ;(e.currentTarget as HTMLImageElement).src = photo.originalUrl
  }}
/>
```

### 4.4 Reset state on photo change
```ts
useEffect(() => {
  setImageLoaded(false)
  setImageError(false)
}, [photo.key])
```

### 4.5 Lightbox uses `largeUrl` (fallback to original)
```tsx
<img
  src={selectedPhoto.largeUrl || selectedPhoto.mediumUrl}
  alt={selectedPhoto.filename || selectedPhoto.key}
  style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }}
  decoding="async"
  fetchpriority="high"
  onError={(e) => {
    (e.currentTarget as HTMLImageElement).src = selectedPhoto.originalUrl
  }}
/>
```

### 🧪 Stage 4 Test
```bash
# Verify no Next/Image imports remain
grep -r "from 'next/image'" app/ || true

# Open the gallery
open "http://localhost:8888/enhanced-gallery"
# EXPECT:
# - Images load
# - Network shows /.netlify/images requests
# - url= contains ABSOLUTE URLs (http://localhost:8888/...)
```

- [ ] Next/Image removed  
- [ ] `<img>` in place with fallback  
- [ ] Images visible in gallery  
- [ ] Network shows CDN requests w/ absolute `url=`

---

## 🔗 Stage 5 — Fix Navigation Links

**Path:** `app/page.tsx` (or wherever your link is)
```tsx
// Find any stale links like:
href="/photos"

// Replace with your actual gallery route:
href="/enhanced-gallery"
```

### 🧪 Stage 5 Test
```bash
grep -n "href.*photos" app/page.tsx || true
open "http://localhost:8888"
# Click your gallery link, ensure it navigates correctly
```

- [ ] Links updated  
- [ ] Navigation works

---

## 🎯 Stage 6 — Integration & Production‑like Test

### 6.1 Full restart
```bash
pkill -f "netlify" || true
netlify dev
```

### 6.2 Manual QA
- **Gallery Grid**
  - [ ] Thumbnails load (400×400)
  - [ ] Lazy loading works (scroll)
  - [ ] Loading state visible, fade in on load
- **Lightbox**
  - [ ] Clicking thumb opens lightbox
  - [ ] Large image (2048 wide) loads
  - [ ] Close works
- **Network**
  - [ ] `/.netlify/images?url=...` requests present
  - [ ] `url=` is ABSOLUTE (`http://localhost:8888/...`)
  - [ ] Responses 200 OK
- **Fallback**
  - [ ] Block one CDN request in DevTools → fallback switches to `originalUrl`

### 6.3 Production‑like local test
```bash
# Build for production
npm run build

# Run the built app behind Netlify dev (so Images still work)
netlify dev -c "next start"
open "http://localhost:8888/enhanced-gallery"
```

> Alternative: deploy to a preview and test on the Netlify URL.

---

## 🧯 Stage 7 — Optional Dev Fallback (if someone runs `next dev`)

```ts
const isNetlifyDev = typeof window !== 'undefined' && location.port === '8888'
const displayThumb = isNetlifyDev ? thumbUrl : thumbUrl  // keep CDN in `netlify dev`
/*
  If you *really* want to bypass CDN during `next dev`, you can use:
  const displayThumb = isNetlifyDev ? thumbUrl : originalUrl
  But recommended path is: always use `netlify dev`
*/
```

(Prefer sticking with `netlify dev` so transforms always work.)

---

## 📦 Stage 8 — Upload Metadata & Purging (Next Steps)

- **Ensure uploads set content type** (so serve route returns correct header):
  ```ts
  await store.set(key, file, {
    metadata: { contentType: file.type, size: file.size, uploadedAt: Date.now() }
  })
  ```
- **Purge strategy**: because you set `Netlify-Cache-Tag: key`, you can purge a single asset or group (e.g., also tag `album:<id>`).
- **Pagination**: implement `limit` + `cursor` in the list API and incremental fetch in the gallery for very large libraries.
- **Auth**: if assets are private, add auth or signed, short‑TTL tokens checked in the serve route.

---

## 🧪 Troubleshooting Commands

```bash
# Check the current origin (sanity)
node -e "console.log('http://localhost:8888')"

# Test a specific image through the CDN
KEY="YOUR_ACTUAL_KEY"
URL="http://localhost:8888/api/asset-handler/serve?key=$KEY"
ENCODED=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$URL")
open "http://localhost:8888/.netlify/images?url=$ENCODED&w=400&h=400&fit=cover&q=75&fm=webp"

# List keys (confirm real data is flowing)
curl -s "http://localhost:8888/api/asset-handler/list" | jq '.assets[].key'

# Check blob metadata/headers quickly
curl -sI "http://localhost:8888/api/asset-handler/serve?key=$KEY" | grep -iE 'content-type|cache-control|netlify'
```

---

## 📊 Progress Summary

```markdown
### Implementation Status
- [ ] Stage 0: Pre-flight checks (5 min)
- [ ] Stage 1: Netlify config (10 min)
- [ ] Stage 2: Serve route (10 min)
- [ ] Stage 3: Origin helper (5 min)
- [ ] Stage 4: Gallery component (20 min) ⚠️ CRITICAL
- [ ] Stage 5: Fix links (2 min)
- [ ] Stage 6: Integration test (10 min)
- [ ] Stage 7: Dev fallback (optional)
- [ ] Stage 8: Upload metadata & purge (optional)
```

### 🎯 Success Indicators
- `netlify dev` running on port 8888  
- No `next/image` imports in the gallery  
- Network tab shows `/.netlify/images` with **absolute** `url=` params  
- Images load without console errors  
- Lightbox shows high‑res images (2048px)  
- Fallback to original works when a CDN request fails
