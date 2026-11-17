
import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  forceLazy?: boolean;
  onLoad?: () => void;
  priority?: 'high' | 'low' | 'auto';
  componentName?: string;
  imagePurpose?: string;
  sizes?: string;
  srcSet?: string;
  placeholderSrc?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  forceEager?: boolean;
}

/**
 * A responsive image component that supports both eager and lazy loading
 * based on whether the image is critical (above the fold) or not.
 *
 * Handles the Next.js SSR hydration race condition where onLoad can fire
 * before React hydrates, leaving the image stuck at opacity-0.
 */
const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  width,
  height,
  forceLazy = true,
  onLoad,
  priority = 'auto',
  sizes,
  srcSet,
  onError,
  forceEager,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  // A new src starts unloaded again (React's "adjust state while rendering"
  // pattern: compare with the previous src instead of using an effect).
  const [prevSrc, setPrevSrc] = useState(src);
  if (prevSrc !== src) {
    setPrevSrc(src);
    setIsLoaded(false);
    setError(false);
  }

  // When the <img> is attached, check if it is already loaded (e.g. from the
  // browser cache): in SSR/Next.js, onLoad can fire before React attaches its
  // event handlers, so the image may already be complete at hydration.
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    if (onLoad) {
      onLoad();
    }
  }, [onLoad]);

  const handleError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setError(true);
    console.error(`Failed to load image: ${src}`);
    if (onError) {
      onError(e);
    }
  }, [src, onError]);

  // Create props object with React's built-in ImgHTMLAttributes
  const imgProps: React.ImgHTMLAttributes<HTMLImageElement> = {
    src,
    alt,
    className: cn(
      "transition-opacity duration-300",
      className,
      isLoaded ? "opacity-100" : "opacity-0"
    ),
    loading: forceEager ? 'eager' : (forceLazy ? 'lazy' : 'eager'),
    onLoad: handleLoad,
    onError: handleError,
    width,
    height,
    sizes,
    srcSet,
    ...props
  };

  // Only add fetchpriority if it's not the default value
  if (priority !== 'auto') {
    imgProps.fetchPriority = priority;
  }

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {!isLoaded && !error && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse" 
             style={{ aspectRatio: width && height ? `${width}/${height}` : 'auto' }} />
      )}

      <img ref={imgRef} {...imgProps} alt={alt} />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-red-500 text-sm">
          Failed to load image
        </div>
      )}
    </div>
  );
};

export default LazyImage;
