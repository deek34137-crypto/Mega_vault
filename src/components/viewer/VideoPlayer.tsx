'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  X,
  Download,
  Info,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Star,
} from 'lucide-react';
import { formatBytes, formatDuration } from '@/lib/utils/cn';
import { MediaItem } from '@/types';

interface VideoPlayerProps {
  media: MediaItem;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  media,
  onClose,
  onPrev,
  onNext,
  currentIndex,
  totalCount,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const overlayTimeout = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const capturedRef = useRef<boolean>(false);

  const changeSpeed = useCallback((speed: number) => {
    setPlaybackRate(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, []);

  useEffect(() => {
    capturedRef.current = false;
    setHasError(false);
  }, [media.id]);

  const captureThumbnail = useCallback(() => {
    if (capturedRef.current || !videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    try {
      capturedRef.current = true;
      const canvas = document.createElement('canvas');
      const aspect = video.videoWidth / video.videoHeight;
      const targetWidth = 400;
      const targetHeight = Math.round(targetWidth / aspect);
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

      const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.75);

      fetch('/api/mega/thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumId: media.albumId,
          handle: media.fileHandle,
          thumbnailDataUrl,
        }),
      }).catch((err) => console.error('Failed to save captured thumbnail:', err));
    } catch (err) {
      console.warn('Video thumbnail capture skipped:', err);
    }
  }, [media.albumId, media.fileHandle]);

  // Auto hide control overlay after 3 seconds of inactivity
  const handleMouseMove = () => {
    setShowOverlay(true);
    if (overlayTimeout.current) clearTimeout(overlayTimeout.current);
    overlayTimeout.current = setTimeout(() => setShowOverlay(false), 3000);
  };

  // Touch Swipe Gesture Handlers for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    handleMouseMove();
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Horizontal swipe threshold (>50px) and horizontal dominance
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0 && onNext) {
        onNext(); // Swipe Left -> Next
      } else if (deltaX > 0 && onPrev) {
        onPrev(); // Swipe Right -> Prev
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch((err) => console.error('Video play failed:', err));
    } else {
      videoRef.current.pause();
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    setIsBuffering(true);
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + seconds));
  }, []);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  }, []);

  const adjustVolume = useCallback((delta: number) => {
    if (!videoRef.current) return;
    const newVol = Math.max(0, Math.min(1, volume + delta));
    videoRef.current.volume = newVol;
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
    }
  }, [volume, isMuted]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
    }
  }, []);

  // Sync fullscreen state from the browser event (reliable on all browsers)
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(5);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(-5);
          break;
        case 'KeyL':
          e.preventDefault();
          seek(10);
          break;
        case 'KeyJ':
          e.preventDefault();
          seek(-10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          adjustVolume(0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          adjustVolume(-0.1);
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seek, adjustVolume, toggleMute, toggleFullscreen, onClose]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl select-none"
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        preload="metadata"
        src={media.streamUrl}
        onClick={togglePlay}
        onPlay={() => {
          setIsPlaying(true);
          setIsBuffering(false);
          if (videoRef.current && playbackRate !== 1) {
            videoRef.current.playbackRate = playbackRate;
          }
        }}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          if (videoRef.current && playbackRate !== 1) {
            videoRef.current.playbackRate = playbackRate;
          }
          captureThumbnail();
        }}
        onSeeking={() => setIsBuffering(true)}
        onSeeked={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onCanPlayThrough={() => setIsBuffering(false)}
        onLoadedData={() => {
          setIsBuffering(false);
          captureThumbnail();
        }}
        onTimeUpdate={() => {
          if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
            if (isBuffering && !videoRef.current.paused) {
              setIsBuffering(false);
            }
            if (videoRef.current.currentTime >= 0.5) {
              captureThumbnail();
            }
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            videoRef.current.playbackRate = playbackRate;
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          if (onNext) onNext();
        }}
        onError={async () => {
          setIsBuffering(false);
          // Check if session is expired
          try {
            const authCheck = await fetch('/api/albums');
            if (authCheck.status === 401) {
              window.location.href = '/login';
              return;
            }
          } catch (e) {}
          setHasError(true);
        }}
        className="max-h-screen w-full object-contain cursor-pointer"
      />

      {/* Video Error / Session Expired Banner */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/80 backdrop-blur-md p-6">
          <div className="max-w-md w-full glass-panel p-6 rounded-3xl border border-zinc-800 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-3">
              <Info className="w-6 h-6 text-amber-400" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">Playback Error</h4>
            <p className="text-xs text-zinc-400 mb-6">
              Could not load video stream. Your connection may have timed out or the stream was interrupted.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setHasError(false);
                  setIsBuffering(true);
                  if (videoRef.current) {
                    videoRef.current.load();
                    videoRef.current.play().catch(() => {});
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md shadow-blue-600/30"
              >
                Retry Playback
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Close Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Buffering Indicator Overlay */}
      {isBuffering && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 bg-black/30 backdrop-blur-[2px]">
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-blue-400 flex items-center gap-3 shadow-2xl">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            <span className="text-xs font-semibold text-zinc-200">Buffering video...</span>
          </div>
        </div>
      )}

      {/* Sideways Navigation Buttons (Previous / Next Media) */}
      {onPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          title="Previous Media"
          className={`absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2.5 sm:p-3.5 rounded-full bg-zinc-900/85 hover:bg-blue-600 text-zinc-200 hover:text-white border border-zinc-700/80 hover:border-blue-500 backdrop-blur-md z-40 transition-all duration-200 shadow-2xl ${
            showOverlay ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}

      {onNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          title="Next Media"
          className={`absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2.5 sm:p-3.5 rounded-full bg-zinc-900/85 hover:bg-blue-600 text-zinc-200 hover:text-white border border-zinc-700/80 hover:border-blue-500 backdrop-blur-md z-40 transition-all duration-200 shadow-2xl ${
            showOverlay ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      )}

      {/* Top Header Overlay */}
      <div
        className={`absolute top-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 z-20 gap-2 ${
          showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="min-w-0">
          <h3 className="text-xs sm:text-sm font-bold text-white font-mono truncate max-w-[35vw] sm:max-w-xs">{media.fileName}</h3>
          <p className="text-[10px] sm:text-xs text-zinc-400">
            {formatBytes(media.size)} {currentIndex !== undefined && totalCount ? `• ${currentIndex + 1} of ${totalCount}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {/* Favorite Button */}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              const nextState = !media.isFavorite;
              media.isFavorite = nextState;
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
              } catch (err) {}
            }}
            title={media.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className={`p-2 sm:p-2.5 rounded-full border transition-all ${
              media.isFavorite
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/70'
            }`}
          >
            <Star className={`w-4 h-4 sm:w-5 sm:h-5 ${media.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>

          {/* Download Button */}
          <a
            href={`${media.streamUrl}&download=true`}
            download={media.fileName}
            onClick={(e) => e.stopPropagation()}
            title="Download video"
            className="p-2 sm:p-2.5 rounded-full bg-zinc-900/80 hover:bg-emerald-600 text-zinc-300 hover:text-white border border-zinc-700/70 transition-all"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/70"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      {/* Bottom Controls Bar Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-3 sm:p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-20 ${
          showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Timeline Seekbar */}
        <div className="flex items-center space-x-2 sm:space-x-3 mb-2 sm:mb-4">
          <span className="text-[10px] sm:text-xs font-mono text-zinc-300">{formatDuration(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => {
              const newTime = parseFloat(e.target.value);
              if (videoRef.current) videoRef.current.currentTime = newTime;
              setCurrentTime(newTime);
            }}
            className="flex-1 h-1.5 bg-zinc-700 accent-blue-500 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] sm:text-xs font-mono text-zinc-400">{formatDuration(duration)}</span>
        </div>

        {/* Buttons Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              onClick={togglePlay}
              className="p-2 sm:p-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/30"
            >
              {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-white" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white translate-x-0.5" />}
            </button>

            <button onClick={() => seek(-5)} title="-5s" className="text-zinc-400 hover:text-white transition-colors">
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            <button onClick={() => seek(5)} title="+5s" className="text-zinc-400 hover:text-white transition-colors">
              <RotateCw className="w-5 h-5" />
            </button>

            {/* Volume Control */}
            <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-zinc-800">
              <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition-colors">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (videoRef.current) videoRef.current.volume = val;
                }}
            {/* Playback Speed Selector */}
            <div className="flex items-center space-x-1 pl-2 border-l border-zinc-800">
              {[0.5, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => changeSpeed(rate)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all ${
                    playbackRate === rate
                      ? 'bg-blue-600 text-white font-bold'
                      : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center space-x-3">
            {/* Keyboard Shortcuts Tooltip */}
            <div className="hidden sm:flex items-center space-x-2 text-[11px] font-mono text-zinc-400 bg-zinc-900/80 px-3 py-1 rounded-lg border border-zinc-800">
              <span>Space: Play/Pause</span>
              <span>•</span>
              <span>←/→: ±5s</span>
              <span>•</span>
              <span>F: Fullscreen</span>
            </div>

            <button onClick={toggleFullscreen} className="text-zinc-400 hover:text-white p-2 rounded-lg transition-colors">
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
