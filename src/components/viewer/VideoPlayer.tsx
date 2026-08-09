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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const overlayTimeout = useRef<NodeJS.Timeout | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

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
        preload="auto"
        src={media.streamUrl}
        onClick={togglePlay}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onSeeking={() => setIsBuffering(true)}
        onSeeked={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
        onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
        onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)}
        onEnded={() => setIsPlaying(false)}
        className="max-h-screen w-full object-contain cursor-pointer"
      />

      {/* Buffering Indicator Overlay */}
      {isBuffering && (
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
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-300 z-20 ${
          showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div>
          <h3 className="text-sm font-bold text-white font-mono">{media.fileName}</h3>
          <p className="text-xs text-zinc-400">
            {formatBytes(media.size)} {currentIndex !== undefined && totalCount ? `• ${currentIndex + 1} of ${totalCount}` : ''}
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/70"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom Controls Bar Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-20 ${
          showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Timeline Seekbar */}
        <div className="flex items-center space-x-3 mb-4">
          <span className="text-xs font-mono text-zinc-300">{formatDuration(currentTime)}</span>
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
          <span className="text-xs font-mono text-zinc-400">{formatDuration(duration)}</span>
        </div>

        {/* Buttons Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={togglePlay}
              className="p-2.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/30"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white translate-x-0.5" />}
            </button>

            <button onClick={() => seek(-5)} title="-5s (Left Arrow)" className="text-zinc-400 hover:text-white transition-colors">
              <RotateCcw className="w-5 h-5" />
            </button>

            <button onClick={() => seek(5)} title="+5s (Right Arrow)" className="text-zinc-400 hover:text-white transition-colors">
              <RotateCw className="w-5 h-5" />
            </button>

            {/* Volume Control */}
            <div className="flex items-center space-x-2 pl-2 border-l border-zinc-800">
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
                className="w-20 h-1 bg-zinc-700 accent-blue-500 rounded cursor-pointer"
              />
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
