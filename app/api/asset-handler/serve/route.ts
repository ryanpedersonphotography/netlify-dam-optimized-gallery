import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'
import sharp from 'sharp'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    const size = searchParams.get('size')
    const quality = Math.min(100, Math.max(1, parseInt(searchParams.get('quality') || '75')))
    const format = searchParams.get('format') || 'webp'
    
    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 })
    }

    console.log('Serving asset with key:', key)

    // Get asset from blob store
    const assetStore = getStore('property-assets')
    const blob = await assetStore.get(key, { type: 'blob' })
    
    if (!blob) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Convert blob to buffer for sharp
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Process image with sharp
    let sharpInstance = sharp(buffer)
    
    // Resize based on size parameter
    if (size === 'thumb') {
      sharpInstance = sharpInstance.resize(400, 400, { 
        fit: 'cover',
        position: 'center'
      })
    } else if (size === 'medium') {
      sharpInstance = sharpInstance.resize(1024, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
    } else if (size === 'large') {
      sharpInstance = sharpInstance.resize(2048, null, {
        fit: 'inside',
        withoutEnlargement: true
      })
    }

    // Convert to specified format with quality
    let outputBuffer: Buffer
    let contentType: string
    
    if (format === 'webp') {
      outputBuffer = await sharpInstance.webp({ quality }).toBuffer()
      contentType = 'image/webp'
    } else if (format === 'jpeg' || format === 'jpg') {
      outputBuffer = await sharpInstance.jpeg({ quality }).toBuffer()
      contentType = 'image/jpeg'
    } else if (format === 'png') {
      outputBuffer = await sharpInstance.png({ quality }).toBuffer()
      contentType = 'image/png'
    } else {
      // Default to original format
      outputBuffer = await sharpInstance.toBuffer()
      contentType = 'image/jpeg'
    }
    
    // Set cache headers based on size
    const cacheTime = size === 'thumb' ? '31536000' : '86400'
    
    return new NextResponse(outputBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': outputBuffer.length.toString(),
        'Cache-Control': `public, max-age=${cacheTime}, immutable`,
        'X-Content-Type-Options': 'nosniff',
        'ETag': `${key}-${size}-${format}-${quality}`,
        'Vary': 'Accept-Encoding'
      }
    })
  } catch (error) {
    console.error('Error serving asset:', error)
    return NextResponse.json({ error: 'Failed to serve asset' }, { status: 500 })
  }
}