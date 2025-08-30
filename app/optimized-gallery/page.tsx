'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'

interface Photo {
  key: string
  filename: string
  etag?: string
}

interface PaginationInfo {
  page: number
  limit: number
  hasMore: boolean
  nextCursor: string | null
  total: number
}

export default function OptimizedGallery() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const observerRef = useRef<IntersectionObserver>()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Load photos function
  const loadPhotos = useCallback(async (pageNum: number = 1, cursor?: string | null) => {
    if (pageNum === 1) {
      setLoading(true)
      setError(null)
    } else {
      setLoadingMore(true)
    }
    
    try {
      const params = new URLSearchParams({
        prefix: '2025',
        page: pageNum.toString(),
        limit: '50'
      })
      
      if (cursor) {
        params.append('cursor', cursor)
      }
      
      const response = await fetch(`/api/asset-handler/list?${params}`)
      
      if (!response.ok) {
        throw new Error(`Failed to load photos: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      setPhotos(prev => pageNum === 1 ? data.assets : [...prev, ...data.assets])
      setPagination(data.pagination)
      
      console.log(`Loaded page ${pageNum}: ${data.assets.length} photos, hasMore: ${data.pagination.hasMore}`)
    } catch (err) {
      console.error('Error loading photos:', err)
      setError(err instanceof Error ? err.message : 'Failed to load photos')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadPhotos(1)
  }, [loadPhotos])

  // Set up infinite scroll observer
  useEffect(() => {
    if (loading) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination?.hasMore && !loadingMore) {
          console.log('Loading more photos...')
          loadPhotos(pagination.page + 1, pagination.nextCursor)
        }
      },
      { 
        threshold: 0.1, 
        rootMargin: '200px' 
      }
    )
    
    observerRef.current = observer
    
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [loading, loadingMore, pagination, loadPhotos])

  if (loading && photos.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading gallery...</p>
        </div>
      </div>
    )
  }

  if (error && photos.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-600">
          <p className="text-xl">Error loading gallery</p>
          <p className="mt-2">{error}</p>
          <button 
            onClick={() => loadPhotos(1)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">2025 Gallery - Optimized</h1>
        <p className="text-gray-600">
          {photos.length} photos loaded
          {pagination?.hasMore && ' (scroll for more)'}
        </p>
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {photos.map((photo, index) => (
          <PhotoCard 
            key={photo.key}
            photo={photo}
            priority={index < 12} // First 12 images load immediately
          />
        ))}
      </div>

      {/* Infinite scroll trigger */}
      {pagination?.hasMore && (
        <div 
          ref={loadMoreRef} 
          className="h-32 flex items-center justify-center mt-8"
        >
          {loadingMore && (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading more photos...</p>
            </div>
          )}
        </div>
      )}

      {/* End of gallery message */}
      {!pagination?.hasMore && photos.length > 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">End of gallery</p>
          <p className="mt-2">{photos.length} photos total</p>
        </div>
      )}
    </div>
  )
}

// Separate PhotoCard component for better performance
function PhotoCard({ photo, priority }: { photo: Photo; priority: boolean }) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // Blur placeholder
  const blurDataURL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAKAAoDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWEREiMxUf/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyJckliyjqTzSlT54b6bk+h0R//2Q=="
  
  if (hasError) {
    return (
      <div className="relative aspect-square bg-gray-200 rounded-lg flex items-center justify-center">
        <span className="text-gray-400 text-xs">Failed to load</span>
      </div>
    )
  }
  
  return (
    <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse" />
      )}
      
      <Image
        src={`/api/asset-handler/serve?key=${photo.key}&size=thumb&format=webp&quality=75`}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
        alt={photo.filename}
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        loading={priority ? 'eager' : 'lazy'}
        quality={75}
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
        placeholder="blur"
        blurDataURL={blurDataURL}
      />
      
      {/* Hover overlay with filename */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-white text-xs truncate">
            {photo.filename}
          </p>
        </div>
      </div>
    </div>
  )
}