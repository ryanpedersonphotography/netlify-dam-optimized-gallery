'use client'

import React, { useRef, useEffect, useState } from 'react'
import { XMarkIcon, PlayIcon, PauseIcon, SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/react/24/outline'

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

interface VideoPlayerProps {
  video: Video
  onClose: () => void
}

export default function VideoPlayer({ video, onClose }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [showControls, setShowControls] = useState(true)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => setCurrentTime(video.currentTime)
    const handleLoadedMetadata = () => setDuration(video.duration)
    const handleEnded = () => setIsPlaying(false)

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('ended', handleEnded)
    }
  }, [])

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'Escape':
          onClose()
          break
        case 'm':
        case 'M':
          toggleMute()
          break
        case 'f':
        case 'F':
          toggleFullscreen()
          break
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [])

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return

    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return

    const newVolume = parseFloat(e.target.value)
    video.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return

    const newTime = parseFloat(e.target.value)
    video.currentTime = newTime
    setCurrentTime(newTime)
  }

  const toggleFullscreen = () => {
    const video = videoRef.current
    if (!video) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      video.requestFullscreen()
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null)

  const handleMouseMove = () => {
    setShowControls(true)
    if (hideControlsTimer.current) {
      clearTimeout(hideControlsTimer.current)
    }
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)
  }

  return (
    <div 
      className="fixed inset-0 bg-black z-50 flex items-center justify-center"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className={`absolute top-4 right-4 z-60 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-all ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <XMarkIcon className="w-6 h-6" />
      </button>

      {/* Video element */}
      <video
        ref={videoRef}
        src={video.path}
        className="max-w-full max-h-full object-contain cursor-pointer"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* Video info */}
      <div className={`absolute top-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded-lg transition-opacity ${
        showControls ? 'opacity-100' : 'opacity-0'
      }`}>
        <h3 className="font-medium text-sm">{video.filename}</h3>
        {video.metadata?.width && video.metadata?.height && (
          <p className="text-xs text-gray-300 mt-1">
            {video.metadata.width}×{video.metadata.height}
            {video.metadata.format && ` • ${video.metadata.format.toUpperCase()}`}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black to-transparent p-4 transition-opacity ${
        showControls ? 'opacity-100' : 'opacity-0'
      }`}>
        {/* Progress bar */}
        <div className="mb-4">
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / duration) * 100}%, #4b5563 ${(currentTime / duration) * 100}%, #4b5563 100%)`
            }}
          />
        </div>

        <div className="flex items-center justify-between text-white">
          {/* Left controls */}
          <div className="flex items-center space-x-4">
            <button
              onClick={togglePlay}
              className="bg-blue-600 hover:bg-blue-700 rounded-full p-2 transition-colors"
            >
              {isPlaying ? (
                <PauseIcon className="w-5 h-5" />
              ) : (
                <PlayIcon className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={toggleMute}
              className="hover:text-blue-400 transition-colors"
            >
              {isMuted ? (
                <SpeakerXMarkIcon className="w-5 h-5" />
              ) : (
                <SpeakerWaveIcon className="w-5 h-5" />
              )}
            </button>

            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-20 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            />

            <span className="text-sm font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleFullscreen}
              className="text-sm font-medium hover:text-blue-400 transition-colors"
            >
              Fullscreen
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard shortcuts help */}
      <div className={`absolute bottom-20 right-4 bg-black bg-opacity-70 text-white p-3 rounded-lg text-xs transition-opacity ${
        showControls ? 'opacity-100' : 'opacity-0'
      }`}>
        <div className="space-y-1">
          <div><kbd className="bg-gray-800 px-1 rounded">Space</kbd> Play/Pause</div>
          <div><kbd className="bg-gray-800 px-1 rounded">M</kbd> Mute</div>
          <div><kbd className="bg-gray-800 px-1 rounded">F</kbd> Fullscreen</div>
          <div><kbd className="bg-gray-800 px-1 rounded">Esc</kbd> Close</div>
        </div>
      </div>
    </div>
  )
}