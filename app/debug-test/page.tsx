'use client'

import { useEffect, useState } from 'react'

interface DebugInfo {
  timestamp: string
  message: string
  data?: any
}

interface BlobImage {
  key: string
  url: string
  thumbUrl: string
  etag?: string
}

export default function DebugTest() {
  const [images, setImages] = useState<BlobImage[]>([])
  const [loading, setLoading] = useState(true)
  const [debugLogs, setDebugLogs] = useState<DebugInfo[]>([])
  const [imageLoadStatus, setImageLoadStatus] = useState<Record<string, string>>({})

  const addDebugLog = (message: string, data?: any) => {
    const log: DebugInfo = {
      timestamp: new Date().toISOString(),
      message,
      data
    }
    console.log(`[DEBUG] ${message}`, data || '')
    setDebugLogs(prev => [...prev, log])
  }

  useEffect(() => {
    async function fetchImages() {
      addDebugLog('Starting image fetch...')
      
      try {
        addDebugLog('Calling /api/asset-handler/list with prefix=2025')
        const response = await fetch('/api/asset-handler/list?prefix=2025')
        
        addDebugLog('Response received', {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        })
        
        const data = await response.json()
        addDebugLog('Response JSON parsed', {
          totalAssets: data.assets?.length || 0,
          firstFewKeys: data.assets?.slice(0, 5).map((a: any) => a.key)
        })
        
        // Take first 2 images
        const firstTwo = data.assets?.slice(0, 2) || []
        addDebugLog('Selected first 2 assets', firstTwo)
        
        const imageUrls = firstTwo.map((asset: any) => ({
          key: asset.key,
          etag: asset.etag,
          url: `/api/asset-handler/serve?key=${asset.key}`,
          thumbUrl: `/api/asset-handler/serve?key=${asset.key}&size=thumb`
        }))
        
        addDebugLog('Generated image URLs', imageUrls)
        setImages(imageUrls)
        
        // Pre-fetch images to check if they load
        for (const img of imageUrls) {
          addDebugLog(`Pre-fetching image: ${img.key}`)
          try {
            const imgResponse = await fetch(img.url)
            addDebugLog(`Image fetch result for ${img.key}`, {
              status: imgResponse.status,
              contentType: imgResponse.headers.get('content-type'),
              contentLength: imgResponse.headers.get('content-length'),
              cacheControl: imgResponse.headers.get('cache-control'),
              etag: imgResponse.headers.get('etag')
            })
          } catch (err) {
            addDebugLog(`Failed to pre-fetch ${img.key}`, err)
          }
        }
        
      } catch (error) {
        addDebugLog('Error during fetch', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        })
      } finally {
        setLoading(false)
        addDebugLog('Fetch complete')
      }
    }

    fetchImages()
  }, [])

  const handleImageLoad = (key: string) => {
    addDebugLog(`Image loaded successfully: ${key}`)
    setImageLoadStatus(prev => ({ ...prev, [key]: 'loaded' }))
  }

  const handleImageError = (key: string, event: any) => {
    addDebugLog(`Image load error: ${key}`, {
      error: 'Failed to load',
      src: event.target?.src
    })
    setImageLoadStatus(prev => ({ ...prev, [key]: 'error' }))
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Debug Test - 2 Images</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Images Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Images</h2>
          
          {loading && <p className="text-gray-600">Loading images...</p>}
          
          {!loading && images.length === 0 && (
            <p className="text-red-600">No images found!</p>
          )}
          
          <div className="space-y-4">
            {images.map((image) => (
              <div key={image.key} className="border rounded-lg p-4 bg-gray-50">
                <div className="mb-2">
                  <p className="text-sm font-mono break-all">{image.key}</p>
                  <p className="text-xs text-gray-500">ETag: {image.etag}</p>
                  <p className="text-xs text-gray-500">Status: {imageLoadStatus[image.key] || 'loading'}</p>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Full Image:</p>
                    <img 
                      src={image.url}
                      alt={`Full: ${image.key}`}
                      className="w-full h-48 object-cover border"
                      onLoad={() => handleImageLoad(image.key)}
                      onError={(e) => handleImageError(image.key, e)}
                    />
                    <p className="text-xs text-gray-400 mt-1 break-all">{image.url}</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Thumbnail:</p>
                    <img 
                      src={image.thumbUrl}
                      alt={`Thumb: ${image.key}`}
                      className="w-32 h-32 object-cover border"
                      onLoad={() => addDebugLog(`Thumbnail loaded: ${image.key}`)}
                      onError={() => addDebugLog(`Thumbnail error: ${image.key}`)}
                    />
                    <p className="text-xs text-gray-400 mt-1 break-all">{image.thumbUrl}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Debug Logs Section */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Debug Logs</h2>
          <div className="bg-black text-green-400 p-4 rounded-lg h-96 overflow-y-auto font-mono text-xs">
            {debugLogs.map((log, index) => (
              <div key={index} className="mb-2">
                <div className="text-gray-400">[{log.timestamp}]</div>
                <div>{log.message}</div>
                {log.data && (
                  <pre className="text-yellow-300 ml-4">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Page Info */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold mb-2">Page Info</h3>
        <p className="text-sm">URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
        <p className="text-sm">User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</p>
        <p className="text-sm">Images Found: {images.length}</p>
        <p className="text-sm">Loading: {loading ? 'Yes' : 'No'}</p>
      </div>
    </div>
  )
}