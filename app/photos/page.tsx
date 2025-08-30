'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

interface Photo {
  key: string
  filename: string
  status: 'picked' | 'unpicked'
  timestamp: string
  date: string
  url: string
  thumbUrl: string
  mediumUrl: string
}

export default function PhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'picked' | 'unpicked'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [visiblePhotos, setVisiblePhotos] = useState(12)
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchPhotos()
  }, [])

  useEffect(() => {
    filterPhotos()
  }, [photos, filter, searchTerm])

  // Infinite scroll setup
  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    }

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && visiblePhotos < filteredPhotos.length) {
        setVisiblePhotos(prev => Math.min(prev + 20, filteredPhotos.length))
      }
    }, options)

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [visiblePhotos, filteredPhotos.length])

  const fetchPhotos = async () => {
    try {
      // Fetch from our own API endpoint
      const response = await fetch('/api/photos')
      const data = await response.json()
      
      if (data.assets) {
        const photoData = data.assets.map((asset: any) => {
          const key = asset.key
          const parts = key.split('_')
          const status = key.includes('PICKED') ? 'picked' : 'unpicked'
          const timestamp = parts[1] || ''
          
          return {
            key,
            filename: asset.filename || `${key}.jpg`,
            status,
            timestamp,
            date: parseTimestamp(timestamp),
            url: `/api/photos/image?key=${key}`,
            thumbUrl: `/api/photos/image?key=${key}&w=300&q=75`,
            mediumUrl: `/api/photos/image?key=${key}&w=800&q=85`
          }
        })
        
        photoData.sort((a: Photo, b: Photo) => a.timestamp.localeCompare(b.timestamp))
        
        setPhotos(photoData)
        setFilteredPhotos(photoData)
      }
    } catch (error) {
      console.error('Error fetching photos:', error)
    } finally {
      setLoading(false)
    }
  }

  const parseTimestamp = (timestamp: string) => {
    if (timestamp.length >= 14) {
      const year = timestamp.substring(0, 4)
      const month = timestamp.substring(4, 6)
      const day = timestamp.substring(6, 8)
      const hour = timestamp.substring(8, 10)
      const minute = timestamp.substring(10, 12)
      const second = timestamp.substring(12, 14)
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`
    }
    return timestamp
  }

  const filterPhotos = () => {
    let filtered = [...photos]

    if (filter === 'picked') {
      filtered = filtered.filter(p => p.status === 'picked')
    } else if (filter === 'unpicked') {
      filtered = filtered.filter(p => p.status === 'unpicked')
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(p => 
        p.key.toLowerCase().includes(term) ||
        p.timestamp.includes(term)
      )
    }

    setFilteredPhotos(filtered)
    setVisiblePhotos(20)
  }

  const downloadPhoto = async (photo: Photo) => {
    try {
      // Always use full-size URL for downloads
      const response = await fetch(photo.url)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = photo.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading photo:', error)
    }
  }

  const downloadSelected = async () => {
    if (selectedPhotos.size === 0) return
    
    setDownloading(true)
    const zip = new JSZip()
    
    try {
      // Download all selected photos
      const promises = Array.from(selectedPhotos).map(async (photoKey) => {
        const photo = photos.find(p => p.key === photoKey)
        if (!photo) return
        
        try {
          const response = await fetch(photo.url)
          const blob = await response.blob()
          zip.file(photo.filename, blob)
        } catch (error) {
          console.error(`Failed to download ${photo.filename}:`, error)
        }
      })
      
      await Promise.all(promises)
      
      // Generate and download the zip
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `photos-${Date.now()}.zip`)
      
      // Clear selection
      setSelectedPhotos(new Set())
      setSelectionMode(false)
    } catch (error) {
      console.error('Error creating zip:', error)
    } finally {
      setDownloading(false)
    }
  }

  const togglePhotoSelection = (photoKey: string) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev)
      if (newSet.has(photoKey)) {
        newSet.delete(photoKey)
      } else {
        newSet.add(photoKey)
      }
      return newSet
    })
  }

  const selectAll = () => {
    const allKeys = new Set(filteredPhotos.slice(0, visiblePhotos).map(p => p.key))
    setSelectedPhotos(allKeys)
  }

  const clearSelection = () => {
    setSelectedPhotos(new Set())
    setSelectionMode(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4">Loading photos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Photo Gallery</h1>
          <p className="text-gray-600">Browse and manage all party photos</p>
        </div>

        {/* Controls */}
        <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-wrap gap-4">
            <input
              type="text"
              placeholder="Search photos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-[200px] px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            <div className="flex gap-3">
              <button 
                className={`px-5 py-2.5 rounded-lg font-semibold transition-all transform hover:scale-105 ${
                  filter === 'all' 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                onClick={() => setFilter('all')}
              >
                All ({photos.length})
              </button>
              <button 
                className={`px-5 py-2.5 rounded-lg font-semibold transition-all transform hover:scale-105 ${
                  filter === 'picked' 
                    ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                onClick={() => setFilter('picked')}
              >
                ⭐ Picked ({photos.filter(p => p.status === 'picked').length})
              </button>
              <button 
                className={`px-5 py-2.5 rounded-lg font-semibold transition-all transform hover:scale-105 ${
                  filter === 'unpicked' 
                    ? 'bg-gradient-to-r from-yellow-600 to-yellow-700 text-white shadow-md' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
                onClick={() => setFilter('unpicked')}
              >
                📷 Unpicked ({photos.filter(p => p.status === 'unpicked').length})
              </button>
          </div>

          {/* Selection Mode Controls */}
          <div className="flex gap-3 ml-auto">
            {!selectionMode ? (
              <button 
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transform hover:scale-105 transition-all"
                onClick={() => setSelectionMode(true)}
              >
                📌 Select Photos
              </button>
            ) : (
              <>
                <button 
                  className="px-5 py-2.5 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                  onClick={clearSelection}
                >
                  Cancel
                </button>
                <button 
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                  onClick={selectAll}
                >
                  Select All
                </button>
                <button 
                  className={`px-6 py-2.5 rounded-lg font-semibold transition-all ${
                    selectedPhotos.size > 0 
                      ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md hover:shadow-lg transform hover:scale-105' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  onClick={downloadSelected}
                  disabled={selectedPhotos.size === 0 || downloading}
                >
                  {downloading ? '⏳ Downloading...' : `⬇️ Download ${selectedPhotos.size} Photos`}
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className="text-gray-600 mt-4">
          Showing {filteredPhotos.length} photos
        </div>
      </div>

      {/* Photo Gallery - Masonry Layout */}
      <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4">
        {filteredPhotos.slice(0, visiblePhotos).map(photo => (
          <PhotoCard 
            key={photo.key}
            photo={photo}
            isSelected={selectedPhotos.has(photo.key)}
            selectionMode={selectionMode}
            onSelect={() => {
              if (selectionMode) {
                togglePhotoSelection(photo.key)
              } else {
                setSelectedPhoto(photo)
              }
            }}
            onDownload={() => downloadPhoto(photo)}
          />
        ))}
      </div>

      {/* Load More Trigger */}
      {visiblePhotos < filteredPhotos.length && (
        <div ref={loadMoreRef} className="flex justify-center mt-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-full" onClick={e => e.stopPropagation()}>
            <button 
              className="absolute top-4 right-4 text-white text-2xl z-10"
              onClick={() => setSelectedPhoto(null)}
            >
              ✕
            </button>
            <div className="relative w-full h-full">
              <Image
                src={selectedPhoto.mediumUrl}
                alt={selectedPhoto.key}
                width={1200}
                height={900}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
                className="object-contain"
                quality={90}
                priority
              />
            </div>
            <div className="bg-white p-4 mt-4 rounded-lg">
              <h3 className="font-bold">{selectedPhoto.key}</h3>
              <p>Status: {selectedPhoto.status.toUpperCase()}</p>
              <p>Date: {selectedPhoto.date}</p>
              <button 
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg"
                onClick={() => downloadPhoto(selectedPhoto)}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No results */}
      {filteredPhotos.length === 0 && !loading && (
        <div className="text-center py-16">
          <div className="bg-white rounded-xl shadow-lg p-12 max-w-md mx-auto">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-600 text-lg font-medium">No photos found</p>
            {searchTerm && <p className="text-gray-500 text-sm mt-2">Try adjusting your search term</p>}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

// PhotoCard component with Next.js Image optimization
function PhotoCard({ photo, isSelected, selectionMode, onSelect, onDownload }: {
  photo: Photo
  isSelected: boolean
  selectionMode: boolean
  onSelect: () => void
  onDownload: () => void
}) {
  const [imageError, setImageError] = useState<string | false>(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <div 
      className={`relative group cursor-pointer rounded-lg overflow-hidden break-inside-avoid mb-4 ${
        photo.status === 'picked' ? 'ring-2 ring-green-500' : ''
      } ${isSelected ? 'ring-4 ring-blue-500' : ''}`}
      onClick={onSelect}
    >
      <div className="relative bg-gray-100">
        {!imageError ? (
          <>
            {/* Skeleton loader */}
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gray-200 animate-pulse" />
            )}
            <Image
              src={photo.thumbUrl}
              alt={photo.key}
              width={300}
              height={200}
              sizes="(max-width: 640px) 150px, (max-width: 1024px) 200px, 250px"
              className="w-full h-auto object-cover"
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                console.error(`Failed to load image: ${photo.key}`, {
                  url: photo.thumbUrl,
                  error: e
                })
                setImageError(`Failed: ${photo.key}`)
              }}
              loading="lazy"
              quality={75}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-48 bg-gray-200 p-2">
            <span className="text-gray-600 text-sm">Failed to load</span>
            <span className="text-gray-500 text-xs mt-1 text-center break-all">{photo.key}</span>
            <button 
              className="mt-2 text-xs text-blue-500 underline"
              onClick={(e) => {
                e.stopPropagation()
                // Try with JPEG fallback
                window.open(photo.url, '_blank')
              }}
            >
              Try Original
            </button>
          </div>
        )}
      </div>
      
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity">
        {/* Selection checkbox */}
        {selectionMode && (
          <div className="absolute top-2 right-2 z-10">
            <div className={`w-6 h-6 rounded border-2 ${
              isSelected 
                ? 'bg-blue-500 border-blue-500' 
                : 'bg-white border-gray-300'
            } flex items-center justify-center`}>
              {isSelected && (
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </div>
        )}
        
        <div className="absolute top-2 left-2">
          <span className={`px-2 py-1 text-xs rounded ${
            photo.status === 'picked' 
              ? 'bg-green-500 text-white' 
              : 'bg-gray-500 text-white'
          }`}>
            {photo.status.toUpperCase()}
          </span>
        </div>
        
        <button 
          className="absolute bottom-2 right-2 p-2 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            onDownload()
          }}
          title="Download"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </div>
    </div>
  )
}