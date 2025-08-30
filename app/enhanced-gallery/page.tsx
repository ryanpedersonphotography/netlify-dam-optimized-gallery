'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { getClientOrigin } from '@/app/utils/getOrigin'

interface BlobImage {
  key: string
  url: string
  thumbUrl: string
  mediumUrl?: string
  largeUrl?: string
  index: number // Add explicit index
}

export default function EnhancedGallery() {
  const [images, setImages] = useState<BlobImage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState<BlobImage | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Add cache-busting and ensure fresh data
      const response = await fetch(`/api/asset-handler/list?prefix=2025&t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch images: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.assets || !Array.isArray(data.assets)) {
        throw new Error('Invalid response format: no assets array')
      }

      console.log(`📊 Fetched ${data.assets.length} assets`)
      
      // Build proper CDN URLs with absolute paths
      const isDev = process.env.NODE_ENV !== 'production'
      const origin = getClientOrigin()
      
      // Create unique image objects with explicit indexing
      const imageUrls = data.assets.map((asset: any, index: number) => {
        const serve = `${origin}/api/asset-handler/serve?key=${encodeURIComponent(asset.key)}`
        const serveForCdn = isDev ? `${serve}&cb=dev` : serve
        
        return {
          key: asset.key,
          url: serve,
          thumbUrl: `/.netlify/images?url=${encodeURIComponent(serveForCdn)}&w=400&h=400&fit=cover&q=75&fm=webp${isDev ? '&v=dev' : ''}`,
          mediumUrl: `/.netlify/images?url=${encodeURIComponent(serveForCdn)}&w=1024&q=85&fm=webp${isDev ? '&v=dev' : ''}`,
          largeUrl: `/.netlify/images?url=${encodeURIComponent(serveForCdn)}&w=2048&q=90&fm=webp${isDev ? '&v=dev' : ''}`,
          index // Explicit index for tracking
        }
      })
      
      // Remove duplicates based on key
      const uniqueImages = imageUrls.filter((img: BlobImage, idx: number, arr: BlobImage[]) => 
        arr.findIndex(i => i.key === img.key) === idx
      )
      
      console.log(`🎯 Setting ${uniqueImages.length} unique images`)
      
      // Debug log for first item
      if (typeof window !== 'undefined' && uniqueImages.length) {
        console.log('[GALLERY] first item', {
          key: uniqueImages[0].key,
          thumbUrl: uniqueImages[0].thumbUrl,
          largeUrl: uniqueImages[0].largeUrl,
        })
      }
      
      setImages(uniqueImages)
      
    } catch (error) {
      console.error('❌ Error fetching images:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  const openLightbox = (image: BlobImage) => {
    console.log(`🖼️ Opening lightbox for image:`, image)
    setSelectedImage(image)
  }

  const closeLightbox = () => {
    setSelectedImage(null)
  }

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!selectedImage) return
    
    const currentIndex = images.findIndex(img => img.key === selectedImage.key)
    let newIndex
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1
    } else {
      newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0
    }
    
    console.log(`🔄 Navigating from index ${currentIndex} to ${newIndex}`)
    setSelectedImage(images[newIndex])
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

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="text-red-800 font-semibold mb-2">Error Loading Gallery</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <button 
            onClick={fetchImages}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Enhanced Gallery</h1>
        <p className="text-gray-600">
          {images.length} photos loaded
          <button 
            onClick={fetchImages} 
            className="ml-4 px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
          >
            Refresh
          </button>
        </p>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
        {images.map((image) => (
          <div
            key={image.key}
            className="relative aspect-square bg-gray-100 rounded overflow-hidden group cursor-pointer"
            onClick={() => openLightbox(image)}
          >
            <Image
              src={image.thumbUrl}
              alt={image.key}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              onError={() => console.log('❌ Failed to load:', image.key)}
            />
            
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity truncate">
              {image.key} (#{image.index})
            </div>
          </div>
        ))}
      </div>
      
      {/* Lightbox */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white text-2xl z-60"
          >
            ×
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); navigateImage('prev'); }}
            className="absolute left-4 text-white text-2xl z-60 p-2"
          >
            ‹
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); navigateImage('next'); }}
            className="absolute right-4 text-white text-2xl z-60 p-2"
          >
            ›
          </button>
          
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            <Image
              src={selectedImage.largeUrl || selectedImage.mediumUrl || selectedImage.url}
              alt={selectedImage.key}
              width={1200}
              height={800}
              className="max-w-full max-h-full object-contain"
              priority
              onError={() => {
                // Fallback to direct serve URL if CDN fails
                if (selectedImage.largeUrl || selectedImage.mediumUrl) {
                  const img = document.querySelector(`img[alt="${selectedImage.key}"]`) as HTMLImageElement
                  if (img) img.src = selectedImage.url
                }
              }}
            />
            <div className="absolute bottom-4 left-4 right-4 text-white text-center">
              <p className="bg-black bg-opacity-50 rounded px-3 py-1">
                {selectedImage.key} ({images.findIndex(img => img.key === selectedImage.key) + 1} of {images.length})
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}