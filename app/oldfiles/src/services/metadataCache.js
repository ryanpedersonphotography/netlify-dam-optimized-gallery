// Metadata caching service for preloading and managing photo metadata
import exifr from 'exifr';

class MetadataCache {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.preloadQueue = [];
    this.isPreloading = false;
  }

  // Get cache key for a photo
  getCacheKey(photoPath) {
    return photoPath;
  }

  // Check if metadata is cached
  has(photoPath) {
    return this.cache.has(this.getCacheKey(photoPath));
  }

  // Get cached metadata
  get(photoPath) {
    return this.cache.get(this.getCacheKey(photoPath));
  }

  // Set metadata in cache
  set(photoPath, metadata) {
    this.cache.set(this.getCacheKey(photoPath), metadata);
    // Also store in localStorage for persistence
    try {
      const stored = JSON.parse(localStorage.getItem('metadataCache') || '{}');
      stored[photoPath] = metadata;
      // Keep only last 1000 entries to prevent localStorage from getting too large
      const keys = Object.keys(stored);
      if (keys.length > 1000) {
        const toRemove = keys.slice(0, keys.length - 1000);
        toRemove.forEach(key => delete stored[key]);
      }
      localStorage.setItem('metadataCache', JSON.stringify(stored));
    } catch (e) {
      console.warn('Failed to store metadata in localStorage:', e);
    }
  }

  // Load metadata from localStorage
  loadFromLocalStorage() {
    try {
      const stored = JSON.parse(localStorage.getItem('metadataCache') || '{}');
      Object.entries(stored).forEach(([path, metadata]) => {
        this.cache.set(path, metadata);
      });
      console.log(`Loaded ${Object.keys(stored).length} metadata entries from localStorage`);
    } catch (e) {
      console.warn('Failed to load metadata from localStorage:', e);
    }
  }

  // Extract metadata for a single photo
  async extractMetadata(photoPath) {
    const cacheKey = this.getCacheKey(photoPath);
    
    // Return cached if available
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Return pending request if already fetching
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }

    // Start new request
    const promise = (async () => {
      try {
        const fullPath = `/assets/${photoPath}`;
        const metadata = await exifr.parse(fullPath, {
          pick: ['DateTimeOriginal', 'Make', 'Model', 'LensModel', 'ISO', 'FNumber', 'ExposureTime', 'FocalLength']
        });
        
        const result = metadata || {};
        this.set(cacheKey, result);
        return result;
      } catch (error) {
        console.warn(`Failed to extract metadata for ${photoPath}:`, error);
        const result = {};
        this.set(cacheKey, result);
        return result;
      } finally {
        this.pendingRequests.delete(cacheKey);
      }
    })();

    this.pendingRequests.set(cacheKey, promise);
    return promise;
  }

  // Preload metadata for a batch of photos
  async preloadBatch(photoPaths, onProgress) {
    const uncached = photoPaths.filter(path => !this.has(path));
    
    if (uncached.length === 0) {
      console.log('All photos already cached');
      return;
    }

    console.log(`Preloading metadata for ${uncached.length} photos...`);
    
    // Process in chunks to avoid overwhelming the browser
    const chunkSize = 10;
    for (let i = 0; i < uncached.length; i += chunkSize) {
      const chunk = uncached.slice(i, i + chunkSize);
      
      await Promise.all(
        chunk.map(path => this.extractMetadata(path).catch(() => ({})))
      );
      
      if (onProgress) {
        onProgress({
          loaded: i + chunk.length,
          total: uncached.length,
          percentage: Math.round(((i + chunk.length) / uncached.length) * 100)
        });
      }
      
      // Small delay between chunks to keep UI responsive
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log('Metadata preloading complete');
  }

  // Queue photos for background preloading
  queueForPreload(photoPaths) {
    const newPaths = photoPaths.filter(path => 
      !this.has(path) && !this.preloadQueue.includes(path)
    );
    
    this.preloadQueue.push(...newPaths);
    
    if (!this.isPreloading) {
      this.processPreloadQueue();
    }
  }

  // Process the preload queue in the background
  async processPreloadQueue() {
    if (this.preloadQueue.length === 0) {
      this.isPreloading = false;
      return;
    }

    this.isPreloading = true;
    
    // Process one at a time in the background
    while (this.preloadQueue.length > 0) {
      const path = this.preloadQueue.shift();
      
      if (!this.has(path)) {
        await this.extractMetadata(path).catch(() => ({}));
        // Longer delay for background processing
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    this.isPreloading = false;
  }

  // Clear the cache
  clear() {
    this.cache.clear();
    this.pendingRequests.clear();
    this.preloadQueue = [];
    try {
      localStorage.removeItem('metadataCache');
    } catch (e) {
      console.warn('Failed to clear localStorage:', e);
    }
  }

  // Get cache statistics
  getStats() {
    return {
      cached: this.cache.size,
      pending: this.pendingRequests.size,
      queued: this.preloadQueue.length,
      isPreloading: this.isPreloading
    };
  }
}

// Export singleton instance
export const metadataCache = new MetadataCache();

// Load from localStorage on initialization
if (typeof window !== 'undefined') {
  metadataCache.loadFromLocalStorage();
}