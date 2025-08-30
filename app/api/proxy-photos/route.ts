import { NextResponse } from 'next/server'

// Simple in-memory cache
let cachedData: any = null
let cacheTime: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function GET() {
  try {
    // Check if we have cached data that's still fresh
    if (cachedData && Date.now() - cacheTime < CACHE_DURATION) {
      return NextResponse.json(cachedData, {
        headers: {
          'X-Cache': 'HIT',
          'Cache-Control': 'private, max-age=300'
        }
      })
    }

    const response = await fetch('https://solhem-digital-assets.netlify.app/api/asset-handler/list')
    const data = await response.json()
    
    // Cache the data
    cachedData = data
    cacheTime = Date.now()
    
    return NextResponse.json(data, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'private, max-age=300'
      }
    })
  } catch (error) {
    console.error('Error fetching photos:', error)
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
  }
}