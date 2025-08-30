// app/api/asset-handler/serve/route.ts
import { getStore } from '@netlify/blobs'
import { NextRequest, NextResponse } from 'next/server'

const store = getStore('images')

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  const size = searchParams.get('size')

  if (!key) {
    console.error('❌ No key provided')
    return NextResponse.json({ error: 'Key parameter is required' }, { status: 400 })
  }

  try {
    console.log(`🔍 Fetching blob: ${key} (size: ${size})`)
    
    // Get the blob from Netlify Blobs
    const blob = await store.get(key)
    
    if (!blob) {
      console.error(`❌ Blob not found: ${key}`)
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    console.log(`✅ Blob found: ${key}, type: ${blob.constructor.name}`)

    // Convert blob to buffer for processing
    let buffer: Buffer
    if (blob instanceof ArrayBuffer) {
      buffer = Buffer.from(blob)
    } else if (blob instanceof Uint8Array) {
      buffer = Buffer.from(blob)
    } else {
      // For ReadableStream or other types
      const arrayBuffer = await blob.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    }

    console.log(`📊 Buffer size: ${buffer.length} bytes`)

    // Determine content type
    const contentType = getContentType(key, buffer)
    
    // For thumbnail requests, we'll serve the original for now
    // You can implement resizing later using sharp or similar
    if (size === 'thumb') {
      console.log(`📸 Serving thumbnail for: ${key}`)
    }

    // Create response with proper headers
    const response = new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': `"${key}"`,
      },
    })

    return response

  } catch (error) {
    console.error(`❌ Error serving ${key}:`, error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function getContentType(key: string, buffer: Buffer): string {
  const ext = key.toLowerCase().split('.').pop()
  
  // Check file signature for more reliable detection
  if (buffer.length >= 2) {
    const signature = buffer.subarray(0, 4)
    
    // JPEG
    if (signature[0] === 0xFF && signature[1] === 0xD8) {
      return 'image/jpeg'
    }
    
    // PNG
    if (signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47) {
      return 'image/png'
    }
    
    // WebP
    if (signature.toString().includes('WEBP')) {
      return 'image/webp'
    }
  }
  
  // Fallback to extension-based detection
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      return 'application/octet-stream'
  }
}