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