# Netlify DAM Image Fix Playbook – Production Edition (PLUS)

**Goal:** Fix image loading in a Next.js + Netlify Blobs + Netlify Image CDN gallery (target: 2048‑wide display, JPG/WebP).  
**Format:** Staged execution with verification checkpoints, rollback procedures, and performance expectations.  
**Time:** ~60 minutes including tests.

> This is a “best‑of‑both‑worlds” version that keeps your staging/rollback rigor and adds a few critical guardrails: absolute CDN URLs, list‑API sanity checks, streaming serve, cache tagging, and optional `srcSet` for crisp lightbox images.

---

## ✅ Stage 0 – Critical Pre‑Flight Checks

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

- [ ] **Backup current working code**:
  ```bash
  git add -A && git commit -m "BACKUP: Before DAM image fix" || git stash push -m "BACKUP: Before DAM fix"
  ```

- [ ] **Verify prerequisites:**
  - Blob store name: **`property-assets`**
  - Gallery location: **`app/enhanced-gallery/page.tsx`** (or similar)
  - Keys include timestamps: e.g. `property_20250101123045_PICKED_img.jpg`
  - Expected gallery size: **_____ images** (fill in for performance planning)

> ⚠️ **STOP if the Image CDN test fails** – fix `netlify dev` and the Next plugin first.

---

## 🔧 Stage 1 – Netlify Configuration

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

# Optional headers (Images service usually sets its own; keep if you want)
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
pkill -f "netlify" || true
netlify dev

curl -I "http://localhost:8888/.netlify/images?url=http://localhost:8888/robots.txt&w=200"
# EXPECT: HTTP/1.1 200 OK
```

### 🔄 Rollback if Failed
```bash
git checkout -- netlify.toml
npm uninstall @netlify/plugin-nextjs
```

- [ ] Plugin installed  
- [ ] Server restarted via `netlify dev`  
- [ ] CDN test passes (200 OK)

---

## 🚀 Stage 2 – Serve Route (Streaming + Headers)

**Path:** `app/api/asset-handler/serve/route.ts`

### 2.1 Backup existing route
```bash
cp app/api/asset-handler/serve/route.ts app/api/asset-handler/serve/route.ts.backup
```

### 2.2 Replace with optimized version
```ts
import { NextRequest } from 'next/server'
import { getStore } from '@netlify/blobs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    
    if (!key) {
      return new Response(JSON.stringify({ error: 'Missing key' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      })
    }

    // Security: validate key format (adapt to your naming scheme)
    if (!/^[A-Za-z0-9._-]+$/.test(key)) {
      return new Response(JSON.stringify({ error: 'Invalid key format' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      })
    }

    const store = getStore('property-assets')

    // Single call with streaming to avoid buffering large files
    const { data, metadata } = await store.getWithMetadata(key, { type: 'stream' })
    if (!data) {
      return new Response(JSON.stringify({ error: 'Asset not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
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
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

### 🧪 Stage 2 Test
```bash
# Get a real key
KEY=$(curl -s "http://localhost:8888/api/asset-handler/list" | jq -r '.assets[0].key')
echo "Testing with key: $KEY"

# Direct serve
curl -I "http://localhost:8888/api/asset-handler/serve?key=$KEY"
# EXPECT: 200 OK and correct Content-Type

# Download mode
curl -I "http://localhost:8888/api/asset-handler/serve?key=$KEY&download=1" | grep -i content-disposition
# EXPECT: Content-Disposition: attachment
```

### 🔄 Rollback if Failed
```bash
mv app/api/asset-handler/serve/route.ts.backup app/api/asset-handler/serve/route.ts
```

- [ ] Serve route updated  
- [ ] Direct serve works  
- [ ] Correct `Content-Type`
- [ ] Download mode works

---

## 🧭 Stage 2.5 – List API Sanity (shape, order, paging)

**Why:** If `/api/asset-handler/list` doesn’t return what the gallery expects, nothing renders.

**Expectations:**
```json
{
  "assets": [
    { "key": "property_20250101123045_PICKED_img.jpg", "filename": "img.jpg" }
  ],
  "cursor": "opaqueOrNull"
}
```
- Keys contain a **14‑digit timestamp**; gallery sorts **descending**.
- Accept `?limit` (default 60) and optional `?cursor` for pagination.

### 🧪 Stage 2.5 Test
```bash
curl -s "http://localhost:8888/api/asset-handler/list?limit=5" | jq
# EXPECT: .assets[].key present, sorted newest→oldest; cursor is present or null
```

- [ ] List response matches expectations

---

## 🌐 Stage 3 – Origin Helper (absolute URLs)

**Path:** `app/utils/getOrigin.ts`
```ts
import { headers } from 'next/headers'

export function getOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin
  try {
    const h = headers()
    const proto = h.get('x-forwarded-proto') ?? 'https'
    const host  = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:8888'
    return process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`
  } catch {
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8888'
  }
}

export function getClientOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8888'
}
```

> **Tip:** set **NEXT_PUBLIC_SITE_URL** on Netlify to your site URL so SSR fallbacks stay correct in previews.

- [ ] File created; no TS errors

---

## 🖼️ Stage 4 – Gallery Component (Critical)

### 4.1 Pre‑change verification
```bash
echo "Next/Image imports found:"
grep -r "from 'next/image'" app/ | wc -l
echo "Plain img tags found:"
grep -r "<img" app/ | wc -l
```

### 4.2 Remove Next/Image
```ts
// ❌ REMOVE
import Image from 'next/image'
// ❌ Replace any <Image> with <img>
```

### 4.3 Build absolute URLs (client)
```ts
import { getClientOrigin } from '@/app/utils/getOrigin'

const origin = getClientOrigin()
const serve  = `${origin}/api/asset-handler/serve?key=${encodeURIComponent(key)}`

const thumbUrl  = `/.netlify/images?url=${encodeURIComponent(serve)}&w=400&h=400&fit=cover&q=75&fm=webp`
const mediumUrl = `/.netlify/images?url=${encodeURIComponent(serve)}&w=1024&q=85&fm=webp`
const largeUrl  = `/.netlify/images?url=${encodeURIComponent(serve)}&w=2048&q=90&fm=webp`

const originalUrl = serve // fallback
```

### 4.4 Use `<img>` with correct fallback
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

### 4.5 Reset state on change
```ts
useEffect(() => {
  setImageLoaded(false); setImageError(false)
}, [photo.key])
```

### 4.6 Lightbox uses large (with fallback)
```tsx
<img
  src={selectedPhoto.largeUrl || selectedPhoto.mediumUrl}
  alt={selectedPhoto.filename || selectedPhoto.key}
  style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }}
  decoding="async"
  fetchpriority="high"
  onError={(e) => { (e.currentTarget as HTMLImageElement).src = selectedPhoto.originalUrl }}
/>
```

### 4.7 (Optional) Lightbox `srcSet` for crisp HiDPI
```tsx
<img
  src={selectedPhoto.largeUrl}
  srcSet={`${selectedPhoto.mediumUrl} 1024w, ${selectedPhoto.largeUrl} 2048w`}
  sizes="100vw"
  alt={selectedPhoto.filename || selectedPhoto.key}
  style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }}
  decoding="async"
  fetchpriority="high"
  onError={(e) => { (e.currentTarget as HTMLImageElement).src = selectedPhoto.originalUrl }}
