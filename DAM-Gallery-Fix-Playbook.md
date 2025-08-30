# Netlify Blobs DAM — Gallery Fix Playbook (Staged, With Checkpoints)

> Goal: **Get the photo gallery working** (images load reliably) using **Next.js + Netlify Blobs + Netlify Image CDN**.  
> Scope: You already have a DAM — this focuses **only** on the gallery + serve path.  
> Style: Step-by-step, with **progress checkboxes** ✅ and **“stop here & test”** breaks so Claude Code can tackle it in chunks.

---

## ✅ Stage 0 — Pre‑flight & Assumptions

- [ ] You run locally with **Netlify dev** (Image CDN only works through Netlify’s dev server):  
  ```zsh
  netlify dev
  ```

- [ ] You have a **Netlify site** connected, and production deploys use Netlify (so `process.env.URL` is available).

- [ ] Blobs store name: **`property-assets`**.

- [ ] Gallery page component file exists: e.g. `app/enhanced-gallery/page.tsx` (or equivalent).

- [ ] Your list route (e.g. `app/api/asset-handler/list/route.ts`) returns items with **`key`** values that include a **14‑digit timestamp** (e.g. `YYYYMMDDHHmmss`) and optionally include `PICKED` in the key to mark status.

**Test:** If you’ve never tested the Image CDN locally, run:  
```zsh
open "http://localhost:8888/.netlify/images?url=$(node -e 'console.log(encodeURIComponent("http://localhost:8888/robots.txt"))')&w=200"
```
You should see a tiny transformed response (proves the `.netlify/images` path is wired).

---

## 🧩 Stage 1 — Netlify wiring for local & prod

**Why:** Without the Next plugin + Netlify dev, `/.netlify/images` won’t work locally.

1) **`netlify.toml` (ensure plugin + dev proxy):**
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
```

- [ ] Save the file above (or merge into your existing `netlify.toml`).
- [ ] Restart local dev: `netlify dev`

**Stop & Test:**  
- [ ] Visit `http://localhost:8888/.netlify/images?url=http%3A%2F%2Flocalhost%3A8888%2Frobots.txt&w=200` — should not 404.

---

## 🧵 Stage 2 — Serve Route: stream + 1 call + CDN cache headers

**Why:** Streaming avoids buffering big files; proper headers allow Netlify to cache/purge.

**Path:** `app/api/asset-handler/serve/route.ts`

