'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface BlobImage {
  key: string
  url: string
  thumbUrl: string
}

export default function TestGallery() {
  const [images, setImages] = useState<BlobImage[]>([])
  const [loading, setLoading] = useState(true)
  const [displayCount, setDisplayCount] = useState(24) // Start with 24 images

  useEffect(() => {
    async function fetchImages() {
      try {
        const response = await fetch('/api/asset-handler/list?prefix=2025')
        const data = await response.json()
        
        // Get ALL images but display progressively
        const allImages = data.assets || []
        
        const imageUrls = allImages.map((asset: any) => ({
          key: asset.key,
          url: `/api/asset-handler/serve?key=${asset.key}`,
          thumbUrl: `/api/asset-handler/serve?key=${asset.key}&size=thumb`
        }))
        
        setImages(imageUrls)
        console.log(`Found ${imageUrls.length} images`)
      } catch (error) {
        console.error('Failed to fetch images:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchImages()
  }, [])

  const loadMore = () => {
    setDisplayCount(prev => Math.min(prev + 24, images.length))
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2">Loading gallery...</p>
        </div>
      </div>
    )
  }

  const displayedImages = images.slice(0, displayCount)

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">2025 Gallery</h1>
        <p className="text-gray-600">
          Showing {displayedImages.length} of {images.length} photos
        </p>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
        {displayedImages.map((image) => (
          <div
            key={image.key}
            className="relative aspect-square bg-gray-100 rounded overflow-hidden group"
          >
            <Image
              src={image.thumbUrl}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
              alt={image.key}
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            
            {/* Show filename on hover */}
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity truncate z-10">
              {image.key.split('_').pop()}
            </div>
          </div>
        ))}
      </div>
      
      {displayCount < images.length && (
        <div className="mt-8 text-center">
          <button
            onClick={loadMore}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Load More ({images.length - displayCount} remaining)
          </button>
        </div>
      )}
      
      {images.length === 0 && (
        <p className="text-center text-gray-500 mt-8">No images found</p>
      )}
    </div>
  )
}