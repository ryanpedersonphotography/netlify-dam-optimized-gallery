import { useState, useRef, useEffect } from 'react'
import './VideoPlayer.css'

const VideoPlayer = ({ video, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [videoBlob, setVideoBlob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const videoRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    // Check if video has a blob key (uploaded to Netlify Blobs)
    if (video.blobKey) {
      // Load from Netlify Blobs
      setVideoBlob(`/api/video-handler/stream?key=${encodeURIComponent(video.blobKey)}`)
      setLoading(false)
      setError(null)
    } else {
      // Show local file information
      setLoading(false)
      setError('Video preview mode - Click to see file information')
    }
  }, [video])

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
      setLoading(false)
    }
  }

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newTime = percentage * duration
    
    if (videoRef.current) {
      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!video) return null

  return (
    <div className="video-player-overlay" onClick={onClose}>
      <div 
        ref={containerRef}
        className={`video-player-container ${isFullscreen ? 'fullscreen' : ''}`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="video-header">
          <h3>{video.filename}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="video-wrapper">
          {loading && (
            <div className="video-loading">
              <div className="spinner"></div>
              <p>Loading video...</p>
            </div>
          )}
          
          {error ? (
            <div className="video-error">
              <div className="video-preview-icon">🎬</div>
              <h3>Video Information</h3>
              <div className="video-details">
                <p><strong>Filename:</strong> {video.filename}</p>
                <p><strong>Type:</strong> {video.type === 'drone' ? '🚁 Drone Video' : '🏢 Property Video'}</p>
                <p><strong>Location:</strong></p>
                <p className="video-path">{video.path}</p>
              </div>
              <p className="video-note">
                Video streaming requires server configuration. In production, videos would be served from a CDN or streaming service.
              </p>
              <button 
                className="download-video-btn"
                onClick={() => {
                  if (video.blobKey) {
                    // Download from Netlify Blobs
                    window.open(`/api/video-handler/download?key=${encodeURIComponent(video.blobKey)}`, '_blank')
                  } else {
                    // Show local path
                    alert(`To download this video, copy this path:\n\n${video.path}\n\nNote: Browser security prevents direct downloads from local file paths.`)
                  }
                }}
              >
                📥 Download Video
              </button>
            </div>
          ) : videoBlob && (
            <video
              ref={videoRef}
              src={videoBlob}
              className="video-element"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              onClick={togglePlay}
            />
          )}
        </div>
        
        {!error && (
          <div className="video-controls">
            <button className="play-btn" onClick={togglePlay}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            
            <div className="time-display">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
            
            <div className="progress-bar" onClick={handleSeek}>
              <div 
                className="progress-fill" 
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>
            
            <div className="volume-control">
              <span>🔊</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="volume-slider"
              />
            </div>
            
            <button className="fullscreen-btn" onClick={toggleFullscreen}>
              {isFullscreen ? '⏏' : '⛶'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default VideoPlayer