import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
// import L from 'leaflet'
// import 'leaflet/dist/leaflet.css'
import './PropertyList.css'

// // Fix for default markers
// import icon from 'leaflet/dist/images/marker-icon.png'
// import iconShadow from 'leaflet/dist/images/marker-shadow.png'

// let DefaultIcon = L.icon({
//   iconUrl: icon,
//   shadowUrl: iconShadow,
//   iconSize: [25, 41],
//   iconAnchor: [12, 41],
//   popupAnchor: [1, -34],
//   shadowSize: [41, 41]
// })

// L.Marker.prototype.options.icon = DefaultIcon

const PropertyList = ({ properties, viewMode = 'parties' }) => {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [filters, setFilters] = useState({
    assetType: 'parties',
    year: 'all',
    property: 'all'
  })

  // Determine region based on city in address
  const getRegion = (address) => {
    const city = address.split(' ').slice(-1)[0].toLowerCase()
    
    // Northern suburbs
    if (['minneapolis', 'brooklyn', 'fridley', 'columbia', 'anoka'].includes(city)) {
      return 'Minneapolis/North Metro'
    }
    
    // Southern suburbs
    if (['bloomington', 'edina', 'richfield', 'burnsville', 'eagan'].includes(city)) {
      return 'South Metro'
    }
    
    // Western suburbs
    if (['minnetonka', 'eden', 'hopkins', 'st.', 'plymouth', 'wayzata'].includes(city)) {
      return 'West Metro'
    }
    
    // Northwestern suburbs
    if (['loretto', 'maple', 'osseo', 'champlin'].includes(city)) {
      return 'Northwest Metro'
    }
    
    // Special case for Loretto
    if (address.toLowerCase().includes('loretto')) {
      return 'Northwest Metro'
    }
    
    // Special case for St. Louis Park
    if (address.toLowerCase().includes('st. louis park') || address.includes('St Louis Park')) {
      return 'West Metro'
    }
    
    return 'Other'
  }

  // Get unique regions
  const regions = [...new Set(properties.map(p => getRegion(p.address)))].sort()

  // Determine property type for commercial real estate
  const getPropertyType = (property) => {
    const address = property.address.toLowerCase()
    
    // Check if it's primarily office based on suite info
    if (suites) {
      const propertySuites = suites.filter(s => s.property === property.address)
      const hasOffice = propertySuites.some(s => s.unitType && s.unitType.toLowerCase().includes('office'))
      if (hasOffice) return 'office'
    }
    
    // Industrial/warehouse indicators
    if (address.includes('feltl') || address.includes('industrial')) {
      return 'industrial'
    }
    
    // Retail indicators
    if (property.suites.length > 5) {
      return 'retail'
    }
    
    // Office park indicators
    if (address.includes('ave') && property.suites.length > 2) {
      return 'office'
    }
    
    return 'mixed-use'
  }

  // Calculate total square footage for a property
  const getTotalSqft = (property) => {
    if (!suites) return 0
    const propertySuites = suites.filter(s => s.property === property.address)
    return propertySuites.reduce((total, suite) => {
      const sqft = parseInt(suite.sqft) || 0
      return total + sqft
    }, 0)
  }

  // Calculate vacancy rate for a property
  const getVacancyInfo = (property) => {
    if (!suites || property.suites.length === 0) return null
    
    const propertySuites = suites.filter(s => s.property === property.address)
    const vacantSuites = propertySuites.filter(s => 
      s.status && (s.status.toLowerCase().includes('vacant') || s.status.toLowerCase().includes('unrented'))
    )
    
    const totalSuites = propertySuites.length
    const vacantCount = vacantSuites.length
    const occupiedCount = totalSuites - vacantCount
    
    if (totalSuites === 0) return null
    
    const vacancyRate = Math.round((vacantCount / totalSuites) * 100)
    
    return {
      total: totalSuites,
      vacant: vacantCount,
      occupied: occupiedCount,
      rate: vacancyRate,
      status: vacancyRate === 0 ? 'Fully Occupied' : 
              vacancyRate === 100 ? 'Fully Vacant' : 
              `${vacancyRate}% Vacant`
    }
  }

  // Filter properties based on active filters
  const filteredProperties = properties.filter(property => {
    if (filters.hideEmpty) {
      const hasAssets = property.assets.drone.length > 0 || property.assets.public.length > 0
      const hasSuites = property.suites.length > 0
      if (!hasAssets && !hasSuites) return false
    }
    
    if (filters.hideNoSuites && property.suites.length === 0) {
      return false
    }
    
    if (filters.hideNoAssets) {
      const hasAssets = property.assets.drone.length > 0 || property.assets.public.length > 0
      if (!hasAssets) return false
    }
    
    // Region filter
    if (filters.selectedRegion !== 'all') {
      if (getRegion(property.address) !== filters.selectedRegion) return false
    }
    
    // Square footage filter
    if (filters.minSqft || filters.maxSqft) {
      const totalSqft = getTotalSqft(property)
      const minSqft = parseInt(filters.minSqft) || 0
      const maxSqft = parseInt(filters.maxSqft) || Number.MAX_SAFE_INTEGER
      
      if (totalSqft < minSqft || totalSqft > maxSqft) {
        return false
      }
    }
    
    // Property type filter
    if (filters.propertyType !== 'all') {
      if (getPropertyType(property) !== filters.propertyType) return false
    }
    
    // Vacancy status filter
    if (filters.vacancyStatus !== 'all') {
      const vacancyInfo = getVacancyInfo(property)
      if (!vacancyInfo) return false
      
      if (filters.vacancyStatus === 'occupied' && vacancyInfo.rate !== 0) return false
      if (filters.vacancyStatus === 'vacant' && vacancyInfo.rate !== 100) return false
      if (filters.vacancyStatus === 'partial' && (vacancyInfo.rate === 0 || vacancyInfo.rate === 100)) return false
    }
    
    return true
  })

  useEffect(() => {
    // Map disabled for now - Leaflet import issue
    return
    // if (!mapRef.current || mapInstanceRef.current) return

    // // Initialize map
    // const map = L.map(mapRef.current).setView([44.9778, -93.2650], 10)
    // mapInstanceRef.current = map

    // // Add tile layer
    // L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    //   attribution: '© OpenStreetMap contributors'
    // }).addTo(map)

    // // Add markers for each filtered property
    // filteredProperties.forEach(property => {
    //   if (property.coordinates) {
    //     const marker = L.marker([property.coordinates.lat, property.coordinates.lng])
    //       .addTo(map)
    //       .bindPopup(`
    //         <div class="map-popup">
    //           <h3>${property.address}</h3>
    //           <p>${property.suites.length} suites</p>
    //           <a href="/property/${property.id}">View Details</a>
    //         </div>
    //       `)
    //   }
    // })

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [filteredProperties])

  return (
    <div className="property-list">
      <div className="map-container">
        <div ref={mapRef} className="map"></div>
      </div>
      
      <div className="property-grid">
        <div className="filters">
          <h2>Properties ({filteredProperties.length} of {properties.length})</h2>
          {(() => {
            // Calculate overall vacancy stats
            let totalVacant = 0
            let totalOccupied = 0
            let partialVacant = 0
            
            properties.forEach(property => {
              const vacancyInfo = getVacancyInfo(property)
              if (vacancyInfo) {
                if (vacancyInfo.rate === 0) totalOccupied++
                else if (vacancyInfo.rate === 100) totalVacant++
                else partialVacant++
              }
            })
            
            return (
              <div className="vacancy-summary">
                <span className="summary-item occupied">{totalOccupied} Fully Occupied</span>
                <span className="summary-item partial">{partialVacant} Partially Vacant</span>
                <span className="summary-item vacant">{totalVacant} Fully Vacant</span>
              </div>
            )
          })()}
          <div className="filter-controls">
            <div className="filter-row">
              <label>
                <input
                  type="checkbox"
                  checked={filters.hideEmpty}
                  onChange={(e) => setFilters({...filters, hideEmpty: e.target.checked})}
                />
                Hide empty properties
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={filters.hideNoSuites}
                  onChange={(e) => setFilters({...filters, hideNoSuites: e.target.checked})}
                />
                Hide properties without suites
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={filters.hideNoAssets}
                  onChange={(e) => setFilters({...filters, hideNoAssets: e.target.checked})}
                />
                Hide properties without assets
              </label>
            </div>
            
            <div className="filter-row">
              <div className="filter-group">
                <label>Region:</label>
                <select 
                  value={filters.selectedRegion}
                  onChange={(e) => setFilters({...filters, selectedRegion: e.target.value})}
                >
                  <option value="all">All Regions</option>
                  {regions.map(region => (
                    <option key={region} value={region}>{region}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label>Property Type:</label>
                <select 
                  value={filters.propertyType}
                  onChange={(e) => setFilters({...filters, propertyType: e.target.value})}
                >
                  <option value="all">All Types</option>
                  <option value="office">Office</option>
                  <option value="retail">Retail</option>
                  <option value="industrial">Industrial/Warehouse</option>
                  <option value="mixed-use">Mixed Use</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Total Sq Ft:</label>
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
                <label>Vacancy Status:</label>
                <select 
                  value={filters.vacancyStatus}
                  onChange={(e) => setFilters({...filters, vacancyStatus: e.target.value})}
                >
                  <option value="all">All Properties</option>
                  <option value="occupied">Fully Occupied</option>
                  <option value="partial">Partially Vacant</option>
                  <option value="vacant">Fully Vacant</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="grid">
          {filteredProperties.map(property => {
            const mainImage = property.assets.public[0] || property.assets.drone[0]
            const imagePath = mainImage ? `/assets/${property.folderName}/${mainImage}` : null
            
            return (
              <Link to={`/property/${property.id}`} key={property.id} className="property-card">
                <div className="property-image">
                  {imagePath ? (
                    <img src={imagePath} alt={property.address} />
                  ) : (
                    <div className="no-image">No Image Available</div>
                  )}
                </div>
                <div className="property-info">
                  <h3>{property.address}</h3>
                  <div className="property-badges">
                    <div className="property-type-badge">{getPropertyType(property).replace('-', ' ')}</div>
                    {(() => {
                      const vacancyInfo = getVacancyInfo(property)
                      if (vacancyInfo) {
                        return (
                          <div className={`vacancy-badge ${
                            vacancyInfo.rate === 0 ? 'occupied' : 
                            vacancyInfo.rate === 100 ? 'vacant' : 
                            'partial'
                          }`}>
                            {vacancyInfo.status}
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                  <p className="suite-count">{property.suites.length} suites available</p>
                  {getTotalSqft(property) > 0 && (
                    <p className="sqft-info">{getTotalSqft(property).toLocaleString()} sq ft total</p>
                  )}
                  <div className="asset-counts">
                    <span>{property.assets.public.length} public photos</span>
                    <span>{property.assets.drone.length} drone photos</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default PropertyList