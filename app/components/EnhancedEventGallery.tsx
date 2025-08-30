'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import TagManager from './TagManager';

interface Photo {
  key: string;
  filename: string;
  status: 'picked' | 'unpicked';
  timestamp: string;
  date: string;
  url: string;
  thumbUrl: string;
  mediumUrl: string;
  tags?: string[];
}

interface EventGalleryProps {
  propertyId: string;
  year: string;
}

type SortOption = 'date-asc' | 'date-desc' | 'name-asc' | 'name-desc' | 'status';

export default function EnhancedEventGallery({ propertyId, year }: EventGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'picked' | 'unpicked'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<{ name: string; count: number }[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [visiblePhotos, setVisiblePhotos] = useState(20);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);
  const [showTagManager, setShowTagManager] = useState(false);
  const [selectedPhotoForTagging, setSelectedPhotoForTagging] = useState<Photo | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPhotos();
    fetchAllTags();
  }, [propertyId, year]);

  useEffect(() => {
    filterAndSortPhotos();
  }, [photos, filter, searchTerm, selectedTags, sortBy]);

  // Infinite scroll setup
  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '100px',
      threshold: 0.1
    };

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && visiblePhotos < filteredPhotos.length) {
        setVisiblePhotos(prev => Math.min(prev + 20, filteredPhotos.length));
      }
    }, options);

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [visiblePhotos, filteredPhotos.length]);

  const fetchPhotos = async () => {
    try {
      // For 2025, fetch all assets without prefix (like the working code)
      let prefix = year === '2025' ? '' : `parties/${year}/${propertyId}/`;
      let response = await fetch(year === '2025' ? '/api/asset-handler/list' : `/api/asset-handler/list?prefix=${encodeURIComponent(prefix)}`);
      let data = await response.json();
      
      // If no photos found and it's not 2025, try with /all subdirectory
      if ((!data.assets || data.assets.length === 0) && year !== '2025') {
        prefix = `parties/${year}/${propertyId}/all/`;
        response = await fetch(`/api/asset-handler/list?prefix=${encodeURIComponent(prefix)}`);
        data = await response.json();
      }
      
      if (data.assets && data.assets.length > 0) {
        // Parse the keys to extract metadata - simpler approach like working code
        const photoData = data.assets.map((asset: any) => {
          const key = asset.key;
          const parts = key.split('_');
          const status = key.includes('PICKED') ? 'picked' : 'unpicked';
          const timestamp = parts[1] || '';
          
          return {
            key,
            filename: asset.filename || `${key}.jpg`,
            status,
            timestamp,
            date: parseTimestamp(timestamp),
            url: `/api/asset-handler/serve?key=${key}`,
            thumbUrl: `/api/asset-handler/serve?key=${key}&size=thumb`,
            mediumUrl: `/api/asset-handler/serve?key=${key}&size=medium`
          };
        });
        
        // Sort by timestamp like in working code
        photoData.sort((a: Photo, b: Photo) => a.timestamp.localeCompare(b.timestamp));
        
        setPhotos(photoData);
        setFilteredPhotos(photoData);
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTags = async () => {
    try {
      const response = await fetch('/api/tag-handler/all');
      const data = await response.json();
      if (data.tags) {
        setAvailableTags(data.tags);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const parseTimestamp = (timestamp: string) => {
    // Parse 20250807180510 format
    if (timestamp.length >= 14) {
      const year = timestamp.substring(0, 4);
      const month = timestamp.substring(4, 6);
      const day = timestamp.substring(6, 8);
      const hour = timestamp.substring(8, 10);
      const minute = timestamp.substring(10, 12);
      const second = timestamp.substring(12, 14);
      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    }
    return timestamp;
  };

  const filterAndSortPhotos = () => {
    let filtered = [...photos];

    // Apply status filter
    if (filter === 'picked') {
      filtered = filtered.filter(p => p.status === 'picked');
    } else if (filter === 'unpicked') {
      filtered = filtered.filter(p => p.status === 'unpicked');
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.filename.toLowerCase().includes(term) ||
        p.timestamp.includes(term) ||
        p.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(p => 
        selectedTags.every(tag => p.tags?.includes(tag))
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return a.timestamp.localeCompare(b.timestamp);
        case 'date-desc':
          return b.timestamp.localeCompare(a.timestamp);
        case 'name-asc':
          return a.filename.localeCompare(b.filename);
        case 'name-desc':
          return b.filename.localeCompare(a.filename);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    setFilteredPhotos(filtered);
    setVisiblePhotos(20); // Reset visible photos when filtering
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const downloadPhoto = async (photo: Photo) => {
    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photo.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading photo:', error);
    }
  };

  const downloadAllAsZip = async () => {
    const zip = new JSZip();
    const total = filteredPhotos.length;
    
    setDownloadProgress(`Preparing download... 0/${total}`);
    
    try {
      for (let i = 0; i < filteredPhotos.length; i++) {
        const photo = filteredPhotos[i];
        setDownloadProgress(`Downloading ${i + 1}/${total}: ${photo.filename}`);
        
        const response = await fetch(photo.url);
        const blob = await response.blob();
        zip.file(photo.filename, blob);
        
        // Small delay to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      setDownloadProgress('Creating zip file...');
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${propertyId}-${year}-photos.zip`);
      setDownloadProgress(null);
    } catch (error) {
      console.error('Error creating zip:', error);
      setDownloadProgress(null);
      alert('Error creating zip file. Please try again.');
    }
  };

  const handlePhotoTagUpdate = (photo: Photo) => {
    // Refresh tags for this photo
    fetchPhotos();
    fetchAllTags();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm space-y-4">
        {/* Search and Filter Row */}
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Search photos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date-desc">Date (Newest First)</option>
            <option value="date-asc">Date (Oldest First)</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="status">Status</option>
          </select>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setFilter('all')}
          >
            All ({photos.length})
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'picked' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setFilter('picked')}
          >
            Picked ({photos.filter(p => p.status === 'picked').length})
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'unpicked' 
                ? 'bg-yellow-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setFilter('unpicked')}
          >
            Unpicked ({photos.filter(p => p.status === 'unpicked').length})
          </button>
        </div>

        {/* Tag Filter */}
        {availableTags.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Filter by tags:</p>
            <div className="flex flex-wrap gap-2">
              {availableTags.map(tag => (
                <button
                  key={tag.name}
                  onClick={() => toggleTag(tag.name)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedTags.includes(tag.name)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag.name} ({tag.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Summary and Actions */}
        <div className="flex justify-between items-center">
          <span className="text-gray-600">
            Showing {filteredPhotos.length} photos
            {selectedTags.length > 0 && ` (filtered by ${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''})`}
          </span>
          <div className="flex gap-2">
            {filteredPhotos.length > 0 && (
              <button
                onClick={downloadAllAsZip}
                disabled={downloadProgress !== null}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {downloadProgress || 'Download All as ZIP'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredPhotos.slice(0, visiblePhotos).map(photo => (
          <PhotoCard
            key={photo.key}
            photo={photo}
            onSelect={() => setSelectedPhoto(photo)}
            onDownload={() => downloadPhoto(photo)}
            onTagClick={() => {
              setSelectedPhotoForTagging(photo);
              setShowTagManager(true);
            }}
          />
        ))}
      </div>

      {/* Load More Trigger */}
      {visiblePhotos < filteredPhotos.length && (
        <div ref={loadMoreRef} className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading more photos...</span>
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div 
            className="relative max-w-5xl max-h-[90vh] bg-white rounded-lg overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-4 right-4 text-white bg-black bg-opacity-50 rounded-full p-2 hover:bg-opacity-70 z-10"
              onClick={() => setSelectedPhoto(null)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <img
              src={selectedPhoto.mediumUrl || selectedPhoto.url}
              alt={selectedPhoto.filename}
              className="max-w-full max-h-[60vh] object-contain"
            />
            
            <div className="p-4 bg-white">
              <h3 className="text-lg font-semibold">{selectedPhoto.filename}</h3>
              <p className="text-gray-600">Status: {selectedPhoto.status.toUpperCase()}</p>
              <p className="text-gray-600">Date: {selectedPhoto.date}</p>
              
              {/* Tags in lightbox */}
              <div className="mt-4">
                <TagManager 
                  assetKey={selectedPhoto.key}
                  onTagsChange={() => {
                    fetchPhotos();
                    fetchAllTags();
                  }}
                />
              </div>
              
              <button
                onClick={() => downloadPhoto(selectedPhoto)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tag Manager Modal */}
      {showTagManager && selectedPhotoForTagging && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowTagManager(false);
            setSelectedPhotoForTagging(null);
          }}
        >
          <div 
            className="bg-white rounded-lg p-6 max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-4">
              Manage Tags for {selectedPhotoForTagging.filename}
            </h2>
            
            <TagManager 
              assetKey={selectedPhotoForTagging.key}
              onTagsChange={() => {
                fetchPhotos();
                fetchAllTags();
              }}
            />
            
            <button
              onClick={() => {
                setShowTagManager(false);
                setSelectedPhotoForTagging(null);
              }}
              className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* No Results */}
      {filteredPhotos.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">No photos found</p>
          {(searchTerm || selectedTags.length > 0) && (
            <p className="text-gray-500 mt-2">Try adjusting your filters</p>
          )}
        </div>
      )}
    </div>
  );
}

// Optimized PhotoCard component with lazy loading
function PhotoCard({ photo, onSelect, onDownload, onTagClick }: {
  photo: Photo;
  onSelect: () => void;
  onDownload: () => void;
  onTagClick: () => void;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={`relative group cursor-pointer rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow ${
        photo.status === 'picked' ? 'ring-2 ring-green-500' : ''
      }`}
      onClick={onSelect}
    >
      <div ref={imgRef} className="relative aspect-[3/4] bg-gray-100">
        {!imageLoaded && !imageError && isVisible && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
        
        {isVisible && (
          <img
            src={photo.thumbUrl}
            alt={photo.filename}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
        
        {imageError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
            <span className="text-gray-500">Failed to load</span>
          </div>
        )}
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
            <span className={`inline-block px-2 py-1 text-xs rounded ${
              photo.status === 'picked' ? 'bg-green-600' : 'bg-yellow-600'
            }`}>
              {photo.status.toUpperCase()}
            </span>
            <p className="text-xs mt-1">{photo.date}</p>
            
            {/* Display tags */}
            {photo.tags && photo.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {photo.tags.slice(0, 3).map(tag => (
                  <span key={tag} className="text-xs bg-blue-600 px-1 rounded">
                    {tag}
                  </span>
                ))}
                {photo.tags.length > 3 && (
                  <span className="text-xs">+{photo.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTagClick();
            }}
            className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100"
            title="Manage Tags"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </button>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
            className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100"
            title="Download"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}