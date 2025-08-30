import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'

export async function GET() {
  try {
    const tagStore = getStore('asset-metadata')
    const { blobs } = await tagStore.list({ prefix: 'tags:' })
    
    // Count occurrences of each tag
    const tagCount: Record<string, number> = {}
    
    for (const blob of blobs) {
      const tags = await tagStore.get(blob.key, { type: 'json' }) || []
      for (const tag of tags) {
        tagCount[tag] = (tagCount[tag] || 0) + 1
      }
    }
    
    const tags = Object.entries(tagCount).map(([name, count]) => ({
      name,
      count
    }))

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Error getting all tags:', error)
    return NextResponse.json({ error: 'Failed to get tags' }, { status: 500 })
  }
}