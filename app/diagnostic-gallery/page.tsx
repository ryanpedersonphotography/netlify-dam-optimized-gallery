'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface BlobImage {
  key: string
  url: string
  thumbUrl: string
  netlifyCdnUrl?: string
}

export default function DiagnosticGallery() {
  const [images, setImages] = useState<BlobImage[]>([])
  const [loading, setLoading] = useState(true)
  const [debugInfo, setDebugInfo] = useState<any>({})

  useEffect(() => {
    async function fetchAndDebug() {
      try {
        console.log('🔍 Fetching images...')
        
        // Test the list endpoint
        const listResponse = await fetch('/api/asset-handler/list?prefix=2025')
        const listData = await listResponse.json()
        
        console.log('📋 List Response:', listData)
        console.log('📊 Assets found:', listData.assets?.length || 0)
        
        if (!listData.assets || listData.assets.length === 0) {
          setDebugInfo({ 
            error: 'No assets returned from list API',
            response: listData 
          })
          return
        }

        // Test a single serve endpoint
        const firstAsset = listData.assets[0]
        const testServeUrl = `/api/asset-handler/serve?key=${firstAsset.key}`
        
        console.log('🧪 Testing serve URL:', testServeUrl)
        
        const serveResponse = await fetch(testServeUrl, { method: 'HEAD' })
        console.log('📡 Serve response status:', serveResponse.status)
        console.log('📡 Serve response headers:', Object.fromEntries(serveResponse.headers.entries()))
        
        // Generate image objects with multiple URL strategies
        const imageUrls = listData.assets.slice(0, 12).map((asset: any) => ({
          key: asset.key,
          url: `/api/asset-handler/serve?key=${asset.key}`,
          thumbUrl: `/api/asset-handler/serve?key=${asset.key}&size=thumb`,
          // Try Netlify Image CDN direct URLs
          netlifyCdnUrl: `/.netlify/images?url=${encodeURIComponent(`/api/asset-handler/serve?key=${asset.key}`)}&w=300&h=300&fit=cover`
        }))
        
        setImages(imageUrls)
        setDebugInfo({
          totalAssets: listData.assets.length,
          firstAsset: listData.assets[0],
          serveStatus: serveResponse.status,
          origin: typeof window !== 'undefined' ? window.location.origin : 'server-side'
        })
        
      } catch (error) {
        console.error('❌ Fetch error:', error)
        setDebugInfo({ error: error instanceof Error ? error.message : String(error) })
      } finally {
        setLoading(false)
      }
    }

    fetchAndDebug()
  }, [])

  if (loading) {
    return <div className="p-8 text-center">Loading and debugging...</div>
  }

  return (
    <div className="p-8">
      {/* Debug Info */}
      <div className="mb-8 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-xl font-bold mb-4">🐛 Debug Information</h2>
        <pre className="text-sm overflow-x-auto">
          {JSON.stringify(debugInfo, null, 2)}
        </pre>
      </div>

      {/* URL Testing */}
      <div className="mb-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">🔗 URL Testing</h3>
        {images.slice(0, 2).map((image, idx) => (
          <div key={idx} className="mb-4 p-2 border rounded">
            <p className="font-mono text-sm mb-2">Key: {image.key}</p>
            
            {/* Test different URL strategies */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Strategy 1: Direct serve */}
              <div className="text-center">
                <p className="text-xs mb-2">Direct serve</p>
                <img 
                  src={image.thumbUrl} 
                  alt="Direct serve test"
                  className="w-24 h-24 object-cover mx-auto border"
                  onLoad={() => console.log('✅ Direct serve loaded:', image.key)}
                  onError={(e) => console.log('❌ Direct serve failed:', image.key, e)}
                />
                <p className="text-xs mt-1 break-all">{image.thumbUrl}</p>
              </div>
              
              {/* Strategy 2: Next.js Image */}
              <div className="text-center">
                <p className="text-xs mb-2">Next.js Image</p>
                <div className="relative w-24 h-24 mx-auto border">
                  <Image
                    src={image.thumbUrl}
                    alt="Next.js test"
                    fill
                    className="object-cover"
                    onLoad={() => console.log('✅ Next.js Image loaded:', image.key)}
                    onError={(e) => console.log('❌ Next.js Image failed:', image.key)}
                  />
                </div>
              </div>
              
              {/* Strategy 3: Netlify CDN */}
              <div className="text-center">
                <p className="text-xs mb-2">Netlify CDN</p>
                <img 
                  src={image.netlifyCdnUrl} 
                  alt="Netlify CDN test"
                  className="w-24 h-24 object-cover mx-auto border"
                  onLoad={() => console.log('✅ Netlify CDN loaded:', image.key)}
                  onError={(e) => console.log('❌ Netlify CDN failed:', image.key, e)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {images.map((image, index) => (
          <div key={image.key} className="relative aspect-square border rounded overflow-hidden">
            <Image
              src={image.thumbUrl}
              alt={image.key}
              fill
              className="object-cover"
              onLoad={() => console.log(`✅ Gallery image ${index} loaded:`, image.key)}
              onError={() => console.log(`❌ Gallery image ${index} failed:`, image.key)}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1">
              Index: {index} | Key: {image.key.slice(-8)}
            </div>
          </div>
        ))}
      </div>

      {debugInfo.error && (
        <div className="mt-8 p-4 bg-red-100 border border-red-300 rounded">
          <h3 className="text-red-800 font-semibold">Error:</h3>
          <p className="text-red-700">{debugInfo.error}</p>
        </div>
      )}
    </div>
  )
}