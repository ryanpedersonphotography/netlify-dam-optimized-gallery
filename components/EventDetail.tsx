'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { Masonry } from 'masonic'
import { ArrowLeftIcon, StarIcon, TagIcon, PhotoIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid'

interface Asset {
  id: string
  key: string
  url: string
  thumbnailUrl: string
  downloadUrl: string
  metadata?: {
    captureTime?: string
    rating?: number
    tags?: string[]
    topPick?: boolean
    width?: number
    height?: number
  }
}

interface EventDetailProps {
  propertyId: string
  year: string
  eventName: string
  assets: Asset[]
  onBack: () => void
}

interface MasonryItemProps {
  data: Asset
  width: number
}

export default function EventDetail({ 
  propertyId, 
  year, 
  eventName, 
  assets = [], 
  onBack 
}: EventDetailProps) {
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'all' | 'top-picks'>('all')
  const [selectedPhoto, setSelectedPhoto] = useState<Asset | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const filteredAssets = useMemo(() => {
    let filtered = assets || []
    
    if (viewMode === 'top-picks') {
      filtered = filtered.filter(asset => asset.metadata?.topPick === true)
    }
    
    return filtered.sort((a, b) => {
      const timeA = a.metadata?.captureTime || '0'
      const timeB = b.metadata?.captureTime || '0'
      return timeB.localeCompare(timeA)
    })
  }, [assets, viewMode])

  const handleAssetSelect = useCallback((assetId: string) => {
    setSelectedAssets(prev => {
      const newSelected = new Set(prev)
      if (newSelected.has(assetId)) {
        newSelected.delete(assetId)
      } else {
        newSelected.add(assetId)
      }
      return newSelected
    })
  }, [])

  const handleDownloadSelected = useCallback(async () => {
    if (selectedAssets.size === 0) return
    
    setIsLoading(true)
    try {
      const selectedAssetsList = Array.from(selectedAssets)
        .map(id => assets.find(asset => asset.id === id))
        .filter(Boolean) as Asset[]
      
      for (const asset of selectedAssetsList) {
        const link = document.createElement('a')
        link.href = asset.downloadUrl
        link.download = `${asset.key}`
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      setSelectedAssets(new Set())
    } catch (error) {
      console.error('Download failed:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedAssets, assets])

  const handleRatingUpdate = useCallback(async (assetId: string, rating: number) => {
    try {
      const response = await fetch('/api/update-rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, rating })
      })
      
      if (!response.ok) throw new Error('Failed to update rating')
      
      // Update local state would need to be handled by parent component
      console.log('Rating updated successfully')
    } catch (error) {
      console.error('Failed to update rating:', error)
    }
  }, [])

  const handleTopPickToggle = useCallback(async (assetId: string, isTopPick: boolean) => {
    try {
      const response = await fetch('/api/update-top-pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, topPick: !isTopPick })
      })
      
      if (!response.ok) throw new Error('Failed to update top pick')
      
      console.log('Top pick updated successfully')
    } catch (error) {
      console.error('Failed to update top pick:', error)
    }
  }, [])

  const MasonryItem = useCallback(({ data: asset, width }: MasonryItemProps) => {
    const isSelected = selectedAssets.has(asset.id)
    const aspectRatio = asset.metadata?.height && asset.metadata?.width 
      ? asset.metadata.height / asset.metadata.width 
      : 1
    const height = width * aspectRatio

    return (
      <div className="relative group">
        <div 
          className={`relative overflow-hidden rounded-lg cursor-pointer transition-all duration-300 ${
            isSelected ? 'ring-4 ring-blue-500 shadow-lg' : 'hover:shadow-lg'
          }`}
          onClick={() => setSelectedPhoto(asset)}
        >
          <Image
            src={asset.thumbnailUrl}
            alt={`Photo ${asset.id}`}
            width={width}
            height={height}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            loading="lazy"
          />
          
          {/* Selection overlay */}
          <div 
            className={`absolute inset-0 transition-opacity duration-300 ${
              isSelected ? 'bg-blue-500 bg-opacity-20' : 'bg-black bg-opacity-0 group-hover:bg-opacity-10'
            }`}
          />
          
          {/* Selection checkbox */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleAssetSelect(asset.id)
            }}
            className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 transition-all duration-300 ${
              isSelected 
                ? 'bg-blue-500 border-blue-500 text-white' 
                : 'bg-white bg-opacity-80 border-gray-300 hover:bg-opacity-100'
            }`}
          >
            {isSelected && <span className="text-xs">✓</span>}
          </button>
          
          {/* Top pick indicator */}
          {asset.metadata?.topPick && (
            <div className="absolute top-2 right-2 bg-yellow-500 text-white rounded-full p-1">
              <StarSolidIcon className="w-4 h-4" />
            </div>
          )}
          
          {/* Rating stars */}
          {asset.metadata?.rating && (
            <div className="absolute bottom-2 left-2 flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <StarSolidIcon
                  key={star}
                  className={`w-4 h-4 ${
                    star <= (asset.metadata?.rating || 0) ? 'text-yellow-400' : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }, [selectedAssets, handleAssetSelect])

  const topPicksCount = assets.filter(asset => asset.metadata?.topPick).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onBack}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ArrowLeftIcon className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{eventName}</h1>
                <p className="text-sm text-gray-500">
                  {propertyId} • {year} • {filteredAssets.length} photos
                </p>
              </div>
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center space-x-4">
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('all')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'all'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All Photos ({assets.length})
                </button>
                <button
                  onClick={() => setViewMode('top-picks')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'top-picks'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <StarIcon className="w-4 h-4 inline mr-1" />
                  Top Picks ({topPicksCount})
                </button>
              </div>
              
              {/* Download Button */}
              {selectedAssets.size > 0 && (
                <button
                  onClick={handleDownloadSelected}
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                  {isLoading ? 'Downloading...' : `Download ${selectedAssets.size}`}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {filteredAssets.length === 0 ? (
          <div className="text-center py-12">
            <PhotoIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {viewMode === 'top-picks' ? 'No top picks found' : 'No photos available'}
            </p>
          </div>
        ) : (
          <Masonry
            items={filteredAssets}
            columnGutter={16}
            columnWidth={280}
            overscanBy={5}
            render={MasonryItem}
          />
        )}
      </div>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="relative max-w-7xl max-h-[90vh] mx-4">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70 transition-colors z-10"
            >
              ✕
            </button>
            
            <Image
              src={selectedPhoto.url}
              alt={`Photo ${selectedPhoto.id}`}
              width={selectedPhoto.metadata?.width || 800}
              height={selectedPhoto.metadata?.height || 600}
              className="max-w-full max-h-[90vh] object-contain"
              sizes="90vw"
              priority
            />
            
            {/* Photo Info */}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded-lg">
              <div className="flex items-center space-x-4">
                {/* Rating */}
                <div className="flex items-center space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRatingUpdate(selectedPhoto.id, star)}
                      className="hover:scale-110 transition-transform"
                    >
                      <StarSolidIcon
                        className={`w-5 h-5 ${
                          star <= (selectedPhoto.metadata?.rating || 0) 
                            ? 'text-yellow-400' 
                            : 'text-gray-400 hover:text-yellow-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                
                {/* Top Pick Toggle */}
                <button
                  onClick={() => handleTopPickToggle(selectedPhoto.id, selectedPhoto.metadata?.topPick || false)}
                  className={`p-2 rounded-full transition-colors ${
                    selectedPhoto.metadata?.topPick 
                      ? 'bg-yellow-500 text-white' 
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  <StarIcon className="w-4 h-4" />
                </button>
                
                {/* Download */}
                <a
                  href={selectedPhoto.downloadUrl}
                  download={selectedPhoto.key}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-blue-600 hover:bg-blue-700 rounded-full text-white transition-colors"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}