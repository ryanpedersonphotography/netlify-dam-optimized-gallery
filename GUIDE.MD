# Netlify DAM Image Loading Fix Guide

## 🎯 Overview
Fix image loading issues in the Netlify Digital Asset Management system by addressing Next/Image conflicts, routing issues, and Netlify configuration problems.

## 📋 Pre-Flight Checklist
- [ ] Stop any running `next dev` processes
- [ ] Ensure you have `netlify-cli` installed (`npm install -g netlify-cli`)
- [ ] Have access to modify `netlify.toml`, routes, and components

---

## Stage 1: Critical Next/Image Fix 🚨
**Issue:** Next/Image is fighting with Netlify Image CDN, causing double optimization and broken images.

### 1.1 Update EnhancedEventGallery.tsx

**Find and remove Next/Image import:**
```typescript
// REMOVE THIS LINE:
import Image from 'next/image'
```

**Replace ALL Next/Image components with plain img tags:**

```typescript
// FIND patterns like this:
<Image
  src={photo.thumbUrl}
  alt={photo.key}
  width={400}
  height={400}
  className="gallery-image"
  onLoad={() => setImageLoaded(true)}
  onError={() => setImageError(true)}
/>

// REPLACE with:
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
    // Fallback to direct serve URL
    (e.currentTarget as HTMLImageElement).src = photo.url
  }}
/>
```

### 1.2 Update Lightbox Images

```typescript
// In the lightbox/modal section, replace Next/Image:
<img
  src={selectedPhoto.largeUrl || selectedPhoto.mediumUrl}
  alt={selectedPhoto.filename || selectedPhoto.key}
  style={{
    maxWidth: '100%',
    maxHeight: '90vh',
    objectFit: 'contain'
  }}
  onError={(e) => {
    (e.currentTarget as HTMLImageElement).src = selectedPhoto.url
  }}
/>
```

### 1.3 Add State Reset on Photo Change

```typescript
// Add this useEffect to PhotoCard component:
useEffect(() => {
  setImageLoaded(false)
  setImageError(false)
}, [photo.key])
```

### ✅ Stage 1 Verification
```bash
# Check that no Next/Image imports remain
grep -r "from 'next/image'" app/
# Should return nothing

# Verify img tags are in place
grep -r "<img" app/enhanced-gallery/
# Should show multiple results
```

---

## Stage 2: Fix Netlify Configuration 🔧

### 2.1 Update netlify.toml

**Replace entire netlify.toml with:**
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

[[headers]]
  for = "/.netlify/images/*"
  [headers.values]
    Cache-Control = "public, max-age=604800"

[[headers]]
  for = "/api/asset-handler/serve"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

### 2.2 Install Netlify Plugin

```bash
npm install --save-dev @netlify/plugin-nextjs
```

### ✅ Stage 2 Verification
```bash
# Verify plugin is installed
npm list @netlify/plugin-nextjs

# Start Netlify dev server
netlify dev

# Should see output like:
# ◈ Netlify Dev ◈
# ◈ Injected build settings from netlify.toml
# ◈ Loaded function api-handler
# ◈ Functions server is listening on 9999
# ◈ Starting Netlify Dev with Next.js
```

---

## Stage 3: Fix URL Generation 🌐

### 3.1 Create URL Helper

**Create `app/utils/getOrigin.ts`:**
```typescript
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
    const host = headersList.get('x-forwarded-host') ?? 
                 headersList.get('host') ?? 
                 'localhost:8888'
    
    // Netlify environment variables (in order of preference)
    return process.env.URL || 
           process.env.DEPLOY_PRIME_URL || 
           process.env.NEXT_PUBLIC_SITE_URL || 
           `${proto}://${host}`
  } catch {
    // Fallback for build time
    return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8888'
  }
}

// Client-only version for gallery component
export function getClientOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin
  }
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:8888'
}
```

### 3.2 Update Gallery URL Construction

**In `app/enhanced-gallery/page.tsx` or component file:**

```typescript
import { getClientOrigin } from '@/app/utils/getOrigin'

// Inside fetchPhotos function:
const origin = getClientOrigin()
const serve = `${origin}/api/asset-handler/serve?key=${encodeURIComponent(key)}`

// Build CDN URLs with absolute paths
const thumbUrl = `/.netlify/images?url=${encodeURIComponent(serve)}&w=400&h=400&fit=cover&q=75&fm=webp`
const mediumUrl = `/.netlify/images?url=${encodeURIComponent(serve)}&w=1024&q=85&fm=webp`
const largeUrl = `/.netlify/images?url=${encodeURIComponent(serve)}&w=2048&q=90&fm=webp`
```

### ✅ Stage 3 Verification
```bash
# Test origin helper is working
curl http://localhost:8888/api/asset-handler/list
# Should return JSON with assets

