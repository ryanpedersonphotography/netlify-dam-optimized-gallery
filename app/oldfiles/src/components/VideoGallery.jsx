import { useState } from 'react'
import VideoPlayer from './VideoPlayer'
import './VideoGallery.css'

const VideoGallery = ({ videos, title }) => {
  const [selectedVideo, setSelectedVideo] = useState(null)
  
  if (!videos || videos.length === 0) {
    return null
  }

  const downloadAllVideos = () => {
    // Create a text file with all video paths
    const videoList = videos.map(video => `${video.filename}\n${video.path}\n`).join('\n')
    const blob = new Blob([videoList], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `${title.replace(/\s+/g, '_')}_video_list.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    alert(`Video list downloaded!\n\nThis file contains paths to all ${videos.length} videos.\nYou can use these paths to manually copy the video files.`)
  }

  return (
    <div className="video-gallery">
      <div className="video-gallery-header">
        <h3>{title}</h3>
        <button className="download-all-videos-btn" onClick={downloadAllVideos}>
          📥 Download Video List ({videos.length})
        </button>
      </div>
      <div className="video-grid">
        {videos.map((video, index) => (
          <div 
            key={index} 
            className="video-thumbnail"
            onClick={() => setSelectedVideo(video)}
          >
            <div className="video-icon">🎬</div>
            <div className="video-info">
              <p className="video-name">{video.filename}</p>
              <p className="video-type">{video.type === 'drone' ? '🚁 Drone' : '🏢 Property'}</p>
            </div>
          </div>
        ))}
      </div>
      
      {selectedVideo && (
        <VideoPlayer
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </div>
  )
}

export default VideoGallery