'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { VideoCameraIcon, PlayIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import VideoPlayer from './VideoPlayer'

interface Video {
  id: string
  filename: string
  path: string
  thumbnailUrl?: string
  size?: number
  duration?: number
  metadata?: {
    width?: number
    height?: number
    format?: string
  }
}

interface VideoGalleryProps {
  propertyId: string
  folderName: string
  videos?: Video[]
}

export default function VideoGallery({ 
  propertyId, 
  folderName, 
  videos = [] 
}: VideoGalleryProps) {
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null)
  const [videoList, setVideoList] = useState<Video[]>(videos)
  const [loading, setLoading] = useState(false)

  // Load videos from API when component mounts
  useEffect(() => {
    if (videos.length === 0) {
      loadVideos()
    }
  }, [propertyId, folderName])

  const loadVideos = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/videos/${propertyId}`)
      if (response.ok) {
        const data = await response.json()
        setVideoList(data.videos || [])
      }
    } catch (error) {
      console.error('Failed to load videos:', error)
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  const downloadVideoList = useCallback(() => {
    if (videoList.length === 0) return
    
    const videoListText = videoList
      .map(video => `${video.filename}\n${video.path}\n`)
      .join('\n')
    
    const blob = new Blob([videoListText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `${folderName.replace(/\s+/g, '_')}_video_list.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [videoList, folderName])

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown duration'
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center py-8">
          <VideoCameraIcon className="w-8 h-8 text-gray-400 animate-pulse mr-3" />
          <span className="text-gray-600">Loading videos...</span>
        </div>
      </div>
    )
  }

  if (videoList.length === 0) {
    return null
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <VideoCameraIcon className="w-6 h-6 text-blue-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">
                Videos ({videoList.length})
              </h3>
            </div>
            
            <button
              onClick={downloadVideoList}
              className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              Download List
            </button>
          </div>
        </div>

        {/* Video Grid */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videoList.map((video, index) => (
              <div 
                key={video.id || index}
                className="bg-gray-50 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Video Thumbnail */}
                <div 
                  className="relative aspect-video bg-gray-200 cursor-pointer group"
                  onClick={() => setSelectedVideo(video)}
                >
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.filename}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full">
                      <VideoCameraIcon className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                  
                  {/* Play overlay */}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center">
                    <div className="bg-white bg-opacity-90 rounded-full p-3 opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all duration-300">
                      <PlayIcon className="w-6 h-6 text-gray-900" />
                    </div>
                  </div>
                </div>

                {/* Video Info */}
                <div className="p-4">
                  <h4 className="font-medium text-gray-900 truncate mb-2">
                    {video.filename}
                  </h4>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span>{formatFileSize(video.size)}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span>Duration:</span>
                      <span>{formatDuration(video.duration)}</span>
                    </div>
                    
                    {video.metadata?.format && (
                      <div className="flex justify-between">
                        <span>Format:</span>
                        <span className="uppercase">{video.metadata.format}</span>
                      </div>
                    )}
                    
                    {video.metadata?.width && video.metadata?.height && (
                      <div className="flex justify-between">
                        <span>Resolution:</span>
                        <span>{video.metadata.width}×{video.metadata.height}</span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex space-x-2 mt-4">
                    <button
                      onClick={() => setSelectedVideo(video)}
                      className="flex-1 bg-blue-600 text-white text-sm font-medium py-2 px-3 rounded-md hover:bg-blue-700 transition-colors"
                    >
                      Play
                    </button>
                    
                    <a
                      href={video.path}
                      download={video.filename}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 bg-gray-200 text-gray-700 text-sm font-medium py-2 px-3 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      <ArrowDownTrayIcon className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Video Player Modal */}
      {selectedVideo && (
        <VideoPlayer
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </>
  )
}