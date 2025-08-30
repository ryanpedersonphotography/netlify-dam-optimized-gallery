import { useState } from 'react'
import './VideoUploader.css'

const VideoUploader = ({ propertyId, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState(null)
  const [videoType, setVideoType] = useState('drone')
  const [error, setError] = useState(null)

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file && file.type.startsWith('video/')) {
      setSelectedFile(file)
      setError(null)
    } else {
      setError('Please select a valid video file')
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a video file')
      return
    }

    // Check file size (5GB limit for Netlify Blobs)
    const maxSize = 5 * 1024 * 1024 * 1024 // 5GB
    if (selectedFile.size > maxSize) {
      setError('Video file must be under 5GB')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('video', selectedFile)
      formData.append('propertyId', propertyId)
      formData.append('videoType', videoType)
      formData.append('filename', selectedFile.name)

      const response = await fetch('/api/video-handler/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const result = await response.json()
      
      // Reset form
      setSelectedFile(null)
      setUploadProgress(0)
      
      // Notify parent component
      if (onUploadComplete) {
        onUploadComplete(result)
      }
      
      alert('Video uploaded successfully!')
    } catch (err) {
      console.error('Upload error:', err)
      setError('Failed to upload video. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="video-uploader">
      <h3>Upload Video</h3>
      
      <div className="upload-controls">
        <div className="video-type-selector">
          <label>
            <input
              type="radio"
              value="drone"
              checked={videoType === 'drone'}
              onChange={(e) => setVideoType(e.target.value)}
            />
            🚁 Drone Video
          </label>
          <label>
            <input
              type="radio"
              value="property"
              checked={videoType === 'property'}
              onChange={(e) => setVideoType(e.target.value)}
            />
            🏢 Property Video
          </label>
        </div>

        <div className="file-input-wrapper">
          <input
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            disabled={uploading}
            id="video-file-input"
          />
          <label htmlFor="video-file-input" className="file-input-label">
            {selectedFile ? selectedFile.name : 'Choose Video File'}
          </label>
        </div>

        {selectedFile && (
          <div className="file-info">
            <p>Size: {formatFileSize(selectedFile.size)}</p>
            {selectedFile.size > 5 * 1024 * 1024 * 1024 && (
              <p className="error">File exceeds 5GB limit</p>
            )}
          </div>
        )}

        {error && (
          <div className="error-message">{error}</div>
        )}

        {uploading && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p>Uploading... {uploadProgress}%</p>
          </div>
        )}

        <button
          className="upload-button"
          onClick={handleUpload}
          disabled={!selectedFile || uploading || selectedFile.size > 5 * 1024 * 1024 * 1024}
        >
          {uploading ? 'Uploading...' : 'Upload Video'}
        </button>
      </div>

      <div className="upload-info">
        <p className="info-text">
          <strong>Note:</strong> Videos are stored in Netlify Blobs with a 5GB file size limit.
          Large videos may take several minutes to upload.
        </p>
      </div>
    </div>
  )
}

export default VideoUploader