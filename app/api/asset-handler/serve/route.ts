// app/api/asset-handler/serve/route.ts
import { getStore } from '@netlify/blobs'
import { NextRequest, NextResponse } from 'next/server'

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
    const store = getStore('images')
    const blob = await store.get(key)
    
    if (!blob) {
      console.error(`❌ Blob not found: ${key}`)
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    console.log(`✅ Blob found: ${key}`)

    // Convert blob to buffer for processing
    let buffer: Buffer
    
    // Handle different blob types
    try {
      // Cast to any to handle various blob types
      const blobData = blob as any
      
      if (blobData instanceof ArrayBuffer) {
        buffer = Buffer.from(blobData)
      } else if (blobData instanceof Uint8Array) {
        buffer = Buffer.from(blobData)
      } else if (blobData && typeof blobData.arrayBuffer === 'function') {
        // For ReadableStream or Blob types
        const arrayBuffer = await blobData.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
      } else if (Buffer.isBuffer(blobData)) {
        buffer = blobData
      } else {
        // Last resort: try to convert directly
        buffer = Buffer.from(blobData)
      }
    } catch (conversionError) {
      console.error('Failed to convert blob to buffer:', conversionError)
      throw new Error('Failed to process image data')
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
    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(buffer)
    const response = new NextResponse(uint8Array, {
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