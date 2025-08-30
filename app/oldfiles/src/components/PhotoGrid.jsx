import { useState, useEffect, useRef, useCallback } from 'react'
import './PhotoGrid.css'

function PhotoGrid() {
  const [photos, setPhotos] = useState([])
  const [filteredPhotos, setFilteredPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all') // all, picked, unpicked
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [loadingImages, setLoadingImages] = useState(new Set())
  const [visiblePhotos, setVisiblePhotos] = useState(20) // Start with 20 photos
  const observerRef = useRef(null)
  const loadMoreRef = useRef(null)

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
      const response = await fetch('/api/asset-handler/list')
      const data = await response.json()
      
      if (data.assets) {
        // Parse the keys to extract metadata
        const photoData = data.assets.map(asset => {
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
            url: `/api/asset-handler/serve?key=${key}`,
            thumbUrl: `/api/asset-handler/serve?key=${key}&size=thumb`,
            mediumUrl: `/api/asset-handler/serve?key=${key}&size=medium`
          }
        })
        
        // Sort by timestamp
        photoData.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
        
        setPhotos(photoData)
        setFilteredPhotos(photoData)
      }
    } catch (error) {
      console.error('Error fetching photos:', error)
    } finally {
      setLoading(false)
    }
  }

  const parseTimestamp = (timestamp) => {
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

  const filterPhotos = () => {
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
  }

  const handleImageLoad = (key) => {
    setLoadingImages(prev => {
      const newSet = new Set(prev)
      newSet.delete(key)
      return newSet
    })
  }

  const handleImageError = (key) => {
    setLoadingImages(prev => {
      const newSet = new Set(prev)
      newSet.delete(key)
      return newSet
    })
  }

  const handleImageStart = (key) => {
    setLoadingImages(prev => new Set(prev).add(key))
  }

  const downloadPhoto = async (photo) => {
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
            <img src={selectedPhoto.mediumUrl || selectedPhoto.url} alt={selectedPhoto.key} />
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
function PhotoCard({ photo, onSelect, onDownload }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const imgRef = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

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
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            style={{ opacity: imageLoaded ? 1 : 0 }}
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

export default PhotoGrid