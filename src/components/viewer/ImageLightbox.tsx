'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Download,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Star,
  Maximize,
  Minimize,
  Clock,
} from 'lucide-react';
import { MediaItem } from '@/types';
import { formatBytes } from '@/lib/utils/cn';

interface ImageLightboxProps {
  media: MediaItem;
  currentIndex: number;
  totalCount: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFavoriteToggle?: (media: MediaItem) => void;
}

const SPEED_OPTIONS = [
  { label: '2s (Fast)', value: 2 },
  { label: '3s (Default)', value: 3 },
  { label: '5s (Normal)', value: 5 },
  { label: '8s (Slow)', value: 8 },
  { label: '10s (Relaxed)', value: 10 },
];

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
  media,
  currentIndex,
  totalCount,
  onClose,
  onPrev,
  onNext,
  onFavoriteToggle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [slideshowSpeed, setSlideshowSpeed] = useState<number>(3);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFav, setIsFav] = useState(media.isFavorite || false);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Sync favorite state
  useEffect(() => {
    setIsFav(media.isFavorite || false);
  }, [media.isFavorite, media.id]);

  // Load saved slideshow speed from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('megavault_slideshow_speed');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed > 0) setSlideshowSpeed(parsed);
      }
    } catch {}
  }, []);

  const saveSpeed = (seconds: number) => {
    setSlideshowSpeed(seconds);
    setShowSpeedMenu(false);
    try {
      localStorage.setItem('megavault_slideshow_speed', seconds.toString());
    } catch {}
  };

  // Fullscreen management
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Auto-enter Fullscreen when Slideshow starts
  const toggleSlideshow = useCallback(() => {
    const nextState = !isSlideshow;
    setIsSlideshow(nextState);

    if (nextState && containerRef.current && !document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else if (!nextState && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [isSlideshow]);

  // Slideshow interval timer
  useEffect(() => {
    if (!isSlideshow) return;
    const interval = setInterval(() => {
      onNext();
    }, slideshowSpeed * 1000);
    return () => clearInterval(interval);
  }, [isSlideshow, slideshowSpeed, onNext]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.code) {
        case 'ArrowLeft':
        case 'BracketLeft':
          onPrev();
          break;
        case 'ArrowRight':
        case 'BracketRight':
          onNext();
          break;
        case 'Space':
          e.preventDefault();
          toggleSlideshow();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          setIsSlideshow(false);
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrev, onNext, toggleSlideshow, toggleFullscreen, onClose]);

  const handleFavClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !isFav;
    setIsFav(nextState);
    media.isFavorite = nextState;
    if (onFavoriteToggle) onFavoriteToggle(media);

    try {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumId: media.albumId,
          handle: media.fileHandle,
          fileName: media.fileName,
          mimeType: media.mimeType,
          mediaType: media.mediaType,
          size: media.size,
          thumbnailUrl: media.thumbnailUrl,
        }),
      });
    } catch {}
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null || touchStartY.current === null) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX.current;
        const deltaY = e.changedTouches[0].clientY - touchStartY.current;
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
          if (deltaX < 0) onNext();
          else if (deltaX > 0) onPrev();
        }
        touchStartX.current = null;
        touchStartY.current = null;
      }}
      className="fixed inset-0 z-50 bg-black select-none flex items-center justify-center"
      style={{ animation: 'fadeInScale 0.2s ease-out both' }}
    >
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Main Fullscreen Image */}
      <div
        className="absolute inset-0 flex items-center justify-center cursor-zoom-in"
        onClick={() => {
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          setIsSlideshow(false);
          onClose();
        }}
      >
        <img
          key={media.id}
          src={media.streamUrl || media.thumbnailUrl || ''}
          alt={media.fileName}
          fetchPriority="high"
          decoding="async"
          onClick={(e) => e.stopPropagation()}
          className="max-w-full max-h-full w-full h-full object-contain select-none transition-all duration-300"
          style={{ animation: 'fadeInScale 0.18s ease both' }}
        />
      </div>

      {/* Top Header Overlay Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-3 sm:px-5 py-3 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none gap-2">
        <div className="pointer-events-auto min-w-0">
          <p className="text-xs sm:text-sm font-bold text-white font-mono truncate max-w-[35vw] sm:max-w-[45vw]">{media.fileName}</p>
          <p className="text-[10px] sm:text-xs text-zinc-400 flex items-center gap-1.5 sm:gap-2">
            <span>{formatBytes(media.size)}</span>
            <span>•</span>
            <span>{currentIndex + 1} of {totalCount}</span>
            {isSlideshow && (
              <span className="text-blue-400 font-bold hidden sm:flex items-center gap-1 animate-pulse">
                • Slideshow ({slideshowSpeed}s)
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto relative flex-shrink-0">
          {/* Favorite Button */}
          <button
            onClick={handleFavClick}
            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
            className={`p-2 sm:p-2.5 rounded-full border backdrop-blur-md transition-all ${
              isFav
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-md shadow-amber-500/10'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/70'
            }`}
          >
            <Star className={`w-4 h-4 sm:w-5 sm:h-5 ${isFav ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>

          {/* Slideshow Speed Adjuster Dropdown */}
          <div className="relative hidden xs:block">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSpeedMenu(!showSpeedMenu);
              }}
              title="Adjust slideshow interval speed"
              className="p-2 sm:p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/70 flex items-center gap-1 backdrop-blur-md transition-all text-xs font-semibold"
            >
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
              <span className="hidden sm:inline">{slideshowSpeed}s</span>
            </button>

            {showSpeedMenu && (
              <div className="absolute top-12 right-0 z-30 w-44 rounded-2xl bg-zinc-900/95 border border-zinc-800 p-2 shadow-2xl backdrop-blur-xl">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-2 py-1 border-b border-zinc-800 mb-1">
                  Slideshow Speed
                </p>
                {SPEED_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => saveSpeed(opt.value)}
                    className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between ${
                      slideshowSpeed === opt.value
                        ? 'bg-blue-600 text-white'
                        : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {slideshowSpeed === opt.value && <span className="text-[10px]">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Play / Pause Slideshow Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleSlideshow();
            }}
            title={isSlideshow ? 'Pause Slideshow' : 'Play Auto-Slideshow'}
            className={`px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full text-xs font-bold flex items-center gap-1.5 border backdrop-blur-md transition-all shadow-lg ${
              isSlideshow
                ? 'bg-blue-600 border-blue-400 text-white shadow-blue-600/30'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/70'
            }`}
          >
            {isSlideshow ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white translate-x-0.5" />}
            <span className="hidden sm:inline">{isSlideshow ? 'Pause' : 'Slideshow'}</span>
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen (F)'}
            className="p-2 sm:p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/70 transition-all backdrop-blur-md hidden xs:block"
          >
            {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* Download Button */}
          <a
            href={`${media.streamUrl}&download=true`}
            download={media.fileName}
            onClick={(e) => e.stopPropagation()}
            title="Download image"
            className="p-2 sm:p-2.5 rounded-full bg-zinc-900/80 hover:bg-emerald-600 text-zinc-300 hover:text-white border border-zinc-700/70 transition-all backdrop-blur-md"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
          </a>

          {/* Close Button */}
          <button
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
              setIsSlideshow(false);
              onClose();
            }}
            className="p-2 sm:p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/70 transition-all backdrop-blur-md"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Left Navigation Arrow */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onPrev();
        }}
        className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 p-3.5 rounded-full bg-zinc-900/85 hover:bg-blue-600 text-zinc-200 hover:text-white border border-zinc-700/80 hover:border-blue-500 backdrop-blur-md transition-all shadow-2xl"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>

      {/* Right Navigation Arrow */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onNext();
        }}
        className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 p-3.5 rounded-full bg-zinc-900/85 hover:bg-blue-600 text-zinc-200 hover:text-white border border-zinc-700/80 hover:border-blue-500 backdrop-blur-md transition-all shadow-2xl"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );
};
