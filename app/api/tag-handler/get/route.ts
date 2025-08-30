import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@netlify/blobs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')
    
    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 })
    }

    const tagStore = getStore('asset-metadata')
    const tagKey = `tags:${key}`
    const tags = await tagStore.get(tagKey, { type: 'json' }) || []

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Error getting tags:', error)
    return NextResponse.json({ error: 'Failed to get tags' }, { status: 500 })
  }
}