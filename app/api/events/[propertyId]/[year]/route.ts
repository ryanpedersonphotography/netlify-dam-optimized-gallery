import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string; year: string }> }
) {
  try {
    const { propertyId, year } = await params
    
    if (!propertyId || !year) {
      return NextResponse.json(
        { error: 'Property ID and year are required' }, 
        { status: 400 }
      )
    }
    
    // Get Netlify Blobs store
    const assetStore = getStore('property-assets')
    
    // List all blobs with prefix for this property and year
    const prefix = `parties/${year}/${propertyId}/`
    const { blobs } = await assetStore.list({ prefix })
    
    // Process blob data to create asset list
    const assets = await Promise.all(
      blobs.map(async (blob) => {
        const metadata = await assetStore.getMetadata(blob.key)
        const filename = blob.key.split('/').pop() || blob.key
        
        // Determine if it's a top pick based on path or metadata
        const isTopPick = blob.key.includes('/top/') || (metadata as any)?.topPick === true
        
        return {
          id: blob.key,
          key: blob.key,
          filename,
          url: `/api/photos/image?key=${encodeURIComponent(blob.key)}`,
          thumbnailUrl: `/api/photos/image?key=${encodeURIComponent(blob.key)}&w=400`,
          downloadUrl: `/api/photos/image?key=${encodeURIComponent(blob.key)}`,
          metadata: {
            ...(metadata as any),
            topPick: isTopPick,
            rating: (metadata as any)?.rating || 0,
            tags: (metadata as any)?.tags || [],
            captureTime: (metadata as any)?.captureTime || null,
            width: (metadata as any)?.width,
            height: (metadata as any)?.height
          }
        }
      })
    )
    
    // Separate top picks and all photos
    const topPicks = assets.filter(a => a.metadata.topPick)
    const allPhotos = assets
    
    return NextResponse.json({ 
      assets: allPhotos,
      topPicks,
      total: assets.length,
      propertyId,
      year
    })
    
  } catch (error) {
    console.error('Error loading event assets:', error)
    return NextResponse.json(
      { error: 'Failed to load event assets' }, 
      { status: 500 }
    )
  }
}