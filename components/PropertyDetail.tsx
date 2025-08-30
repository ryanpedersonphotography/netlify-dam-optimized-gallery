'use client'

import React, { useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeftIcon, ArrowDownTrayIcon, PhotoIcon, VideoCameraIcon } from '@heroicons/react/24/outline'
import VideoGallery from './VideoGallery'

interface Suite {
  id: string
  name: string
  property: string
  images?: string[]
}

interface Property {
  id: string
  address: string
  folderName: string
  thumbnail?: string
  images?: string[]
  suiteImages?: string[]
}

interface PropertyDetailProps {
  property: Property
  suites: Suite[]
  onBack: () => void
}

export default function PropertyDetail({ 
  property, 
  suites, 
  onBack 
}: PropertyDetailProps) {
  const [activeTab, setActiveTab] = useState<'public' | 'suites'>('public')
  const [downloading, setDownloading] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [selectionMode, setSelectionMode] = useState(false)

  const propertySuites = suites.filter(s => s.property === property.address)

  const getAssetPath = useCallback((asset: string) => {
    return `/assets/${property.folderName}/${asset}`
  }, [property.folderName])

  const toggleAssetSelection = useCallback((asset: string) => {
    setSelectedAssets(prev => {
      const isSelected = prev.includes(asset)
      if (isSelected) {
        return prev.filter(a => a !== asset)
      } else {
        return [...prev, asset]
      }
    })
  }, [])

  const handleAssetClick = useCallback((asset: string) => {
    if (selectionMode) {
      toggleAssetSelection(asset)
    } else {
      setSelectedImage(asset)
    }
  }, [selectionMode, toggleAssetSelection])

  const clearSelection = useCallback(() => {
    setSelectedAssets([])
    setSelectionMode(false)
  }, [])

  const downloadSelectedAssets = useCallback(async () => {
    if (selectedAssets.length === 0) return
    
    setDownloading(true)
    try {
      // Create download links for each selected asset
      for (const asset of selectedAssets) {
        const link = document.createElement('a')
        link.href = getAssetPath(asset)
        link.download = asset
        link.target = '_blank'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
      clearSelection()
    } catch (error) {
      console.error('Download failed:', error)
    } finally {
      setDownloading(false)
    }
  }, [selectedAssets, getAssetPath, clearSelection])

  const currentImages = activeTab === 'public' 
    ? (property.images || [])
    : (property.suiteImages || [])

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
                <h1 className="text-2xl font-bold text-gray-900">{property.address}</h1>
                <p className="text-sm text-gray-500">
                  {currentImages.length} images
                </p>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center space-x-4">
              {selectedAssets.length > 0 && (
                <>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Clear ({selectedAssets.length})
                  </button>
                  <button
                    onClick={downloadSelectedAssets}
                    disabled={downloading}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                    {downloading ? 'Downloading...' : `Download ${selectedAssets.length}`}
                  </button>
                </>
              )}
              
              <button
                onClick={() => setSelectionMode(!selectionMode)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  selectionMode 
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {selectionMode ? 'Exit Select' : 'Select Mode'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('public')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'public'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <PhotoIcon className="w-5 h-5 inline mr-2" />
              Public Images ({property.images?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('suites')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'suites'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <VideoCameraIcon className="w-5 h-5 inline mr-2" />
              Suite Images ({property.suiteImages?.length || 0})
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {currentImages.length === 0 ? (
          <div className="text-center py-12">
            <PhotoIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              No images available for {activeTab === 'public' ? 'public' : 'suites'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {currentImages.map((asset, index) => {
              const isSelected = selectedAssets.includes(asset)
              return (
                <div key={index} className="relative group">
                  <div 
                    className={`relative overflow-hidden rounded-lg cursor-pointer transition-all duration-300 ${
                      isSelected ? 'ring-4 ring-blue-500 shadow-lg' : 'hover:shadow-lg'
                    }`}
                    onClick={() => handleAssetClick(asset)}
                  >
                    <div className="aspect-square relative">
                      <Image
                        src={getAssetPath(asset)}
                        alt={`${property.address} - ${asset}`}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                        loading="lazy"
                      />
                    </div>
                    
                    {/* Selection overlay */}
                    <div 
                      className={`absolute inset-0 transition-opacity duration-300 ${
                        isSelected ? 'bg-blue-500 bg-opacity-20' : 'bg-black bg-opacity-0 group-hover:bg-opacity-10'
                      }`}
                    />
                    
                    {/* Selection checkbox */}
                    {(selectionMode || isSelected) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleAssetSelection(asset)
                        }}
                        className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 transition-all duration-300 ${
                          isSelected 
                            ? 'bg-blue-500 border-blue-500 text-white' 
                            : 'bg-white bg-opacity-80 border-gray-300 hover:bg-opacity-100'
                        }`}
                      >
                        {isSelected && <span className="text-xs">✓</span>}
                      </button>
                    )}
                  </div>
                  
                  <div className="mt-2 text-xs text-gray-500 truncate">
                    {asset}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Suites List */}
        {activeTab === 'suites' && propertySuites.length > 0 && (
          <div className="mt-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Suites</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {propertySuites.map((suite) => (
                <Link
                  key={suite.id}
                  href={`/suite/${suite.id}`}
                  className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
                >
                  <h4 className="font-medium text-gray-900">{suite.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">
                    {suite.images?.length || 0} images
                  </p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Video Gallery */}
        <div className="mt-12">
          <VideoGallery 
            propertyId={property.id}
            folderName={property.folderName}
          />
        </div>
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="relative max-w-7xl max-h-[90vh] mx-4">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70 transition-colors z-10"
            >
              ✕
            </button>
            
            <Image
              src={getAssetPath(selectedImage)}
              alt={`${property.address} - ${selectedImage}`}
              width={1200}
              height={800}
              className="max-w-full max-h-[90vh] object-contain"
              sizes="90vw"
              priority
            />
            
            {/* Image Info */}
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 text-white p-3 rounded-lg">
              <div className="flex items-center space-x-4">
                <span className="text-sm">{selectedImage}</span>
                <a
                  href={getAssetPath(selectedImage)}
                  download={selectedImage}
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