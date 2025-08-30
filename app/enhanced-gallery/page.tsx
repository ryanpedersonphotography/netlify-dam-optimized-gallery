'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getClientOrigin } from '@/app/utils/getOrigin'
import './PhotoGrid.css'

interface Photo {
  key: string
  filename: string
  status: 'picked' | 'unpicked'
  timestamp: string
  date: string
  url: string
  thumbUrl: string
  mediumUrl: string
  largeUrl: string
  originalUrl: string
}

export default function EnhancedGallery() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, picked, unpicked
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [visiblePhotos, setVisiblePhotos] = useState(20) // Start with 20 photos
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const fetchPhotos = useCallback(async () => {
    try {
      // First try without prefix to get all assets
      const response = await fetch('/api/asset-handler/list')
      const data = await response.json()
      
      if (data.assets) {
        console.log('Found assets:', data.assets.length)
        console.log('Sample asset:', data.assets[0])
        
        // Get the origin for absolute URLs
        const origin = getClientOrigin()
        
        // Parse the keys to extract metadata
        const photoData = data.assets.map((asset: any) => {
          const key = asset.key
          // The key might already include the full path like "2025FRED_20250807180525_UNPICKED"
          // Or it might be just the timestamp part
          const parts = key.split('_')
          const status = key.includes('PICKED') ? 'picked' : 'unpicked'
          // Try to extract timestamp - it's usually the part that looks like 20250807180525
          let timestamp = ''
          for (const part of parts) {
            if (part.match(/^\d{14}$/)) {
              timestamp = part
              break
            }
          }
          
          // Build absolute URL for the blob
          const serve = `${origin}/api/asset-handler/serve?key=${encodeURIComponent(key)}`
          
          // Use Netlify Image CDN for optimization
          const thumbUrl  = `/.netlify/images?url=${encodeURIComponent(serve)}&w=400&h=400&fit=cover&q=75&fm=webp`
          const mediumUrl = `/.netlify/images?url=${encodeURIComponent(serve)}&w=1024&q=85&fm=webp`
          const largeUrl  = `/.netlify/images?url=${encodeURIComponent(serve)}&w=2048&q=90&fm=webp`
          
          return {
            key,
            filename: asset.filename || `${key}.jpg`,
            status,
            timestamp,
            date: parseTimestamp(timestamp),
            url: largeUrl, // For downloads
            thumbUrl,
            mediumUrl,
            largeUrl,
            originalUrl: serve // Fallback
          }
        })
        
        // Sort by timestamp if available
        photoData.sort((a: Photo, b: Photo) => {
          if (a.timestamp && b.timestamp) {
            return a.timestamp.localeCompare(b.timestamp)
          }
          return 0
        })
        
        setPhotos(photoData)
        setFilteredPhotos(photoData)
      }
    } catch (error) {
      console.error('Error fetching photos:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPhotos()
  }, [fetchPhotos])

  const filterPhotos = useCallback(() => {
    let filtered = [...photos]

    // Apply status filter
    if (filter === 'picked') {
      filtered = filtered.filter(p => p.status === 'picked')
    } else if (filter === 'unpicked') {
      filtered = filtered.filter(p => p.status === 'unpicked')
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(p => 
        p.key.toLowerCase().includes(term) ||
        p.timestamp.includes(term)
      )
    }

    setFilteredPhotos(filtered)
    setVisiblePhotos(20) // Reset visible photos when filtering
  }, [photos, filter, searchTerm])

  useEffect(() => {
    filterPhotos()
  }, [filterPhotos])

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

  const parseTimestamp = (timestamp: string) => {
    // Parse 20250807180510 format
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

  const downloadPhoto = async (photo: Photo) => {
    try {
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

  const downloadFiltered = async () => {
    const confirmed = window.confirm(`Download ${filteredPhotos.length} photos?`)
    if (!confirmed) return

    for (const photo of filteredPhotos) {
      await downloadPhoto(photo)
      // Add small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  if (loading) {
    return (
      <div className="photo-grid-loading">
        <div className="spinner"></div>
        <p>Loading photos...</p>
      </div>
    )
  }

  return (
    <div className="photo-grid-container">
      {/* Controls */}
      <div className="photo-controls">
        <div className="control-group">
          <input
            type="text"
            placeholder="Search photos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="control-group">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({photos.length})
          </button>
          <button 
            className={`filter-btn ${filter === 'picked' ? 'active' : ''}`}
            onClick={() => setFilter('picked')}
          >
            Picked ({photos.filter(p => p.status === 'picked').length})
          </button>
          <button 
            className={`filter-btn ${filter === 'unpicked' ? 'active' : ''}`}
            onClick={() => setFilter('unpicked')}
          >
            Unpicked ({photos.filter(p => p.status === 'unpicked').length})
          </button>
        </div>

        <div className="control-group">
          <span className="photo-count">
            Showing {filteredPhotos.length} photos
          </span>
          {filteredPhotos.length > 0 && (
            <button 
              className="download-all-btn"
              onClick={downloadFiltered}
            >
              Download All Filtered
            </button>
          )}
        </div>
      </div>

      {/* Photo Grid with lazy loading */}
      <div className="photo-grid">
        {filteredPhotos.slice(0, visiblePhotos).map(photo => (
          <PhotoCard 
            key={photo.key}
            photo={photo}
            onSelect={() => setSelectedPhoto(photo)}
            onDownload={() => downloadPhoto(photo)}
          />
        ))}
        {visiblePhotos < filteredPhotos.length && (
          <div ref={loadMoreRef} className="load-more-trigger">
            <div className="spinner"></div>
            <p>Loading more photos...</p>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="lightbox" onClick={() => setSelectedPhoto(null)}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <button 
              className="lightbox-close"
              onClick={() => setSelectedPhoto(null)}
            >
              ✕
            </button>
            <img 
              src={selectedPhoto.largeUrl || selectedPhoto.mediumUrl}
              srcSet={`${selectedPhoto.mediumUrl} 1024w, ${selectedPhoto.largeUrl} 2048w`}
              sizes="100vw"
              alt={selectedPhoto.key}
              style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }}
              decoding="async"
              fetchPriority="high"
              onError={(e) => { 
                (e.currentTarget as HTMLImageElement).src = selectedPhoto.originalUrl 
              }}
            />
            <div className="lightbox-info">
              <h3>{selectedPhoto.key}</h3>
              <p>Status: {selectedPhoto.status.toUpperCase()}</p>
              <p>Date: {selectedPhoto.date}</p>
              <button 
                className="download-btn"
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
        <div className="no-results">
          <p>No photos found</p>
          {searchTerm && <p>Try adjusting your search term</p>}
        </div>
      )}
    </div>
  )
}

// Optimized PhotoCard component with lazy loading
interface PhotoCardProps {
  photo: Photo
  onSelect: () => void
  onDownload: () => void
}

function PhotoCard({ photo, onSelect, onDownload }: PhotoCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Reset flags when photo changes
  useEffect(() => {
    setImageLoaded(false)
    setImageError(false)
  }, [photo.key])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '50px' }
    )

    if (imgRef.current) {
      observer.observe(imgRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div 
      className={`photo-card ${photo.status}`}
      onClick={onSelect}
    >
      <div className="photo-wrapper" ref={imgRef}>
        {!imageLoaded && !imageError && (
          <div className="photo-loading">
            <div className="spinner-small"></div>
          </div>
        )}
        {isVisible && (
          <img
            src={photo.thumbUrl}
            alt={photo.key}
            loading="lazy"
            decoding="async"
            style={{
              width: '100%',
              height: 'auto',
              aspectRatio: '1/1',
              objectFit: 'cover',
              opacity: imageLoaded ? 1 : 0,
              transition: 'opacity 0.25s ease'
            }}
            onLoad={() => setImageLoaded(true)}
            onError={(e) => {
              setImageError(true)
              // Fallback to direct URL if CDN fails
              ;(e.currentTarget as HTMLImageElement).src = photo.originalUrl
            }}
          />
        )}
        <div className="photo-overlay">
          <span className="photo-status">{photo.status.toUpperCase()}</span>
          <span className="photo-date">{photo.date}</span>
        </div>
      </div>
      <div className="photo-actions">
        <button 
          className="action-btn download"
          onClick={(e) => {
            e.stopPropagation()
            onDownload()
          }}
          title="Download"
        >
          ⬇
        </button>
      </div>
    </div>
  )
}