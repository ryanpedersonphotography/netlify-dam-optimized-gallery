import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import VideoGallery from './VideoGallery'
import VideoUploader from './VideoUploader'
import './PropertyDetail.css'

const PropertyDetail = ({ properties, suites }) => {
  const { id } = useParams()
  const [activeTab, setActiveTab] = useState('public')
  const [downloading, setDownloading] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [selectedAssets, setSelectedAssets] = useState([])
  const [selectionMode, setSelectionMode] = useState(false)
  
  const property = properties.find(p => p.id === id)
  const propertySuites = suites.filter(s => s.property === property?.address)
  
  if (!property) {
    return <div className="error">Property not found</div>
  }

  const getAssetPath = (asset) => `/assets/${property.folderName}/${asset}`

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

  const handleAssetClick = (asset) => {
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

  const downloadSelectedAssets = async () => {
    if (selectedAssets.length === 0) return
    
    setDownloading(true)
    const zip = new JSZip()
    const folder = zip.folder(`${property.address.replace(/\s+/g, '_')}_Selected`)
    
    try {
      for (const asset of selectedAssets) {
        const response = await fetch(getAssetPath(asset))
        const blob = await response.blob()
        const filename = asset.split('/').pop()
        folder.file(filename, blob)
      }
      
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `${property.address.replace(/\s+/g, '_')}_Selected_Assets.zip`)
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
    const propertyFolder = zip.folder(property.address.replace(/\s+/g, '_'))
    
    try {
      // Add video list file if videos exist
      if (property.assets.videos) {
        let videoListContent = '=== VIDEO FILES ===\n\n'
        
        if (property.assets.videos.drone && property.assets.videos.drone.length > 0) {
          videoListContent += 'DRONE VIDEOS:\n'
          property.assets.videos.drone.forEach(video => {
            videoListContent += `${video.filename}\n${video.path}\n\n`
          })
        }
        
        if (property.assets.videos.property && property.assets.videos.property.length > 0) {
          videoListContent += '\nPROPERTY VIDEOS:\n'
          property.assets.videos.property.forEach(video => {
            videoListContent += `${video.filename}\n${video.path}\n\n`
          })
        }
        
        videoListContent += '\nNote: Due to file size, videos are not included in the ZIP.\n'
        videoListContent += 'Use the paths above to manually copy video files.'
        
        propertyFolder.file('VIDEO_LIST.txt', videoListContent)
      }
      // Add public photos
      if (property.assets.public.length > 0) {
        const publicFolder = propertyFolder.folder('Public_Photos')
        for (const asset of property.assets.public) {
          const response = await fetch(getAssetPath(asset))
          const blob = await response.blob()
          const filename = asset.split('/').pop()
          publicFolder.file(filename, blob)
        }
      }

      // Add drone photos
      if (property.assets.drone.length > 0) {
        const droneFolder = propertyFolder.folder('Drone_Photos')
        for (const asset of property.assets.drone) {
          const response = await fetch(getAssetPath(asset))
          const blob = await response.blob()
          const filename = asset.split('/').pop()
          droneFolder.file(filename, blob)
        }
      }

      // Add suite photos
      for (const [suiteName, suiteAssets] of Object.entries(property.assets.suites)) {
        if (suiteAssets.length > 0) {
          const suiteFolder = propertyFolder.folder(`Suite_${suiteName}`)
          for (const asset of suiteAssets) {
            const response = await fetch(getAssetPath(asset))
            const blob = await response.blob()
            const filename = asset.split('/').pop()
            suiteFolder.file(filename, blob)
          }
        }
      }
      
      // Generate and download zip
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `${property.address.replace(/\s+/g, '_')}_All_Assets.zip`)
    } catch (error) {
      console.error('Error downloading assets:', error)
      alert('Error downloading assets. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="property-detail">
      <div className="breadcrumb">
        <Link to="/">← Back to Properties</Link>
      </div>
      
      <div className="property-header">
        <div className="property-title-section">
          <h1>{property.address}</h1>
          <div className="property-stats">
            <span>{propertySuites.length} suites</span>
            <span>{property.assets.public.length} public photos</span>
            <span>{property.assets.drone.length} drone photos</span>
            {property.assets.videos && (
              <>
                {property.assets.videos.drone?.length > 0 && (
                  <span>{property.assets.videos.drone.length} drone videos</span>
                )}
                {property.assets.videos.property?.length > 0 && (
                  <span>{property.assets.videos.property.length} property videos</span>
                )}
              </>
            )}
          </div>
        </div>
        <button 
          className="download-all-btn" 
          onClick={downloadAllAssets}
          disabled={downloading}
        >
          {downloading ? 'Downloading...' : 'Download All Assets'}
        </button>
      </div>

      <div className="content-sections">
        <section className="suites-section">
          <h2>Available Suites</h2>
          <div className="suites-grid">
            {propertySuites.map(suite => {
              // Extract number from "Suite 190" -> "190"
              const suiteNumber = suite.unit.replace(/^Suite\s+/, '')
              const suiteImages = property.assets.suites[suiteNumber] || []
              const firstImage = suiteImages[0]
              
              return (
                <Link to={`/property/${id}/suite/${suite.unit}`} key={suite.unit} className="suite-card">
                  <div className="suite-image">
                    {firstImage ? (
                      <img src={getAssetPath(firstImage)} alt={`Suite ${suite.unit}`} />
                    ) : (
                      <div className="no-image">No Image</div>
                    )}
                  </div>
                  <div className="suite-info">
                    <h3>Suite {suite.unit}</h3>
                    <p className="suite-type">{suite.unitType}</p>
                    <p className="suite-sqft">{suite.sqft} sq ft</p>
                    <p className="suite-photos">{suiteImages.length} photos</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="assets-section">
          <div className="assets-header">
            <h2>Property Assets</h2>
            <div className="selection-controls">
              {!selectionMode ? (
                <button 
                  className="select-mode-btn"
                  onClick={() => setSelectionMode(true)}
                >
                  Select Assets
                </button>
              ) : (
                <>
                  <span className="selected-count">{selectedAssets.length} selected</span>
                  <button 
                    className="download-selected-btn"
                    onClick={downloadSelectedAssets}
                    disabled={selectedAssets.length === 0 || downloading}
                  >
                    {downloading ? 'Downloading...' : 'Download Selected'}
                  </button>
                  <button 
                    className="cancel-btn"
                    onClick={clearSelection}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="tabs">
            <button 
              className={activeTab === 'public' ? 'active' : ''} 
              onClick={() => setActiveTab('public')}
            >
              Public Photos ({property.assets.public.length})
            </button>
            <button 
              className={activeTab === 'drone' ? 'active' : ''} 
              onClick={() => setActiveTab('drone')}
            >
              Drone Photos ({property.assets.drone.length})
            </button>
          </div>
          
          <div className="asset-grid">
            {activeTab === 'public' && property.assets.public.map((asset, index) => (
              <div 
                key={index} 
                className={`asset-item ${selectionMode ? 'selectable' : ''} ${selectedAssets.includes(asset) ? 'selected' : ''}`} 
                onClick={() => handleAssetClick(asset)}
              >
                <img src={getAssetPath(asset)} alt={`Public ${index + 1}`} />
                {selectionMode && (
                  <div className="selection-overlay">
                    <input 
                      type="checkbox" 
                      checked={selectedAssets.includes(asset)}
                      onChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </div>
            ))}
            {activeTab === 'drone' && property.assets.drone.map((asset, index) => (
              <div 
                key={index} 
                className={`asset-item ${selectionMode ? 'selectable' : ''} ${selectedAssets.includes(asset) ? 'selected' : ''}`} 
                onClick={() => handleAssetClick(asset)}
              >
                <img src={getAssetPath(asset)} alt={`Drone ${index + 1}`} />
                {selectionMode && (
                  <div className="selection-overlay">
                    <input 
                      type="checkbox" 
                      checked={selectedAssets.includes(asset)}
                      onChange={() => {}}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
        
        {property.assets.videos && (
          <>
            {property.assets.videos.drone && property.assets.videos.drone.length > 0 && (
              <VideoGallery 
                videos={property.assets.videos.drone}
                title="Drone Videos"
              />
            )}
            
            {property.assets.videos.property && property.assets.videos.property.length > 0 && (
              <VideoGallery 
                videos={property.assets.videos.property}
                title="Property Videos"
              />
            )}
          </>
        )}
        
        <VideoUploader 
          propertyId={property.id} 
          onUploadComplete={(result) => {
            console.log('Video uploaded:', result);
            // You could refresh the property data here
            window.location.reload();
          }}
        />
      </div>

      {selectedImage && (
        <div className="lightbox" onClick={() => setSelectedImage(null)}>
          <img src={getAssetPath(selectedImage)} alt="Full size" />
          <button className="close-btn" onClick={() => setSelectedImage(null)}>×</button>
        </div>
      )}
    </div>
  )
}

export default PropertyDetail