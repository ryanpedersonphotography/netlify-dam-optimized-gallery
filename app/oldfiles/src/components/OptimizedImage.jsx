import React, { useState, useEffect, useRef } from 'react';

const OptimizedImage = ({
  src,
  alt,
  width,
  height,
  sizes = '100vw',
  quality = 85,
  priority = false,
  className = '',
  onLoad,
  placeholder = 'blur',
  blurDataURL,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef(null);

  // Generate responsive srcset
  const generateSrcSet = () => {
    const widths = [320, 640, 768, 1024, 1280, 1536, 1920, 2560];
    const srcSetEntries = widths
      .filter(w => w <= (width || 2560))
      .map(w => `${src}&w=${w}&q=${quality} ${w}w`)
      .join(', ');
    return srcSetEntries;
  };

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || !imgRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: '50px',
        threshold: 0.01,
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    if (onLoad) onLoad();
  };

  // Base64 blur placeholder for fast initial render
  const defaultBlurDataURL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        width: width ? `${width}px` : '100%',
        height: height ? `${height}px` : 'auto',
        aspectRatio: width && height ? `${width}/${height}` : undefined,
      }}
    >
      {/* Blur placeholder */}
      {placeholder === 'blur' && !isLoaded && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-lg scale-110"
          style={{
            backgroundImage: `url(${blurDataURL || defaultBlurDataURL})`,
          }}
        />
      )}

      {/* Main image */}
      {isInView && (
        <picture>
          {/* WebP format */}
          <source
            type="image/webp"
            srcSet={generateSrcSet().replace(/&q=\d+/g, '&q=' + quality + '&f=webp')}
            sizes={sizes}
          />
          
          {/* AVIF format */}
          <source
            type="image/avif"
            srcSet={generateSrcSet().replace(/&q=\d+/g, '&q=' + quality + '&f=avif')}
            sizes={sizes}
          />
          
          {/* Fallback JPEG */}
          <img
            src={`${src}&w=${width || 1920}&q=${quality}`}
            srcSet={generateSrcSet()}
            sizes={sizes}
            alt={alt}
            width={width}
            height={height}
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            onLoad={handleLoad}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </picture>
      )}

      {/* Loading skeleton */}
      {!isLoaded && placeholder === 'empty' && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
    </div>
  );
};

export default OptimizedImage;