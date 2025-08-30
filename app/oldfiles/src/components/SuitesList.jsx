import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import './SuitesList.css'

// Mini Gallery Component
const MiniGallery = ({ images, folderName, propertyId, suiteId, isDroneShot = false }) => {
  // Always start with index 0 which should be the best/first image
  const [currentIndex, setCurrentIndex] = useState(0)
  const galleryRef = useRef(null)

  if (!images || images.length === 0) {
    return (
      <div className="mini-gallery no-images">
        <span>No images available</span>
      </div>
    )
  }

  const handlePrev = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
  }

  const handleNext = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
  }

  const handleThumbnailClick = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    setCurrentIndex(index)
  }

  return (
    <div className="mini-gallery" ref={galleryRef}>
      <div className="gallery-main">
        <img 
          src={`/assets/${folderName}/${images[currentIndex]}`} 
          alt={`Suite ${suiteId} - Image ${currentIndex + 1}`}
          className="main-image"
        />
        {images.length > 1 && (
          <>
            <button className="gallery-nav prev" onClick={handlePrev}>‹</button>
            <button className="gallery-nav next" onClick={handleNext}>›</button>
            <div className="image-counter">{currentIndex + 1} / {images.length}</div>
          </>
        )}
        {isDroneShot && (
          <div className="drone-indicator">Drone View</div>
        )}
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbnails">
          {images.slice(0, 5).map((image, index) => (
            <img
              key={index}
              src={`/assets/${folderName}/${image}`}
              alt={`Thumbnail ${index + 1}`}
              className={`thumbnail ${currentIndex === index ? 'active' : ''}`}
              onClick={(e) => handleThumbnailClick(e, index)}
            />
          ))}
          {images.length > 5 && (
            <Link 
              to={`/property/${propertyId}/suite/${suiteId}`}
              className="more-images"
              onClick={(e) => e.stopPropagation()}
            >
              +{images.length - 5} more
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

const SuitesList = ({ properties, suites }) => {
  const [filters, setFilters] = useState({
    propertyAddress: 'all',
    status: 'all',
    unitType: 'all',
    minSqft: '',
    maxSqft: '',
    sortBy: 'property', // property, unit, sqft, status
    hideNoImages: true,
    groupByProperty: true
  })

  // Get unique property addresses
  const propertyAddresses = [...new Set(suites.map(s => s.property))].sort()
  
  // Get unique unit types
  const unitTypes = [...new Set(suites.map(s => s.unitType).filter(Boolean))].sort()
  
  // Get unique statuses
  const statuses = [...new Set(suites.map(s => s.status).filter(Boolean))].sort()

  // Filter suites based on active filters
  const filteredSuites = suites.filter(suite => {
    // Hide suites without images
    if (filters.hideNoImages) {
      const property = properties.find(p => p.address === suite.property)
      const suiteImages = property?.assets?.suites?.[suite.unit] || []
      const droneImages = property?.assets?.drone || []
      // Only hide if no suite images AND no drone images
      if (suiteImages.length === 0 && droneImages.length === 0) {
        return false
      }
    }
    
    // Property filter
    if (filters.propertyAddress !== 'all' && suite.property !== filters.propertyAddress) {
      return false
    }
    
    // Status filter
    if (filters.status !== 'all' && suite.status !== filters.status) {
      return false
    }
    
    // Unit type filter
    if (filters.unitType !== 'all' && suite.unitType !== filters.unitType) {
      return false
    }
    
    // Square footage filter
    if (filters.minSqft || filters.maxSqft) {
      const sqft = parseInt(suite.sqft) || 0
      const minSqft = parseInt(filters.minSqft) || 0
      const maxSqft = parseInt(filters.maxSqft) || Number.MAX_SAFE_INTEGER
      
      if (sqft < minSqft || sqft > maxSqft) {
        return false
      }
    }
    
    return true
  })

  // Sort suites
  const sortedSuites = [...filteredSuites].sort((a, b) => {
    switch (filters.sortBy) {
      case 'property':
        return a.property.localeCompare(b.property)
      case 'unit':
        return a.unit.localeCompare(b.unit)
      case 'sqft':
        return (parseInt(b.sqft) || 0) - (parseInt(a.sqft) || 0)
      case 'status':
        return (a.status || '').localeCompare(b.status || '')
      default:
        return 0
    }
  })

  // Get property info for a suite
  const getPropertyInfo = (suiteProperty) => {
    return properties.find(p => p.address === suiteProperty)
  }

  // Get vacancy class
  const getVacancyClass = (status) => {
    if (!status) return ''
    const lowerStatus = status.toLowerCase()
    if (lowerStatus.includes('vacant') || lowerStatus.includes('unrented')) {
      return 'vacant'
    }
    return 'occupied'
  }

  // Calculate summary stats
  const totalSqft = sortedSuites.reduce((sum, suite) => sum + (parseInt(suite.sqft) || 0), 0)
  const vacantSuites = sortedSuites.filter(s => 
    s.status && (s.status.toLowerCase().includes('vacant') || s.status.toLowerCase().includes('unrented'))
  ).length
  const occupiedSuites = sortedSuites.length - vacantSuites

  // Group suites by property if enabled
  const groupedSuites = filters.groupByProperty 
    ? sortedSuites.reduce((acc, suite) => {
        const property = suite.property
        if (!acc[property]) {
          acc[property] = []
        }
        acc[property].push(suite)
        return acc
      }, {})
    : { 'All Suites': sortedSuites }

  // Download all suite assets
  const downloadSuiteAssets = async (suite, property) => {
    // Handle both "Suite 190" and "190" formats
    const suiteNumber = suite.unit.replace(/^Suite\s+/, '')
    const suiteImages = property?.assets?.suites?.[suiteNumber] || property?.assets?.suites?.[suite.unit] || []
    
    if (suiteImages.length === 0) {
      alert('No images available for this suite')
      return
    }

    const zip = new JSZip()
    const folder = zip.folder(`Suite-${suite.unit}-Assets`)

    // Download progress tracking
    let downloaded = 0
    const total = suiteImages.length

    try {
      // Create promises for all image downloads
      const downloadPromises = suiteImages.map(async (image, index) => {
        try {
          const response = await fetch(`/assets/${property.folderName}/${image}`)
          const blob = await response.blob()
          
          // Get file extension
          const extension = image.split('.').pop()
          const filename = `suite-${suite.unit}-${index + 1}.${extension}`
          
          folder.file(filename, blob)
          downloaded++
          
          // Update progress (you could add a progress indicator here)
          console.log(`Downloaded ${downloaded}/${total}`)
        } catch (error) {
          console.error(`Failed to download ${image}:`, error)
        }
      })

      // Wait for all downloads to complete
      await Promise.all(downloadPromises)

      // Generate the zip file
      const content = await zip.generateAsync({ type: 'blob' })
      
      // Save the zip file
      const propertyName = property.address.replace(/[^a-z0-9]/gi, '-').toLowerCase()
      saveAs(content, `${propertyName}-suite-${suite.unit}-assets.zip`)
    } catch (error) {
      console.error('Error creating zip file:', error)
      alert('Failed to download assets. Please try again.')
    }
  }

  return (
    <div className="suites-list">
      <div className="suites-header">
        <h1>All Suites</h1>
        <Link to="/" className="back-link">← Back to Properties</Link>
      </div>

      <div className="suites-summary">
        <div className="summary-card">
          <h3>{sortedSuites.length}</h3>
          <p>Total Suites</p>
        </div>
        <div className="summary-card">
          <h3>{totalSqft.toLocaleString()}</h3>
          <p>Total Sq Ft</p>
        </div>
        <div className="summary-card occupied">
          <h3>{occupiedSuites}</h3>
          <p>Occupied</p>
        </div>
        <div className="summary-card vacant">
          <h3>{vacantSuites}</h3>
          <p>Vacant</p>
        </div>
      </div>

      <div className="filters">
        <h2>Filters</h2>
        <div className="filter-controls">
          <div className="filter-row">
            <div className="filter-group">
              <label>Property:</label>
              <select 
                value={filters.propertyAddress}
                onChange={(e) => setFilters({...filters, propertyAddress: e.target.value})}
              >
                <option value="all">All Properties</option>
                {propertyAddresses.map(address => (
                  <option key={address} value={address}>{address}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Status:</label>
              <select 
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
              >
                <option value="all">All Statuses</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Unit Type:</label>
              <select 
                value={filters.unitType}
                onChange={(e) => setFilters({...filters, unitType: e.target.value})}
              >
                <option value="all">All Types</option>
                {unitTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="filter-row">
            <div className="filter-group">
              <label>Square Footage:</label>
              <input 
                type="number" 
                placeholder="Min"
                value={filters.minSqft}
                onChange={(e) => setFilters({...filters, minSqft: e.target.value})}
                min="0"
                style={{width: '80px'}}
              />
              <span> - </span>
              <input 
                type="number" 
                placeholder="Max"
                value={filters.maxSqft}
                onChange={(e) => setFilters({...filters, maxSqft: e.target.value})}
                min="0"
                style={{width: '80px'}}
              />
            </div>
            
            <div className="filter-group">
              <label>Sort By:</label>
              <select 
                value={filters.sortBy}
                onChange={(e) => setFilters({...filters, sortBy: e.target.value})}
              >
                <option value="property">Property</option>
                <option value="unit">Unit Number</option>
                <option value="sqft">Square Footage</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
          
          <div className="filter-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filters.hideNoImages}
                onChange={(e) => setFilters({...filters, hideNoImages: e.target.checked})}
              />
              Hide suites without images
            </label>
            
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={filters.groupByProperty}
                onChange={(e) => setFilters({...filters, groupByProperty: e.target.checked})}
              />
              Group by property
            </label>
          </div>
        </div>
      </div>

      <div className="suites-container">
        {Object.entries(groupedSuites).map(([propertyAddress, propertySuites]) => {
          if (propertySuites.length === 0) return null
          
          const propertyInfo = getPropertyInfo(propertyAddress)
          const propertyVacant = propertySuites.filter(s => 
            s.status && (s.status.toLowerCase().includes('vacant') || s.status.toLowerCase().includes('unrented'))
          ).length
          const propertyOccupied = propertySuites.length - propertyVacant
          
          return (
            <div key={propertyAddress} className="property-group">
              {filters.groupByProperty && (
                <div className="property-group-header">
                  <h2 className="property-group-title">
                    <Link to={`/property/${propertyInfo?.id}`} className="property-group-link">
                      {propertyAddress}
                    </Link>
                  </h2>
                  <div className="property-group-stats">
                    <span className="stat">{propertySuites.length} suites</span>
                    <span className="stat occupied">{propertyOccupied} occupied</span>
                    <span className="stat vacant">{propertyVacant} vacant</span>
                  </div>
                </div>
              )}
              
              <div className="suites-grid">
                {propertySuites.map((suite, index) => {
                  const property = getPropertyInfo(suite.property)
                  // Get suite images - handle both "Suite 190" and "190" formats
                  const suiteNumber = suite.unit.replace(/^Suite\s+/, '')
                  const suiteImages = property?.assets?.suites?.[suiteNumber] || property?.assets?.suites?.[suite.unit] || []
                  
                  // If no suite images, try to use drone shots as fallback
                  let displayImages = suiteImages
                  if (suiteImages.length === 0 && property?.assets?.drone?.length > 0) {
                    displayImages = property.assets.drone.slice(0, 3) // Use first 3 drone shots
                  }
                  
                  return (
                    <div key={`${suite.property}-${suite.unit}-${index}`} className="suite-card">
                      <div className="suite-gallery-section">
                        <MiniGallery 
                          images={displayImages}
                          folderName={property?.folderName}
                          propertyId={property?.id}
                          suiteId={suite.unit}
                          isDroneShot={suiteImages.length === 0 && displayImages.length > 0}
                        />
                      </div>
                      
                      <div className="suite-info">
                        <div className="suite-header">
                          <h3 className="unit-number">Suite {suite.unit}</h3>
                          <span className={`status-badge ${getVacancyClass(suite.status)}`}>
                            {suite.status || 'Unknown'}
                          </span>
                        </div>
                        
                        {!filters.groupByProperty && (
                          <Link to={`/property/${property?.id}`} className="property-link">
                            {suite.property}
                          </Link>
                        )}
                        
                        <div className="suite-details">
                          <div className="detail-item">
                            <span className="detail-label">Type:</span>
                            <span className="detail-value">{suite.unitType || 'N/A'}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Size:</span>
                            <span className="detail-value">{parseInt(suite.sqft).toLocaleString() || 'N/A'} sq ft</span>
                          </div>
                        </div>
                        
                        <div className="suite-actions">
                          {property && (
                            <>
                              <Link 
                                to={`/property/${property.id}/suite/${suite.unit}`} 
                                className="view-link"
                              >
                                View Full Details →
                              </Link>
                              {suiteImages.length > 0 && (
                                <button
                                  className="download-button"
                                  onClick={() => downloadSuiteAssets(suite, property)}
                                  title={`Download ${suiteImages.length} images`}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                  Download Assets ({suiteImages.length})
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        
        {sortedSuites.length === 0 && (
          <div className="no-results">
            No suites match the selected filters
          </div>
        )}
      </div>
    </div>
  )
}

export default SuitesList