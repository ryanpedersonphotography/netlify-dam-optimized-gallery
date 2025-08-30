import { NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const prefix = url.searchParams.get('prefix') || ''
    
    const assetStore = getStore('property-assets')
    const { blobs } = await assetStore.list({ prefix })
    
    const assets = blobs.map(blob => ({
      key: blob.key,
      etag: blob.etag
    }))

    return NextResponse.json({ assets })
  } catch (error) {
    console.error('Error listing assets:', error)
    return NextResponse.json({ error: 'Failed to list assets' }, { status: 500 })
  }
}