# Verify absolute URLs in browser console:
# Open http://localhost:8888/enhanced-gallery
# In DevTools Console:
console.log(window.location.origin)
# Should show: http://localhost:8888
```

---

## Stage 4: Fix Serve Route 🚀

### 4.1 Update Serve Route

**Update `/app/api/asset-handler/serve/route.ts`:**

```typescript
import { NextRequest } from 'next/server'
import { getStore } from '@netlify/blobs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    
    if (!key) {
      return new Response(
        JSON.stringify({ error: 'Missing key parameter' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    // Security: validate key format
    if (!/^[A-Za-z0-9._-]+$/.test(key)) {
      return new Response(
        JSON.stringify({ error: 'Invalid key format' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const store = getStore('property-assets')
    
    // Use single call with streaming
    const { data, metadata } = await store.getWithMetadata(key, { 
      type: 'stream' 
    })
    
    if (!data) {
      return new Response(
        JSON.stringify({ error: 'Asset not found' }), 
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const contentType = (metadata as any)?.contentType || 'application/octet-stream'

    return new Response(data as unknown as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=31536000, immutable',
        'Netlify-Cache-Tag': key,
        'X-Content-Type-Options': 'nosniff',
      }
    })
  } catch (error) {
    console.error('Serve error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to serve asset' }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
```

### ✅ Stage 4 Verification
```bash
# Get a real key from your list endpoint
curl http://localhost:8888/api/asset-handler/list | jq '.assets[0].key'

# Test direct serve (replace YOUR_KEY with actual key)
curl -I "http://localhost:8888/api/asset-handler/serve?key=YOUR_KEY"
# Should return 200 with Content-Type header

# Test CDN transform (replace YOUR_KEY)
curl -I "http://localhost:8888/.netlify/images?url=http%3A%2F%2Flocalhost%3A8888%2Fapi%2Fasset-handler%2Fserve%3Fkey%3DYOUR_KEY&w=400&h=400&fit=cover&q=75&fm=webp"
# Should return 200
```

---

## Stage 5: Fix Route Links 🔗

### 5.1 Update Home Page Links

**In `/app/page.tsx`:**

```typescript
// Find:
href="/photos"

// Replace with:
href="/enhanced-gallery"
```

### ✅ Stage 5 Verification
```bash
# Verify link is correct
grep -n "href.*photos" app/page.tsx
# Should return nothing

grep -n "href.*enhanced-gallery" app/page.tsx
# Should show the corrected link
```

---

## Stage 6: Final Integration Test 🎉

### 6.1 Full System Test

1. **Stop everything and restart:**
```bash
# Kill any running processes
pkill -f "next dev"
pkill -f "netlify"

# Start fresh
netlify dev
```

2. **Open browser to:** http://localhost:8888/enhanced-gallery

3. **Check Network tab:**
   - Look for requests to `/.netlify/images?url=...`
   - Verify they return 200 status
   - Check that `url=` parameter contains absolute URLs

4. **Test image loading:**
   - Images should appear with fade-in effect
   - Click an image to open lightbox
   - Verify large image loads

5. **Test fallback:**
   - Temporarily break a CDN URL in DevTools
   - Verify image falls back to direct serve route

### 6.2 Production Build Test

```bash
# Build for production
npm run build

# Test production build locally
netlify serve
```

### ✅ Final Verification Checklist
- [ ] Images load in gallery grid
- [ ] Lightbox shows full-size images
- [ ] No Next/Image import warnings in console
- [ ] Network tab shows CDN URLs with absolute paths
- [ ] Fallback to direct serve works on error
- [ ] No 404s for image resources
- [ ] Loading states show while images fetch
- [ ] Images fade in smoothly when loaded

---

## 🚨 Troubleshooting

### If images still don't load:

1. **Check Console for errors:**
```javascript
// In browser console
console.log('Current origin:', window.location.origin)
// Should be: http://localhost:8888

// Find first image and check its src
document.querySelector('img').src
// Should start with: /.netlify/images?url=http...
```

2. **Verify blob exists:**
```bash
# List all blobs
curl http://localhost:8888/api/asset-handler/list | jq '.assets[].key'
```

3. **Test individual components:**
```bash
# Test serve route with a known key
curl "http://localhost:8888/api/asset-handler/serve?key=KNOWN_KEY" -o test.jpg

# Test CDN with encoded URL
node -e "console.log(encodeURIComponent('http://localhost:8888/api/asset-handler/serve?key=KNOWN_KEY'))"
# Use output in: http://localhost:8888/.netlify/images?url=OUTPUT&w=400
```

### Common Issues:
- **"Cannot find module '@netlify/plugin-nextjs'"** → Run `npm install`
- **Port 8888 already in use** → Kill existing process or change port in netlify.toml
- **Images 404 but URLs look correct** → Ensure `netlify dev` not `next dev`
- **CORS errors** → Add origin to serve route headers if needed

---

## 📊 Progress Tracking

After each stage, mark complete:

```markdown
## Implementation Progress
- [x] Stage 1: Remove Next/Image (20 min)
- [x] Stage 2: Fix Netlify Config (10 min)
- [x] Stage 3: Fix URL Generation (15 min)
- [x] Stage 4: Fix Serve Route (10 min)
- [x] Stage 5: Fix Route Links (5 min)
- [x] Stage 6: Integration Test (15 min)

Total Time: ~75 minutes
```

## 🎯 Success Criteria

You'll know it's working when:
1. Gallery loads images without Next/Image optimization
2. Netlify Image CDN handles resizing (check Network tab for `/.netlify/images` requests)
3. No console errors about missing images
4. Lightbox shows full-resolution images
5. Performance is good (lazy loading works, images cached)

---

**Next Steps After Fix:**
1. Add pagination to list API for large collections
2. Implement cache purging strategy using Netlify-Cache-Tag
3. Add authentication if needed for private assets
4. Consider adding download tracking/analytics