> Replace the contents with this (or adapt your current route):

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

    // Optional: lock down acceptable characters for your naming scheme
    // if (!/^[A-Za-z0-9._-]+$/.test(key)) return new Response('Bad key', { status: 400 })

    const store = getStore('property-assets')
    const { data, metadata } = await store.getWithMetadata(key, { type: 'stream' })
    if (!data) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      })
    }

    const contentType = (metadata as any)?.contentType ?? 'application/octet-stream'

    return new Response(data as unknown as ReadableStream, {
      headers: {
        'Content-Type': contentType,
        // Browser cache — safe with versioned keys
        'Cache-Control': 'public, max-age=31536000, immutable',
        // Netlify CDN cache — lets you purge by tag
        'Netlify-CDN-Cache-Control': 'public, s-maxage=31536000, immutable',
        'Netlify-Cache-Tag': key,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('serve error', err)
    return new Response(JSON.stringify({ error: 'Failed to serve asset' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }
}
```

**Stop & Test:**  
- [ ] Pick one real key and hit the route directly:  
  ```zsh
  open "http://localhost:8888/api/asset-handler/serve?key=<PUT_A_REAL_KEY_HERE>"
  ```
  You should see the **binary** image and a **correct Content-Type** in the Network panel.

---

## 🌐 Stage 3 — Absolute origin helper (works on server & client)

**Why:** Netlify Image CDN needs **absolute** URLs in `url=` param. Relative breaks in prod and often in dev.

**Path:** `app/lib/getOrigin.ts` (new file)

```ts
import { headers } from 'next/headers'

export function getOrigin() {
  if (typeof window !== 'undefined') return window.location.origin
  const h = headers()
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const host  = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  return process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.NEXT_PUBLIC_SITE_URL || `${proto}://${host}`
}
```

- [ ] Save file.
- [ ] No test needed yet — we use it in Stage 4.

---

## 🖼️ Stage 4 — Gallery component: use `<img>`, fix onError, build absolute CDN URLs

**Why:** `next/image` conflicts with Netlify Image CDN URLs. Use plain `<img>` or set `unoptimized`. We’ll use `<img>`.

**Path:** your gallery component (e.g. `app/enhanced-gallery/page.tsx` or `EnhancedEventGallery.tsx`).

### 4A) Build URLs
```ts
import { getOrigin } from '@/app/lib/getOrigin' // adjust import path

// ...inside your mapping over assets:
const origin = getOrigin()
const serve = `${origin}/api/asset-handler/serve?key=${encodeURIComponent(key)}`

// Choose your sizes (thumb, medium, large). You asked for ~2048 wide for display:
const thumbUrl  = `/.netlify/images?url=${encodeURIComponent(serve)}&w=400&h=400&fit=cover&q=75&fm=webp`
const mediumUrl = `/.netlify/images?url=${encodeURIComponent(serve)}&w=1024&q=85&fm=webp`
const largeUrl  = `/.netlify/images?url=${encodeURIComponent(serve)}&w=2048&q=90&fm=webp`
```

### 4B) Use plain `<img>` and correct onError
```tsx
<img
  src={photo.thumbUrl}
  alt={photo.filename ?? photo.key}
  loading="lazy"
  decoding="async"
  onLoad={() => setImageLoaded(true)}
  onError={(e) => {
    setImageError(true)
    ;(e.currentTarget as HTMLImageElement).src = photo.url // fallback: direct serve
  }}
  style={{ opacity: imageLoaded ? 1 : 0, aspectRatio: '1 / 1', objectFit: 'cover', width: '100%', height: 'auto' }}
/>
```

Also reset flags when the photo key changes:
```ts
useEffect(() => { setImageLoaded(false); setImageError(false) }, [photo.key])
```

### 4C) Lightbox should use `largeUrl` with fallback
```tsx
<img
  src={selectedPhoto.largeUrl || selectedPhoto.mediumUrl}
  alt={selectedPhoto.filename ?? selectedPhoto.key}
  decoding="async"
  fetchpriority="high"
  onError={(e) => { (e.currentTarget as HTMLImageElement).src = selectedPhoto.url }}
/>
```

**Stop & Test:**  
- [ ] Run `netlify dev`  
- [ ] Open the gallery page.  
- [ ] In DevTools → Network, click one thumbnail request. Confirm it hits `/.netlify/images?url=https://.../api/asset-handler/serve?...&w=400...` (note: **absolute** URL inside the `url=` param).  
- [ ] Images should now render. If a CDN request 404s, copy that URL here and check that its `url=` is absolute and the inner **serve URL** works by itself in a new tab.

---

## 🧾 Stage 5 — List route sanity (keys, order, paging)

**Why:** If `list` doesn’t return the keys your UI expects, you’ll “render nothing” forever.

**Expectations for `/api/asset-handler/list` response**:
```json
{
  "assets": [
    { "key": "property_20250101123045_PICKED_img123.jpg", "filename": "img123.jpg" },
    { "key": "property_20241231115959_unpicked_img999.jpg", "filename": "img999.jpg" }
  ],
  "cursor": "opaqueCursorOrNull"
}
```

- **Sort:** newest first (descending by the 14-digit timestamp in the key).
- **Paginate:** accept `?limit=` (default 60) and optional `?cursor=`.

**Stop & Test:**  
```zsh
curl -s "http://localhost:8888/api/asset-handler/list?limit=5" | jq
```
- [ ] Confirm you see **real keys** with timestamps.  
- [ ] Confirm the keys match what your gallery uses.

> If your route currently returns a different shape, adjust the mapping in the gallery to read the fields you return (only `key` is truly required).

---

## 🧯 Stage 6 — Optional Dev Fallback (bypass CDN)

If you want thumbs to show even when someone accidentally runs `next dev`, you can switch to direct `serve`:

```ts
const isNetlifyDev = typeof window !== 'undefined' && location.port === '8888'
const displayThumb = isNetlifyDev ? serve : thumbUrl
```

Use `displayThumb` in the `<img src=...>`

---

## 🚀 Stage 7 — Upload metadata & download support

**Upload / write:** Always store `contentType` (and optionally `size`, `timestamp`):
```ts
await store.set(key, file, {
  metadata: { contentType: file.type, size: file.size, timestamp: Date.now() }
})
```
This guarantees the serve route returns the **correct `Content-Type`** for CDN transforms.

**Add download:** support `?download=1` in the serve route:
```ts
if (searchParams.get('download') === '1') {
  headers['Content-Disposition'] = `attachment; filename="${safeFilename}"`
}
```

---

## 🧪 Stage 8 — Troubleshooting Matrix

- **Thumb 404s** → Open its URL. Is `url=` **absolute**? Does the inner **serve URL** load by itself? Are you running `netlify dev`?
- **Everything blank** → Are you still using `next/image` without `unoptimized`? Switch to `<img>` as above.
- **Wrong colors or broken transforms** → Check your serve `Content-Type`. If it defaults to `image/jpeg` for PNG/WebP, set metadata at upload.
- **Prod works / local fails** → You’re likely running `next dev`. Use `netlify dev`.
- **Large libraries load slow** → Implement paging: fetch 60 at a time; use IntersectionObserver to request the next `cursor` batch.

---

## 🧭 Progress Tracker (tick as you/Claude complete)

- [ ] Stage 1: Netlify wiring (plugin + `netlify dev`)
- [ ] Stage 2: Serve route streaming + headers
- [ ] Stage 3: Origin helper saved
- [ ] Stage 4: Gallery `<img>` swap + absolute CDN URLs + onError fix + lightbox
- [ ] Stage 5: List route yields good keys (desc order, paging)
- [ ] Stage 6: Optional dev fallback
- [ ] Stage 7: Upload metadata + optional download
- [ ] Stage 8: Troubleshooting passes

---

## 💻 Quick Commands (zsh)

```zsh
# install deps (if needed)
npm i

# run through Netlify (required for /.netlify/images locally)
netlify dev

# direct serve test (replace key)
open "http://localhost:8888/api/asset-handler/serve?key=<REAL_KEY>"

# CDN transform test (same key)
open "http://localhost:8888/.netlify/images?url=$(node -e 'console.log(encodeURIComponent("http://localhost:8888/api/asset-handler/serve?key=<REAL_KEY>"))')&w=400&h=400&fit=cover&q=75&fm=webp"
```
