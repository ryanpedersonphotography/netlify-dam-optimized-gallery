'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface Photo {
  key: string;
  filename: string;
  status: 'picked' | 'unpicked';
  timestamp: string;
  date: string;
  url: string;
  thumbUrl: string;
  mediumUrl: string;
}

interface EventGalleryProps {
  propertyId: string;
  year: string;
}

export default function EventGallery({ propertyId, year }: EventGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'picked' | 'unpicked'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [visiblePhotos, setVisiblePhotos] = useState(20);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPhotos();
  }, [propertyId, year]);

  useEffect(() => {
    filterPhotos();
  }, [photos, filter, searchTerm]);

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
      // Fetch from the Netlify function
      const prefix = `parties/${year}/${propertyId}/`;
      const response = await fetch(`/api/asset-handler/list?prefix=${encodeURIComponent(prefix)}`);
      const data = await response.json();
      
      if (data.assets) {
        // Parse the keys to extract metadata
        const photoData = data.assets.map((asset: any) => {
          const key = asset.key;
          // Remove the prefix to get the filename
          const filename = key.replace(prefix, '');
          const parts = filename.split('_');
          const status = filename.includes('PICKED') ? 'picked' : 'unpicked';
          const timestamp = parts[1] || '';
          
          return {
            key,
            filename: `${filename}.jpg`,
            status,
            timestamp,
            date: parseTimestamp(timestamp),
            url: `/api/asset-handler/serve?key=${encodeURIComponent(key)}`,
            thumbUrl: `/api/asset-handler/serve?key=${encodeURIComponent(key)}&size=thumb`,
            mediumUrl: `/api/asset-handler/serve?key=${encodeURIComponent(key)}&size=medium`
          };
        });
        
        // Sort by timestamp
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

  const filterPhotos = () => {
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
        p.timestamp.includes(term)
      );
    }

    setFilteredPhotos(filtered);
    setVisiblePhotos(20); // Reset visible photos when filtering
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
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Search photos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
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
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-600">
            Showing {filteredPhotos.length} photos
          </span>
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

      {/* Photo Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filteredPhotos.slice(0, visiblePhotos).map(photo => (
          <PhotoCard
            key={photo.key}
            photo={photo}
            onSelect={() => setSelectedPhoto(photo)}
            onDownload={() => downloadPhoto(photo)}
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
              className="max-w-full max-h-[70vh] object-contain"
            />
            
            <div className="p-4 bg-white">
              <h3 className="text-lg font-semibold">{selectedPhoto.filename}</h3>
              <p className="text-gray-600">Status: {selectedPhoto.status.toUpperCase()}</p>
              <p className="text-gray-600">Date: {selectedPhoto.date}</p>
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

      {/* No Results */}
      {filteredPhotos.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">No photos found</p>
          {searchTerm && (
            <p className="text-gray-500 mt-2">Try adjusting your search term</p>
          )}
        </div>
      )}
    </div>
  );
}

// Optimized PhotoCard component with lazy loading
function PhotoCard({ photo, onSelect, onDownload }: {
  photo: Photo;
  onSelect: () => void;
  onDownload: () => void;
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
          </div>
        </div>
        
        {/* Download button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload();
          }}
          className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100"
          title="Download"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        </button>
      </div>
    </div>
  );
}