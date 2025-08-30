import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const prefix = searchParams.get('prefix') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200) // Max 200 per request
    
    // Get store inside the function to avoid build-time initialization
    const assetStore = getStore('property-assets')
    
    // List all blobs with prefix (simple approach that works)
    const { blobs } = await assetStore.list({ prefix })
    
    // Paginate the results in memory
    const startIdx = (page - 1) * limit
    const endIdx = startIdx + limit
    const pageBlobs = blobs.slice(startIdx, endIdx)
    
    const assets = pageBlobs.map(blob => ({
      key: blob.key,
      etag: blob.etag,
      filename: blob.key.split('_').pop() || blob.key
    }))
    
    // Determine if there are more items
    const hasMore = blobs.length > endIdx
    const nextCursor = hasMore && pageBlobs.length > 0 ? pageBlobs[pageBlobs.length - 1].key : null

    return NextResponse.json({ 
      assets,
      pagination: {
        page,
        limit,
        hasMore,
        nextCursor,
        total: blobs.length // Total count of all matching blobs
      }
    })
  } catch (error) {
    console.error('Error listing assets:', error)
    return NextResponse.json({ error: 'Failed to list assets' }, { status: 500 })
  }
}