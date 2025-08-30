# Netlify DAM Image Fix Playbook — **Repo + Production Ultimate Edition**

**Repo:** `ryanpedersonphotography/netlify-dam-optimized-gallery`  
**Live:** `https://solhem-digital-assets.netlify.app`  
**Goal:** Make **/enhanced-gallery** reliably render thumbnails and a 2048‑wide lightbox using **Netlify Blobs** (originals) + **Netlify Image CDN** (transforms).  
**Format:** Staged execution with verification checkpoints, rollback steps, and performance targets.  
**Time:** ~60 minutes, including tests.

> This merges your latest Production Edition + my repo‑tailored guide, and bakes in the real file structure (App Router with `app/`, `middleware.ts`, `netlify.toml`). It focuses ONLY on the gallery + serving path.

---

## ✅ Stage 0 — Critical Pre‑Flight (Local & Prod)

**Local must use Netlify dev** (Images don’t work on `next dev`):

```bash
# ❌ WRONG
next dev

# ✅ REQUIRED (wires /.netlify/images locally at :8888)
netlify dev
```

**Local Images sanity (MUST be 200 OK):**
```bash
open "http://localhost:8888/.netlify/images?url=$(node -e 'console.log(encodeURIComponent(\"http://localhost:8888/robots.txt\"))')&w=200"
```

**Production Images sanity (MUST be 200 OK):**
```bash
open "https://solhem-digital-assets.netlify.app/.netlify/images?url=$(node -e 'console.log(encodeURIComponent(\"https://solhem-digital-assets.netlify.app/robots.txt\"))')&w=200"
```

**Create a rollback point (one‑liner):**
```bash
git add -A && git commit -m "BACKUP: Before DAM image fix" || git stash push -m "BACKUP: Before DAM fix"
```

**Prereqs (check once):**
- Blobs store: **`property-assets`**
- Gallery route: **`/enhanced-gallery`**
- Keys contain 14‑digit timestamp (e.g., `property_20250101123045_PICKED_img.jpg`)
- Optional but recommended env var: **`NEXT_PUBLIC_SITE_URL=https://solhem-digital-assets.netlify.app`**

> ⚠️ If either Images sanity check 404s, **stop** and do Stage 1 first.

---

## 🔧 Stage 1 — Netlify Wiring (Plugin + Dev Proxy)

**File:** `netlify.toml`

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

# Optional headers (Images usually provide their own; safe to keep)
[[headers]]
  for = "/.netlify/images/*"
  [headers.values]
    Cache-Control = "public, max-age=604800"

[[headers]]
  for = "/api/asset-handler/serve"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

Install/ensure plugin & verify Images endpoint:
```bash
npm i -D @netlify/plugin-nextjs
pkill -f "netlify" || true
netlify dev
curl -I "http://localhost:8888/.netlify/images?url=http://localhost:8888/robots.txt&w=200"  # expect 200
```

**Rollback if this breaks:**
```bash
git checkout -- netlify.toml
npm uninstall @netlify/plugin-nextjs
```

---

## 🚧 Stage 1.5 — Middleware Exclusion (Repo‑Specific)

**File:** `middleware.ts`  
Exclude Netlify Images and the serve route from any catch‑all matcher so rewrites/auth don’t intercept them.

```ts
export const config = {
  matcher: [
    // exclude Next internals, static, Netlify Images, and the serve endpoint
    '/((?!_next/|static/|\\.netlify/images|api/asset-handler/serve|favicon.ico|robots.txt|sitemap\\.xml).*)',
  ],
}
```

> If you already have a matcher, ensure it includes `\\.netlify/images` and `api/asset-handler/serve` exclusions.

---

## 🚀 Stage 2 — Serve Route (Stream + CDN Cache Headers)