/>
```

### 🧪 Stage 4 Test
```bash
echo "Next/Image imports remaining (SHOULD BE 0):"
grep -r "from 'next/image'" app/ | wc -l || echo "0"

open "http://localhost:8888/enhanced-gallery"
# EXPECT:
# - Thumbs load
# - Network shows /.netlify/images requests
# - url= contains ABSOLUTE URLs (http://localhost:8888/...)
```

- [ ] Next/Image removed (0)  
- [ ] `<img>` with fallback in place  
- [ ] Images visible; CDN requests show absolute `url=`

---

## 🔗 Stage 5 – Fix Navigation Links

```tsx
// In app/page.tsx or navigation
// Find:
href="/photos"
// Replace with:
href="/enhanced-gallery"
```

### 🧪 Stage 5 Test
```bash
grep -n "href.*photos" app/ || true
open "http://localhost:8888"
```

- [ ] Links updated; navigation works

---

## 🎯 Stage 6 – Integration & Production‑like Test

### 6.1 Full restart
```bash
pkill -f "netlify" || true
netlify dev
```

### 6.2 Performance Benchmarks (in browser console)
```js
console.time('ImageLoad');
Promise.all(
  Array.from(document.querySelectorAll('img')).map(img =>
    img.complete ? Promise.resolve() : new Promise(r => img.onload = r)
  )
).then(() => console.timeEnd('ImageLoad'));
```

### 6.3 Memory Check (optional)
```js
if (performance.memory) {
  console.log('Memory used:', Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB');
}
```

### 6.4 Production‑like local test
```bash
npm run build
# Run built app behind Netlify dev so Images still work
netlify dev -c "next start"
open "http://localhost:8888/enhanced-gallery"
```

### 6.5 CDN Self‑Check (one real key)
```bash
KEY="YOUR_ACTUAL_KEY"
URL="http://localhost:8888/api/asset-handler/serve?key=$KEY"
ENCODED=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$URL")
open "http://localhost:8888/.netlify/images?url=$ENCODED&w=400&h=400&fit=cover&q=75&fm=webp"
```

- [ ] Initial page load acceptable  
- [ ] Lightbox 2048px loads  
- [ ] All CDN URLs absolute  
- [ ] No console errors

---

## 🧯 Emergency Rollback

```bash
# If you stashed at start
git stash pop

# If you committed
git reset --hard HEAD~1

# Manual recovery
mv app/api/asset-handler/serve/route.ts.backup app/api/asset-handler/serve/route.ts || true
git checkout -- app/enhanced-gallery/ app/utils/ netlify.toml

pkill -f "netlify" || true
netlify dev
```

---

## 📦 Next Steps (post‑fix hardening)

- Ensure uploads set **contentType**:
  ```ts
  await store.set(key, file, {
    metadata: { contentType: file.type, size: file.size, uploadedAt: Date.now() }
  })
  ```
- Add **group cache tags** (e.g., `Netlify-Cache-Tag: "key,album:xyz"`), so you can purge whole albums.
- Implement **pagination/virtualization** for galleries > 500 images.
- Consider **auth/signed URLs** for private DAMs.

---

## 📊 Final Status Report

```markdown
### Implementation Checklist
- [ ] Stage 0: Pre-flight & backup (5 min)
- [ ] Stage 1: Netlify config (10 min)
- [ ] Stage 2: Serve route (10 min)
- [ ] Stage 2.5: List API sanity (5 min)
- [ ] Stage 3: Origin helper (5 min)
- [ ] Stage 4: Gallery component (20 min) ⚠️ CRITICAL
- [ ] Stage 5: Fix links (2 min)
- [ ] Stage 6: Integration test (10 min)

### Performance Metrics
- Initial page load: _____ s
- Time to first image: _____ s
- Total images loaded: _____
- Memory usage: _____ MB
- Network requests: _____
- Failed requests: _____ (should be 0)

### Known Issues to Address Later
- [ ] Pagination for > 500 images
- [ ] Loading skeletons
- [ ] Virtual scrolling for huge sets
- [ ] Image preloading for next page
```
