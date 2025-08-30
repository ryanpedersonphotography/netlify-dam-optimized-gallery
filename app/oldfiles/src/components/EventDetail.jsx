import { useParams, Link } from 'react-router-dom'
import { useState, useEffect, useMemo } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { Masonry } from 'masonic'
import './EventDetail.css'

const EventDetail = ({ properties }) => {
  const { propertyId, year } = useParams()
  const [downloading, setDownloading] = useState(false)
  // v2 - Fixed masonry, filters, and sorting
  const [selectedImage, setSelectedImage] = useState(null)
  const [selectedAssets, setSelectedAssets] = useState([])
  const [selectionMode, setSelectionMode] = useState(false)
  const [sortBy, setSortBy] = useState('topPicks') // 'topPicks', 'all', or 'time'
  const [metadataLoading, setMetadataLoading] = useState(false)
  const [timeSort, setTimeSort] = useState('asc') // 'asc' for oldest first, 'desc' for newest first
  const [imageDimensions, setImageDimensions] = useState({})
  // Initialize states
  const [photoRatings, setPhotoRatings] = useState({})
  const [photoTags, setPhotoTags] = useState({})
  const [fullscreen, setFullscreen] = useState(false)
  const [activeFilters, setActiveFilters] = useState([])
  const [saveStatus, setSaveStatus] = useState('saved') // 'saving', 'saved', 'error'
  const [lastSaved, setLastSaved] = useState(null)
  
  const property = properties.find(p => p.id === propertyId)
  const party = property?.events?.parties?.find(p => p.year === parseInt(year))
  
  // Create a combined list of all assets (both top and all)
  // Since top picks are separate files, we need to combine them - memoize to prevent re-renders
  const allAssetsWithMetadata = useMemo(() => {
    if (!party) return []
    const allUniqueAssets = [...new Set([...party.assets.top, ...party.assets.all])]
    return allUniqueAssets.map(asset => ({
      path: asset,
      isTopPick: party.assets.top.includes(asset)
    }))
  }, [party])
  
  // Initialize sortedAssets immediately with top picks (default view)
  const [sortedAssets, setSortedAssets] = useState(() => {
    if (!party) return []
    return party.assets.top.map(asset => ({
      path: asset,
      isTopPick: true
    }))
  })
  
  // Load metadata in background - don't block initial render
  useEffect(() => {
    if (!party) return
    
    // Set default dimensions immediately for instant rendering
    const allUniqueAssets = [...new Set([...party.assets.top, ...party.assets.all])]
    const defaultDims = {}
    for (const assetPath of allUniqueAssets) {
      defaultDims[assetPath] = {
        width: 2400,
        height: 1600,
        aspectRatio: 0.6667 // Pre-calculated 1600/2400
      }
    }
    setImageDimensions(defaultDims)
    
    // Load actual metadata in background (non-blocking)
    fetch('/photo-metadata.json')
      .then(res => res.json())
      .then(metadata => {
        const actualDims = {}
        for (const assetPath of allUniqueAssets) {
          actualDims[assetPath] = metadata[assetPath] || defaultDims[assetPath]
        }
        setImageDimensions(actualDims)
      })
      .catch(() => {
        // Silent fail - already have defaults
      })
  }, [propertyId, year])
  
  // Effect to sort assets based on sortBy selection
  useEffect(() => {
    try {
      // Make sure we have assets to work with
      if (!allAssetsWithMetadata || allAssetsWithMetadata.length === 0) {
        setSortedAssets([])
        return
      }
      
      let sorted = []
      
      // First, filter by view type
      switch (sortBy) {
        case 'topPicks':
          // Show only top picks (from the top array)
          sorted = allAssetsWithMetadata.filter(asset => asset && asset.isTopPick)
          break
        case 'all':
          // Show only photos from the all directory (not top picks)
          sorted = allAssetsWithMetadata.filter(asset => asset && asset.path && asset.path.includes('/all/'))
          break
        default:
          sorted = allAssetsWithMetadata.filter(asset => asset && asset.isTopPick)
          break
      }
      
      // Ensure we always have an array, even if empty
      setSortedAssets(sorted || [])
    } catch (error) {
      console.error('Error in sorting effect:', error)
      setSortedAssets([])
    }
  }, [sortBy, allAssetsWithMetadata, timeSort, activeFilters, photoTags])
  
  const toggleAssetSelection = (asset) => {
    setSelectedAssets(prev => {
      const isSelected = prev.includes(asset)
      if (isSelected) {
        return prev.filter(a => a !== asset)
      } else {
        return [...prev, asset]
      }
    })
  }
  
  const handleAssetClick = (assetObj) => {
    const asset = typeof assetObj === 'string' ? assetObj : assetObj.path
    if (selectionMode) {
      toggleAssetSelection(asset)
    } else {
      setSelectedImage(asset)
    }
  }
  
  const clearSelection = () => {
    setSelectedAssets([])
    setSelectionMode(false)
  }
  
  const navigatePhoto = (direction) => {
    const currentIndex = sortedAssets.findIndex(assetObj => assetObj.path === selectedImage)
    
    let newIndex
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : sortedAssets.length - 1
    } else {
      newIndex = currentIndex < sortedAssets.length - 1 ? currentIndex + 1 : 0
    }
    
    const newAsset = sortedAssets[newIndex]
    setSelectedImage(newAsset.path)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedImage) return
      
      if (e.key === 'ArrowLeft') {
        navigatePhoto('prev')
      } else if (e.key === 'ArrowRight') {
        navigatePhoto('next')
      } else if (e.key === 'Escape') {
        setSelectedImage(null)
        setFullscreen(false)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage, sortedAssets, navigatePhoto])
  
  // Load photo data from server on component mount
  useEffect(() => {
    const loadPhotoData = async () => {
      try {
        // Try Vercel API endpoint first (works both in production and with Vercel dev)
        const apiUrl = `/api/photo-data?propertyId=${propertyId}&year=${year}`
        const response = await fetch(apiUrl)
        
        if (response.ok) {
          const data = await response.json()
          if (data.tags && Object.keys(data.tags).length > 0) {
            setPhotoTags(data.tags)
          }
          if (data.ratings && Object.keys(data.ratings).length > 0) {
            setPhotoRatings(data.ratings)
          }
          if (data.lastUpdated) {
            setLastSaved(new Date(data.lastUpdated))
          }
        } else {
          // Try local server as fallback
          const localResponse = await fetch(`http://localhost:3001/api/load-photo-data/${propertyId}/${year}`)
          if (localResponse.ok) {
            const data = await localResponse.json()
            if (data.tags) setPhotoTags(data.tags)
            if (data.ratings) setPhotoRatings(data.ratings)
            if (data.lastUpdated) setLastSaved(new Date(data.lastUpdated))
          }
        }
      } catch (error) {
        console.error('Error loading photo data:', error)
        // Fall back to localStorage if server is unavailable
        const savedTags = localStorage.getItem(`solhem_${propertyId}_${year}_tags`)
        const savedRatings = localStorage.getItem(`solhem_${propertyId}_${year}_ratings`)
        if (savedTags) setPhotoTags(JSON.parse(savedTags))
        if (savedRatings) setPhotoRatings(JSON.parse(savedRatings))
      }
    }
    
    if (propertyId && year) {
      loadPhotoData()
    }
  }, [propertyId, year])
  
  // Save photo data to server with debouncing
  useEffect(() => {
    const saveToServer = async () => {
      setSaveStatus('saving')
      try {
        // Try Vercel API endpoint first
        const apiUrl = `/api/photo-data?propertyId=${propertyId}&year=${year}`
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tags: photoTags,
            ratings: photoRatings
          })
        })
        
        if (response.ok) {
          setSaveStatus('saved')
          setLastSaved(new Date())
          // Also save to localStorage as backup
          localStorage.setItem(`solhem_${propertyId}_${year}_tags`, JSON.stringify(photoTags))
          localStorage.setItem(`solhem_${propertyId}_${year}_ratings`, JSON.stringify(photoRatings))
        } else {
          // Try local server as fallback
          const localResponse = await fetch('http://localhost:3001/api/save-photo-data', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              propertyId,
              year,
              tags: photoTags,
              ratings: photoRatings
            })
          })
          
          if (localResponse.ok) {
            setSaveStatus('saved')
            setLastSaved(new Date())
            localStorage.setItem(`solhem_${propertyId}_${year}_tags`, JSON.stringify(photoTags))
            localStorage.setItem(`solhem_${propertyId}_${year}_ratings`, JSON.stringify(photoRatings))
          } else {
            setSaveStatus('error')
            // Still save to localStorage
            localStorage.setItem(`solhem_${propertyId}_${year}_tags`, JSON.stringify(photoTags))
            localStorage.setItem(`solhem_${propertyId}_${year}_ratings`, JSON.stringify(photoRatings))
          }
        }
      } catch (error) {
        console.error('Error saving to server:', error)
        setSaveStatus('error')
        // Fall back to localStorage
        localStorage.setItem(`solhem_${propertyId}_${year}_tags`, JSON.stringify(photoTags))
        localStorage.setItem(`solhem_${propertyId}_${year}_ratings`, JSON.stringify(photoRatings))
      }
    }
    
    // Debounce saving - wait 1 second after last change
    const hasData = Object.keys(photoTags).length > 0 || Object.keys(photoRatings).length > 0
    if (hasData && propertyId && year) {
      const timer = setTimeout(saveToServer, 1000)
      return () => clearTimeout(timer)
    }
  }, [photoTags, photoRatings, propertyId, year])
  
  const downloadSelectedAssets = async () => {
    if (selectedAssets.length === 0) return
    
    setDownloading(true)
    const zip = new JSZip()
    const folder = zip.folder(`${property.name}_${year}_Selected`)
    
    try {
      for (const asset of selectedAssets) {
        const response = await fetch(`/assets/${asset}`)
        const blob = await response.blob()
        const filename = asset.split('/').pop()
        folder.file(filename, blob)
      }
      
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `${property.name}_${year}_Selected_Assets.zip`)
      clearSelection()
    } catch (error) {
      console.error('Error downloading assets:', error)
      alert('Error downloading assets. Please try again.')
    } finally {
      setDownloading(false)
    }
  }
  
  const downloadAllAssets = async () => {
    setDownloading(true)
    const zip = new JSZip()
    const propertyFolder = zip.folder(`${property.name}_${year}_Party`)
    
    try {
      // Add top picks
      if (party.assets.top.length > 0) {
        const topFolder = propertyFolder.folder('Top_Picks')
        for (const asset of party.assets.top) {
          const response = await fetch(`/assets/${asset}`)
          const blob = await response.blob()
          const filename = asset.split('/').pop()
          topFolder.file(filename, blob)
        }
      }
      
      // Add all photos
      if (party.assets.all.length > 0) {
        const allFolder = propertyFolder.folder('All_Photos')
        for (const asset of party.assets.all) {
          const response = await fetch(`/assets/${asset}`)
          const blob = await response.blob()
          const filename = asset.split('/').pop()
          allFolder.file(filename, blob)
        }
      }
      
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `${property.name}_${year}_Party_Assets.zip`)
    } catch (error) {
      console.error('Error downloading assets:', error)
      alert('Error downloading assets. Please try again.')
    } finally {
      setDownloading(false)
    }
  }
  
  // Check if property or party exists after all hooks have been defined
  if (!property || !party) {
    return <div className="error">Event not found</div>
  }
  
  return (
    <div className="event-detail">
      <div className="event-header">
        <Link to="/by-year" className="back-link">← Back to Events</Link>
        <div className="event-title">
          <h1>{property.name} - {year} Party</h1>
          <p className="event-date">
            {new Date(party.date).toLocaleDateString('en-US', { 
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        <div className="download-controls">
          {selectionMode && selectedAssets.length > 0 && (
            <>
              <button 
                className="btn-download-selected"
                onClick={downloadSelectedAssets}
                disabled={downloading}
              >
                Download Selected ({selectedAssets.length})
              </button>
              <button 
                className="btn-clear"
                onClick={clearSelection}
              >
                Clear Selection
              </button>
            </>
          )}
          <button 
            className="btn-select-mode"
            onClick={() => setSelectionMode(!selectionMode)}
          >
            {selectionMode ? 'Exit Selection' : 'Select Photos'}
          </button>
          <button 
            className="btn-download-all"
            onClick={downloadAllAssets}
            disabled={downloading}
          >
            {downloading ? 'Downloading...' : 'Download All'}
          </button>
        </div>
      </div>
      
      <div className="sort-controls">
        <label className="sort-label">View:</label>
        <div className="sort-options">
          <button 
            className={`sort-btn ${sortBy === 'topPicks' ? 'active' : ''}`}
            onClick={() => setSortBy('topPicks')}
          >
            ⭐ Top Picks ({party.assets.top.length})
          </button>
          <button 
            className={`sort-btn ${sortBy === 'all' ? 'active' : ''}`}
            onClick={() => setSortBy('all')}
          >
            📷 All Photos ({party.assets.all.length})
          </button>
          {/* Time sort disabled - no timestamp data available
          <button 
            className="sort-btn time-toggle"
            onClick={() => setTimeSort(prev => prev === 'asc' ? 'desc' : 'asc')}
            disabled={metadataLoading}
            title={timeSort === 'asc' ? 'Oldest first (click for newest)' : 'Newest first (click for oldest)'}
          >
            📅 {timeSort === 'asc' ? '↑' : '↓'}
          </button>
          */}
        </div>
        <span className="photo-count">
          {metadataLoading ? 'Loading...' : `Showing ${sortedAssets.length} photos`}
        </span>
      </div>
      
      {/* Temporarily disabled filters until photos are properly tagged
      <div className="category-filters">
        <label className="sort-label">Filter by:</label>
        <div className="category-options">
          <button 
            className={`category-btn ${activeFilters.length === 0 ? 'active' : ''}`}
            onClick={() => setActiveFilters([])}
          >
            All Photos
          </button>
          <button 
            className={`category-btn ${activeFilters.includes('Food/Drink') ? 'active' : ''}`}
            onClick={() => {
              setActiveFilters(prev => 
                prev.includes('Food/Drink') 
                  ? prev.filter(f => f !== 'Food/Drink')
                  : [...prev, 'Food/Drink']
              )
            }}
          >
            🍔 Food/Drink
          </button>
          <button 
            className={`category-btn ${activeFilters.includes('Food Trucks') ? 'active' : ''}`}
            onClick={() => {
              setActiveFilters(prev => 
                prev.includes('Food Trucks') 
                  ? prev.filter(f => f !== 'Food Trucks')
                  : [...prev, 'Food Trucks']
              )
            }}
          >
            🚚 Food Trucks
          </button>
          <button 
            className={`category-btn ${activeFilters.includes('Dogs!') ? 'active' : ''}`}
            onClick={() => {
              setActiveFilters(prev => 
                prev.includes('Dogs!') 
                  ? prev.filter(f => f !== 'Dogs!')
                  : [...prev, 'Dogs!']
              )
            }}
          >
            🐕 Dogs!
          </button>
          <button 
            className={`category-btn ${activeFilters.includes('Kids!') ? 'active' : ''}`}
            onClick={() => {
              setActiveFilters(prev => 
                prev.includes('Kids!') 
                  ? prev.filter(f => f !== 'Kids!')
                  : [...prev, 'Kids!']
              )
            }}
          >
            👶 Kids!
          </button>
          <button 
            className={`category-btn ${activeFilters.includes('Families') ? 'active' : ''}`}
            onClick={() => {
              setActiveFilters(prev => 
                prev.includes('Families') 
                  ? prev.filter(f => f !== 'Families')
                  : [...prev, 'Families']
              )
            }}
          >
            👨‍👩‍👧‍👦 Families
          </button>
          <button 
            className={`category-btn ${activeFilters.includes('Games/Events') ? 'active' : ''}`}
            onClick={() => {
              setActiveFilters(prev => 
                prev.includes('Games/Events') 
                  ? prev.filter(f => f !== 'Games/Events')
                  : [...prev, 'Games/Events']
              )
            }}
          >
            🎮 Games/Events
          </button>
          <button 
            className={`category-btn ${activeFilters.includes('Solhem Staff') ? 'active' : ''}`}
            onClick={() => {
              setActiveFilters(prev => 
                prev.includes('Solhem Staff') 
                  ? prev.filter(f => f !== 'Solhem Staff')
                  : [...prev, 'Solhem Staff']
              )
            }}
          >
            👔 Solhem Staff
          </button>
          <button 
            className={`category-btn ${activeFilters.includes('Music') ? 'active' : ''}`}
            onClick={() => {
              setActiveFilters(prev => 
                prev.includes('Music') 
                  ? prev.filter(f => f !== 'Music')
                  : [...prev, 'Music']
              )
            }}
          >
            🎵 Music
          </button>
          <button 
            className={`category-btn ${activeFilters.includes('Male') ? 'active' : ''}`}
            onClick={() => {
              setActiveFilters(prev => 
                prev.includes('Male') 
                  ? prev.filter(f => f !== 'Male')
                  : [...prev, 'Male']
              )
            }}
          >
            👨 Male
          </button>
          <button 
            className={`category-btn ${activeFilters.includes('Female') ? 'active' : ''}`}
            onClick={() => {
              setActiveFilters(prev => 
                prev.includes('Female') 
                  ? prev.filter(f => f !== 'Female')
                  : [...prev, 'Female']
              )
            }}
          >
            👩 Female
          </button>
          <button 
            className={`category-btn ${activeFilters.includes('Rooftop') ? 'active' : ''}`}
            onClick={() => {
              setActiveFilters(prev => 
                prev.includes('Rooftop') 
                  ? prev.filter(f => f !== 'Rooftop')
                  : [...prev, 'Rooftop']
              )
            }}
          >
            🏙️ Rooftop
          </button>
          <button 
            className={`category-btn ${activeFilters.includes('Outdoor Terrace') ? 'active' : ''}`}
            onClick={() => {
              setActiveFilters(prev => 
                prev.includes('Outdoor Terrace') 
                  ? prev.filter(f => f !== 'Outdoor Terrace')
                  : [...prev, 'Outdoor Terrace']
              )
            }}
          >
            🌳 Terrace
          </button>
        </div>
        {activeFilters.length > 0 && (
          <span className="filter-count">
            {(() => {
              try {
                const taggedCount = sortedAssets.filter(photo => {
                  const photoPath = photo?.path || photo
                  const tags = photoTags[photoPath] || []
                  return activeFilters.some(filter => tags.includes(filter))
                }).length
                
                if (taggedCount === 0) {
                  return "No photos tagged yet - showing all photos"
                }
                return `${taggedCount} photos with selected tags`
              } catch (e) {
                console.error('Filter count error:', e)
                return "Filtering..."
              }
            })()}
          </span>
        )}
        <div className="data-status">
          {saveStatus === 'saving' && (
            <span className="save-status saving">
              ⏳ Saving...
            </span>
          )}
          {saveStatus === 'saved' && lastSaved && (
            <span className="save-status saved" title={`Last saved: ${lastSaved.toLocaleString()}`}>
              ☁️ Saved to server
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="save-status error" title="Saved locally, will retry server">
              ⚠️ Saved locally
            </span>
          )}
          {Object.keys(photoTags).length > 0 && (
            <span className="saved-indicator" title="Tags are saved automatically">
              🏷️ {Object.keys(photoTags).length} tagged
            </span>
          )}
          {Object.keys(photoRatings).length > 0 && (
            <span className="saved-indicator" title="Ratings are saved automatically">
              ⭐ {Object.keys(photoRatings).length} rated
            </span>
          )}
        </div>
      </div>
      */}
      
      <div className="masonry-container">
        {sortedAssets.length === 0 ? (
          <div className="no-photos-message">
            <p>No photos available in this view.</p>
          </div>
        ) : (
          <Masonry
            items={sortedAssets}
            columnGutter={8}
            columnWidth={300}
            overscanBy={5}
            render={({ data: assetObj, width }) => {
              if (!assetObj || !assetObj.path) {
                return null
              }
              
              const asset = assetObj.path
              const dimensions = imageDimensions[asset] || { aspectRatio: 1600/2400 }
              const height = width * dimensions.aspectRatio
              
              return (
                <div
                  className={`masonry-item ${selectedAssets.includes(asset) ? 'selected' : ''} ${assetObj.isTopPick ? 'top-pick' : ''}`}
                  onClick={() => handleAssetClick(assetObj)}
                  style={{ height }}
                >
                  {assetObj.isTopPick && <span className="top-pick-badge">⭐</span>}
                  <img 
                    src={`/assets/${asset}`} 
                    alt={`${property.name} Photo`}
                    loading="lazy"
                    decoding="async"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {selectionMode && (
                    <div className="selection-overlay">
                      <input
                        type="checkbox"
                        checked={selectedAssets.includes(asset)}
                        onChange={(e) => {
                          e.stopPropagation()
                          toggleAssetSelection(asset)
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                </div>
              )
            }}
          />
        )}
      </div>
      
      {selectedImage && !selectionMode && (
        <div className="enhanced-modal" onClick={(e) => {
          if (e.target.classList.contains('enhanced-modal')) {
            setSelectedImage(null)
            setFullscreen(false)
          }
        }}>
          <div className={`modal-content ${fullscreen ? 'fullscreen' : ''}`}>
            <button className="modal-close" onClick={() => {
              setSelectedImage(null)
              setFullscreen(false)
            }}>×</button>
            
            {fullscreen ? (
              <div className="fullscreen-view" onClick={(e) => {
                if (e.target.classList.contains('fullscreen-view')) {
                  setFullscreen(false)
                }
              }}>
                <button 
                  className="nav-btn prev"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigatePhoto('prev')
                  }}
                  title="Previous (←)"
                >
                  ‹
                </button>
                <img src={`/assets/${selectedImage}`} alt="Fullscreen view" />
                <button 
                  className="nav-btn next"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigatePhoto('next')
                  }}
                  title="Next (→)"
                >
                  ›
                </button>
                <button className="exit-fullscreen" onClick={(e) => {
                  e.stopPropagation()
                  setFullscreen(false)
                }}>
                  Exit Fullscreen
                </button>
              </div>
            ) : (
              <>
                <div className="modal-image-section">
                  <div className="image-container">
                    <button 
                      className="nav-btn prev"
                      onClick={() => navigatePhoto('prev')}
                      title="Previous (←)"
                    >
                      ‹
                    </button>
                    <img src={`/assets/${selectedImage}`} alt="Selected photo" />
                    <button 
                      className="nav-btn next"
                      onClick={() => navigatePhoto('next')}
                      title="Next (→)"
                    >
                      ›
                    </button>
                    <button 
                      className="fullscreen-btn" 
                      onClick={() => setFullscreen(true)}
                      title="View Fullscreen"
                    >
                      ⛶
                    </button>
                  </div>
                  
                  <div className="image-actions">
                    <div className="download-buttons">
                      <button 
                        className="download-btn small"
                        onClick={async () => {
                          try {
                            const response = await fetch(`http://localhost:3001/api/resize?image=${encodeURIComponent(selectedImage)}&size=small`)
                            const blob = await response.blob()
                            const filename = selectedImage.split('/').pop()
                            const nameWithoutExt = filename.split('.').slice(0, -1).join('.')
                            saveAs(blob, `${nameWithoutExt}-small.jpg`)
                          } catch (error) {
                            console.error('Download failed:', error)
                            // Fallback to original
                            const response = await fetch(`/assets/${selectedImage}`)
                            const blob = await response.blob()
                            saveAs(blob, `small-${selectedImage.split('/').pop()}`)
                          }
                        }}
                      >
                        📥 Small
                      </button>
                      <button 
                        className="download-btn medium"
                        onClick={async () => {
                          try {
                            const response = await fetch(`http://localhost:3001/api/resize?image=${encodeURIComponent(selectedImage)}&size=medium`)
                            const blob = await response.blob()
                            const filename = selectedImage.split('/').pop()
                            const nameWithoutExt = filename.split('.').slice(0, -1).join('.')
                            saveAs(blob, `${nameWithoutExt}-medium.jpg`)
                          } catch (error) {
                            console.error('Download failed:', error)
                            // Fallback to original
                            const response = await fetch(`/assets/${selectedImage}`)
                            const blob = await response.blob()
                            saveAs(blob, `medium-${selectedImage.split('/').pop()}`)
                          }
                        }}
                      >
                        📥 Medium
                      </button>
                      <button 
                        className="download-btn large"
                        onClick={async () => {
                          try {
                            const response = await fetch(`http://localhost:3001/api/resize?image=${encodeURIComponent(selectedImage)}&size=large`)
                            const blob = await response.blob()
                            saveAs(blob, selectedImage.split('/').pop())
                          } catch (error) {
                            console.error('Download failed:', error)
                            // Fallback to original
                            const response = await fetch(`/assets/${selectedImage}`)
                            const blob = await response.blob()
                            saveAs(blob, selectedImage.split('/').pop())
                          }
                        }}
                      >
                        📥 Original
                      </button>
                      <button className="edit-btn" disabled title="Coming Soon">
                        ✏️ Edit
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="modal-info-section">
                  <div className="photo-details">
                    <h3>Photo Information</h3>
                    <div className="detail-row">
                      <span className="detail-label">Event:</span>
                      <span className="detail-value">{property.name} - {year} Party</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Date Taken:</span>
                      <span className="detail-value">
                        {new Date(party.date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="photo-rating">
                    <h4>Rating</h4>
                    <div className="star-rating">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          className={`star ${photoRatings[selectedImage] >= star ? 'filled' : ''}`}
                          onClick={() => {
                            setPhotoRatings(prev => ({
                              ...prev,
                              [selectedImage]: prev[selectedImage] === star ? 0 : star
                            }))
                          }}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="photo-tags">
                    <h4>Tags</h4>
                    <div className="tag-section">
                      <div className="tag-group">
                        <h5>Categories</h5>
                        <div className="tag-buttons">
                          {[
                            { emoji: '🍔', label: 'Food/Drink' },
                            { emoji: '🚚', label: 'Food Trucks' },
                            { emoji: '🐕', label: 'Dogs!' },
                            { emoji: '👶', label: 'Kids!' },
                            { emoji: '👨‍👩‍👧‍👦', label: 'Families' },
                            { emoji: '🎮', label: 'Games/Events' },
                            { emoji: '👔', label: 'Solhem Staff' },
                            { emoji: '🎵', label: 'Music' }
                          ].map(tag => (
                            <button
                              key={tag.label}
                              className={`tag-btn ${photoTags[selectedImage]?.includes(tag.label) ? 'active' : ''}`}
                              onClick={() => {
                                setPhotoTags(prev => {
                                  const currentTags = prev[selectedImage] || []
                                  const newTags = currentTags.includes(tag.label)
                                    ? currentTags.filter(t => t !== tag.label)
                                    : [...currentTags, tag.label]
                                  return { ...prev, [selectedImage]: newTags }
                                })
                              }}
                            >
                              {tag.emoji} {tag.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="tag-group">
                        <h5>Actions</h5>
                        <div className="tag-buttons">
                          {['Talking', 'Laughing', 'Posing', 'Candid'].map(tag => (
                            <button
                              key={tag}
                              className={`tag-btn ${photoTags[selectedImage]?.includes(tag) ? 'active' : ''}`}
                              onClick={() => {
                                setPhotoTags(prev => {
                                  const currentTags = prev[selectedImage] || []
                                  const newTags = currentTags.includes(tag)
                                    ? currentTags.filter(t => t !== tag)
                                    : [...currentTags, tag]
                                  return { ...prev, [selectedImage]: newTags }
                                })
                              }}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="tag-group">
                        <h5>Demographics</h5>
                        <div className="tag-buttons">
                          {['Male', 'Female', 'Older', 'Younger'].map(tag => (
                            <button
                              key={tag}
                              className={`tag-btn ${photoTags[selectedImage]?.includes(tag) ? 'active' : ''}`}
                              onClick={() => {
                                setPhotoTags(prev => {
                                  const currentTags = prev[selectedImage] || []
                                  const newTags = currentTags.includes(tag)
                                    ? currentTags.filter(t => t !== tag)
                                    : [...currentTags, tag]
                                  return { ...prev, [selectedImage]: newTags }
                                })
                              }}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="tag-group">
                        <h5>Location</h5>
                        <div className="tag-buttons">
                          {['Rooftop', 'Outdoor Terrace', 'Patio', 'Inside', 'Building', 'Fred'].map(tag => (
                            <button
                              key={tag}
                              className={`tag-btn ${photoTags[selectedImage]?.includes(tag) ? 'active' : ''}`}
                              onClick={() => {
                                setPhotoTags(prev => {
                                  const currentTags = prev[selectedImage] || []
                                  const newTags = currentTags.includes(tag)
                                    ? currentTags.filter(t => t !== tag)
                                    : [...currentTags, tag]
                                  return { ...prev, [selectedImage]: newTags }
                                })
                              }}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default EventDetail