**File:** `app/api/asset-handler/serve/route.ts`

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

    // Optional: tighten your naming scheme
    if (!/^[A-Za-z0-9._-]+$/.test(key)) {
      return new Response(JSON.stringify({ error: 'Invalid key format' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      })
    }

    const store = getStore('property-assets')
    const { data, metadata } = await store.getWithMetadata(key, { type: 'stream' })
    if (!data) {
      return new Response(JSON.stringify({ error: 'Asset not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      })
    }

    const contentType = (metadata as any)?.contentType || 'application/octet-stream'

    const headers: HeadersInit = {
      'Content-Type': contentType,
      // Browser cache (safe with versioned keys)
      'Cache-Control': 'public, max-age=31536000, immutable',
      // Edge cache + surgical purge
      'Netlify-CDN-Cache-Control': 'public, s-maxage=31536000, immutable',
      'Netlify-Cache-Tag': key,
      'X-Content-Type-Options': 'nosniff',
    }

    if (searchParams.get('download') === '1') {
      const filename = key.split('/').pop() || 'download'
      headers['Content-Disposition'] = `attachment; filename="${filename}"`
    }

    return new Response(data as unknown as ReadableStream, { status: 200, headers })
  } catch (error) {
    console.error('Serve error:', error)
    return new Response(JSON.stringify({ error: 'Failed to serve asset' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

**Test (local):**
```bash
KEY=$(curl -s "http://localhost:8888/api/asset-handler/list" | jq -r '.assets[0].key')
curl -I "http://localhost:8888/api/asset-handler/serve?key=$KEY"         # 200 + correct Content-Type
curl -I "http://localhost:8888/api/asset-handler/serve?key=$KEY&download=1" | grep -i content-disposition
```

**Rollback:**
```bash
git checkout -- app/api/asset-handler/serve/route.ts
```

---

## 🧭 Stage 2.5 — List API Sanity (Shape, Order, Paging)

**File:** `app/api/asset-handler/list/route.ts`

Expected response:
```json
{
  "assets": [
    { "key": "property_20250101123045_PICKED_img.jpg", "filename": "img.jpg" }
  ],
  "cursor": "opaqueOrNull"
}
```
- Keys contain a **14‑digit timestamp**; gallery sorts **newest → oldest**.  
- Support `?limit` (default 60) + optional `?cursor` for pagination.

**Test:**
```bash
curl -s "http://localhost:8888/api/asset-handler/list?limit=5" | jq
```

> If shape differs, adjust the gallery mapping (only `key` is strictly required).

---

## 🌐 Stage 3 — Origin Helpers (Absolute CDN URLs)

**File:** `app/utils/getOrigin.ts`

```ts
import { headers } from 'next/headers'

export function getOrigin(): string {
  // SSR-safe
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

> In Netlify env, set **`NEXT_PUBLIC_SITE_URL=https://solhem-digital-assets.netlify.app`** so SSR fallbacks are always correct across previews.

---

## 🖼️ Stage 4 — Gallery Component (CRITICAL)

**Files likely involved:**
- `app/enhanced-gallery/page.tsx` (page)
- one or more components under `components/`

### 4.1 Remove `next/image` (or mark `unoptimized`) — prefer `<img>`
```ts
// ❌ REMOVE
import Image from 'next/image'
// ✅ Replace <Image .../> with <img .../>
```

### 4.2 Build absolute CDN URLs (+ fallback)
```ts
import { getClientOrigin } from '@/app/utils/getOrigin' // adjust path if needed

const origin = getClientOrigin()
const serve  = `${origin}/api/asset-handler/serve?key=${encodeURIComponent(key)}`

const thumbUrl  = `/.netlify/images?url=${encodeURIComponent(serve)}&w=400&h=400&fit=cover&q=75&fm=webp`
const mediumUrl = `/.netlify/images?url=${encodeURIComponent(serve)}&w=1024&q=85&fm=webp`
const largeUrl  = `/.netlify/images?url=${encodeURIComponent(serve)}&w=2048&q=90&fm=webp`

const originalUrl = serve
```

### 4.3 Use `<img>` with a correct fallback (no global `event`)
```tsx
<img
  src={photo.thumbUrl}
  alt={photo.filename || photo.key}
  loading="lazy"
  decoding="async"
  style={{
    width: '100%',
    height: 'auto',
    aspectRatio: '1/1',
    objectFit: 'cover',
    opacity: imageLoaded ? 1 : 0,
    transition: 'opacity 0.25s ease'
  }}
  onLoad={() => setImageLoaded(true)}
  onError={(e) => {
    setImageError(true)
    ;(e.currentTarget as HTMLImageElement).src = photo.originalUrl
  }}
/>
```

Reset flags when the photo changes:
```ts
useEffect(() => { setImageLoaded(false); setImageError(false) }, [photo.key])
```

### 4.4 Lightbox: use `largeUrl` with fallback (+ optional `srcSet`)
```tsx
// Simple
<img
  src={selectedPhoto.largeUrl || selectedPhoto.mediumUrl}
  alt={selectedPhoto.filename || selectedPhoto.key}
  style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }}
  decoding="async"
  fetchpriority="high"
  onError={(e) => { (e.currentTarget as HTMLImageElement).src = selectedPhoto.originalUrl }}
/>

// Optional: crisp on HiDPI
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

### 4.5 Optional Dev Fallback (if someone runs `next dev`)
```ts
const isNetlifyDev = typeof window !== 'undefined' && location.port === '8888'
const displayThumb = isNetlifyDev ? thumbUrl : originalUrl
```

**Tests (local):**
```bash
grep -r "from 'next/image'" app/ || true  # should be empty
open "http://localhost:8888/enhanced-gallery"

# In DevTools → Network (Images filter):
# - requests to /.netlify/images?url=…
# - inner url= is ABSOLUTE (http/https://…/api/asset-handler/serve?key=…)
```

---

## 🔗 Stage 5 — Navigation Sanity

**File:** `app/page.tsx` (or your nav component)  
Ensure links point to **`/enhanced-gallery`** (not `/photos` or an outdated path).

```bash
grep -Rin "href=.*photos" app/ || true
```

---

## 🎯 Stage 6 — Integration & Production‑Like Tests

**Local full restart:**
```bash
pkill -f "netlify" || true
netlify dev
```

**Performance Benchmarks (run in browser console on the gallery page):**
```js
console.time('ImageLoad');
Promise.all(
  Array.from(document.querySelectorAll('img')).map(img =>
    img.complete ? Promise.resolve() : new Promise(r => img.onload = r)
  )
).then(() => console.timeEnd('ImageLoad'));
```

**Memory Check (optional):**
```js
if (performance.memory) {
  console.log('Memory used:', Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB');
}
```

**Production‑like local test (built app behind Netlify dev so Images still work):**
```bash
npm run build
netlify dev -c "next start"
open "http://localhost:8888/enhanced-gallery"
```

**CDN self‑check with a real key (local):**
```bash
KEY=$(curl -s "http://localhost:8888/api/asset-handler/list" | jq -r '.assets[0].key')
URL="http://localhost:8888/api/asset-handler/serve?key=$KEY"
ENCODED=$(node -e "console.log(encodeURIComponent(process.argv[1]))" "$URL")
open "http://localhost:8888/.netlify/images?url=$ENCODED&w=400&h=400&fit=cover&q=75&fm=webp"
```

**Production checks (live domain):**
- Open **/enhanced-gallery** and watch DevTools → Network → *Img*:
  - `/.netlify/images?url=…` present
  - inner `url=` is **absolute** (`https://solhem-digital-assets.netlify.app/api/asset-handler/serve?key=…`)
  - responses are **200 OK**

---

## 🧯 Emergency Rollback

```bash
# If you stashed at start
git stash pop || true

# If you committed
git reset --hard HEAD~1 || true

# Manual restore for key files
git checkout -- app/api/asset-handler/serve/route.ts app/enhanced-gallery/ app/utils/ middleware.ts netlify.toml
pkill -f "netlify" || true
netlify dev
```

---

## 📦 Post‑Fix Hardening

- **Store `contentType` on upload** so the serve route returns correct headers:
  ```ts
  await store.set(key, file, {
    metadata: { contentType: file.type, size: file.size, uploadedAt: Date.now() }
  })
  ```
- **Group cache tags**: e.g., `Netlify-Cache-Tag: "key,album:<id>"` to purge whole albums.
- **Pagination / virtualization** for libraries > 500 images.
- **Auth** / short‑TTL signed tokens for private DAMs.

---

## 📊 Final Status Report

```markdown
### Implementation Checklist
- [ ] Stage 0: Pre‑flight & backup
- [ ] Stage 1: Netlify config + plugin
- [ ] Stage 1.5: Middleware excludes images + serve
- [ ] Stage 2: Serve route (stream + CDN cache headers)
- [ ] Stage 2.5: List API shape/order/paging
- [ ] Stage 3: Origin helpers (SSR + client)
- [ ] Stage 4: Gallery <img> + absolute CDN URLs + fallback
- [ ] Stage 5: Navigation sanity
- [ ] Stage 6: Integration + prod‑like tests
```

### Performance Targets
| Gallery Size | Initial Load | Scroll Perf |
| --- | --- | --- |
| < 100 images | < 2s | 60fps |
| 100–500 | 2–4s | Smooth w/ lazy load |
| 500–1000 | 4–6s | Add pagination |
| > 1000 | Paginate/virtualize | Required |

**Success means:**
- `netlify dev` on :8888
- No `next/image` in the gallery
- Network shows `/.netlify/images` with **absolute** `url=`
- Thumbs load; lightbox shows 2048‑wide
- Fallback to original works if CDN 404s
- No console errors
