import { useParams, Link } from 'react-router-dom'
import { useState } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import './SuiteDetail.css'

const SuiteDetail = ({ properties, suites }) => {
  const { propertyId, suiteId } = useParams()
  const [downloading, setDownloading] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)
  const [selectedAssets, setSelectedAssets] = useState([])
  const [selectionMode, setSelectionMode] = useState(false)
  
  const property = properties.find(p => p.id === propertyId)
  const suite = suites.find(s => s.property === property?.address && s.unit === suiteId)
  // Extract number from "Suite 190" -> "190" for asset lookup
  const suiteNumber = suiteId.replace(/^Suite\s+/, '')
  const suiteAssets = property?.assets.suites[suiteNumber] || []
  
  if (!property || !suite) {
    return <div className="error">Suite not found</div>
  }

  const getAssetPath = (asset) => `/assets/${property.folderName}/${asset}`

  const downloadAllAssets = async () => {
    setDownloading(true)
    const zip = new JSZip()
    const folder = zip.folder(`${property.address}_Suite_${suiteId}`)
    
    try {
      // Download each image and add to zip
      for (const asset of suiteAssets) {
        const response = await fetch(getAssetPath(asset))
        const blob = await response.blob()
        const filename = asset.split('/').pop()
        folder.file(filename, blob)
      }
      
      // Generate and download zip
      const content = await zip.generateAsync({ type: 'blob' })
      saveAs(content, `${property.address.replace(/\s+/g, '_')}_Suite_${suiteId}.zip`)
    } catch (error) {
      console.error('Error downloading assets:', error)
      alert('Error downloading assets. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="suite-detail">
      <div className="breadcrumb">
        <Link to="/">Properties</Link>
        <span> / </span>
        <Link to={`/property/${propertyId}`}>{property.address}</Link>
        <span> / Suite {suiteId}</span>
      </div>
      
      <div className="suite-header">
        <div>
          <h1>Suite {suite.unit}</h1>
          <p className="address">{property.address}</p>
        </div>
        <button 
          className="download-btn" 
          onClick={downloadAllAssets}
          disabled={downloading || suiteAssets.length === 0}
        >
          {downloading ? 'Downloading...' : `Download All (${suiteAssets.length} files)`}
        </button>
      </div>

      <div className="suite-details">
        <div className="detail-card">
          <h3>Suite Information</h3>
          <dl>
            <dt>Type:</dt>
            <dd>{suite.unitType}</dd>
            <dt>Square Footage:</dt>
            <dd>{suite.sqft} sq ft</dd>
            <dt>Status:</dt>
            <dd>{suite.status}</dd>
            <dt>Total Assets:</dt>
            <dd>{suiteAssets.length} photos</dd>
          </dl>
        </div>
      </div>

      <div className="suite-assets">
        <h2>Suite Assets ({suiteAssets.length})</h2>
        {suiteAssets.length > 0 ? (
          <div className="asset-gallery">
            {suiteAssets.map((asset, index) => (
              <div 
                key={index} 
                className="gallery-item"
                onClick={() => setSelectedImage(asset)}
              >
                <img src={getAssetPath(asset)} alt={`Suite ${suiteId} - ${index + 1}`} />
                <div className="asset-name">{asset.split('/').pop()}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-assets">No assets available for this suite</p>
        )}
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

export default SuiteDetail