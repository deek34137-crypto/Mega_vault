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
  Subtitles,
  Tv,
  PictureInPicture,
  Upload,
  FileText,
  Zap,
} from 'lucide-react';
import { formatBytes, formatDuration } from '@/lib/utils/cn';
import { MediaItem } from '@/types';
import Hls from 'hls.js';

function convertSrtToVtt(srt: string): string {
  const normalized = srt.trim().replace(/\r\n|\r/g, '\n');
  const converted = normalized.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${converted}`;
}

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
  const [isBuffering, setIsBuffering] = useState(false);
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

  // Captions & Subtitles States
  const [showCaptions, setShowCaptions] = useState(false);
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);
  const [isCaptionModalOpen, setIsCaptionModalOpen] = useState(false);
  const [captionInputUrl, setCaptionInputUrl] = useState('');

  // TV / 10-foot UI Mode (Auto-detects Samsung TV, Tizen, and Smart TVs)
  const [isTvMode, setIsTvMode] = useState(false);

  useEffect(() => {
    try {
      const savedTv = localStorage.getItem('megavault_tv_mode');
      const isTvDevice =
        typeof window !== 'undefined' &&
        /SmartTV|Tizen|SAMSUNG|SamsungBrowser|Web0S|AppleTV|GoogleTV|Android.*TV|HbbTV/i.test(
          navigator.userAgent
        );
      if (savedTv === 'true' || (savedTv === null && isTvDevice)) {
        setIsTvMode(true);
      }
    } catch {}
  }, []);

  const handleToggleTvMode = useCallback(() => {
    setIsTvMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('megavault_tv_mode', next ? 'true' : 'false');
        if (next) {
          document.documentElement.classList.add('tv-ui');
          document.body.classList.add('tv-ui');
        } else {
          document.documentElement.classList.remove('tv-ui');
          document.body.classList.remove('tv-ui');
        }
      } catch {}
      return next;
    });
  }, []);

  // Smooth debounced buffering check (eliminates 2-3x/sec strobe buffering spinner)
  const bufferingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startBufferingCheck = useCallback(() => {
    if (bufferingTimerRef.current) clearTimeout(bufferingTimerRef.current);
    bufferingTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && videoRef.current.readyState < 3) {
        setIsBuffering(true);
      }
    }, 450);
  }, []);

  const stopBuffering = useCallback(() => {
    if (bufferingTimerRef.current) {
      clearTimeout(bufferingTimerRef.current);
      bufferingTimerRef.current = null;
    }
    setIsBuffering(false);
  }, []);

  const toggleCaptions = useCallback(() => {
    if (!subtitleUrl) {
      setIsCaptionModalOpen(true);
    } else {
      setShowCaptions((prev) => !prev);
    }
  }, [subtitleUrl]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const vtt = file.name.endsWith('.srt') ? convertSrtToVtt(text) : text;
      const blob = new Blob([vtt], { type: 'text/vtt' });
      setSubtitleUrl(URL.createObjectURL(blob));
      setShowCaptions(true);
      setIsCaptionModalOpen(false);
    };
    reader.readAsText(file);
  };

  const handleApplyCaptionUrl = async (url: string) => {
    if (!url.trim()) return;
    try {
      const res = await fetch(url.trim());
      if (res.ok) {
        const text = await res.text();
        const vtt = url.includes('.srt') ? convertSrtToVtt(text) : text;
        const blob = new Blob([vtt], { type: 'text/vtt' });
        setSubtitleUrl(URL.createObjectURL(blob));
        setShowCaptions(true);
        setIsCaptionModalOpen(false);
        return;
      }
    } catch {}
    setSubtitleUrl(url.trim());
    setShowCaptions(true);
    setIsCaptionModalOpen(false);
  };

  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  }, []);

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

  // Support HLS (.m3u8) playback with adaptive high-definition streaming & smooth buffer
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !media.streamUrl) return;

    const stream = media.streamUrl;
    const isHls = stream.includes('.m3u8') || media.mimeType?.includes('mpegurl');

    let hlsInstance: Hls | null = null;

    if (isHls && Hls.isSupported()) {
      const isTv =
        isTvMode ||
        (typeof window !== 'undefined' &&
          /SmartTV|Tizen|SAMSUNG|SamsungBrowser|Web0S/i.test(navigator.userAgent));

      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: false, // Critical: disable low-latency mode for smooth VOD playback without stalls
        backBufferLength: isTv ? 20 : 60,
        maxBufferLength: isTv ? 40 : 120, // Lightweight for TV RAM
        maxMaxBufferLength: isTv ? 80 : 600,
        maxBufferSize: isTv ? 32 * 1024 * 1024 : 128 * 1024 * 1024, // 32MB cache avoids Tizen browser memory crashes
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        capLevelToPlayerSize: false,
        progressive: true,
      });

      hlsInstance.loadSource(stream);
      hlsInstance.attachMedia(video);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (data && data.levels && data.levels.length > 0) {
          // Immediately select the highest quality level available (1080p FHD) for crisp playback
          let highestIndex = 0;
          let maxScore = 0;
          data.levels.forEach((lvl, idx) => {
            const score = (lvl.height || 0) * 10000 + (lvl.bitrate || 0);
            if (score > maxScore) {
              maxScore = score;
              highestIndex = idx;
            }
          });
          if (hlsInstance && highestIndex >= 0) {
            hlsInstance.currentLevel = highestIndex;
          }
        }
        video.play().catch(() => {});
      });

      hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hlsInstance?.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hlsInstance?.recoverMediaError();
              break;
            default:
              setHasError(true);
              break;
          }
        }
      });
    } else {
      // Direct MP4 / WebM / native Safari HLS
      if (video.src !== stream) {
        video.src = stream;
        video.load();
        video.play().catch(() => {});
      }
    }

    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
      }
    };
  }, [media.streamUrl, media.mimeType]);

  const captureThumbnail = useCallback(() => {
    if (capturedRef.current || !videoRef.current || media.albumId === 'web-extracted' || !media.fileHandle) return;
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

  // Auto hide control overlay after inactivity (5s for TV mode, 3s for desktop)
  const handleMouseMove = useCallback(() => {
    setShowOverlay(true);
    if (overlayTimeout.current) clearTimeout(overlayTimeout.current);
    const timeout = isTvMode ? 5000 : 3000;
    overlayTimeout.current = setTimeout(() => setShowOverlay(false), timeout);
  }, [isTvMode]);

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

  // Keyboard & Samsung TV Remote Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const code = e.code || '';
      const key = e.key || '';
      const keyCode = e.keyCode || e.which || 0;

      // Wake up overlay on any remote/keyboard interaction
      handleMouseMove();

      // 1. Samsung Tizen Remote RETURN Key (keyCode 10009) & Back / Escape
      if (
        keyCode === 10009 ||
        key === 'Return' ||
        key === 'XF86Back' ||
        key === 'BrowserBack' ||
        key === 'GoBack' ||
        code === 'Escape' ||
        code === 'Backspace' ||
        key === 'Escape' ||
        key === 'Backspace'
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (isCaptionModalOpen) {
          setIsCaptionModalOpen(false);
        } else {
          onClose();
        }
        return;
      }

      // 2. Play / Pause (Samsung Remote Play 415, Pause 19, PlayPause 10252, Space 32)
      if (
        keyCode === 415 ||
        keyCode === 19 ||
        keyCode === 10252 ||
        keyCode === 32 ||
        key === 'MediaPlayPause' ||
        key === 'MediaPlay' ||
        key === 'MediaPause' ||
        code === 'Space' ||
        code === 'KeyK'
      ) {
        e.preventDefault();
        togglePlay();
        return;
      }

      // 3. Fast Forward & Rewind (Samsung FF 417, Rewind 412)
      if (keyCode === 417 || key === 'MediaFastForward' || code === 'KeyL') {
        e.preventDefault();
        seek(15);
        return;
      }
      if (keyCode === 412 || key === 'MediaRewind' || code === 'KeyJ') {
        e.preventDefault();
        seek(-15);
        return;
      }

      // 4. Directional D-Pad Seek (Arrow Right / Left, keyCodes 39 / 37)
      if (keyCode === 39 || key === 'ArrowRight' || code === 'ArrowRight') {
        e.preventDefault();
        seek(10);
        return;
      }
      if (keyCode === 37 || key === 'ArrowLeft' || code === 'ArrowLeft') {
        e.preventDefault();
        seek(-10);
        return;
      }

      // 5. Volume Adjustments (Arrow Up / Down, keyCodes 38 / 40)
      if (keyCode === 38 || key === 'ArrowUp' || code === 'ArrowUp') {
        e.preventDefault();
        adjustVolume(0.1);
        return;
      }
      if (keyCode === 40 || key === 'ArrowDown' || code === 'ArrowDown') {
        e.preventDefault();
        adjustVolume(-0.1);
        return;
      }

      // 6. Select / OK Key (keyCode 13)
      if (keyCode === 13 || key === 'Enter' || key === 'Select' || code === 'Enter' || code === 'NumpadEnter') {
        if (document.activeElement === document.body || document.activeElement === containerRef.current) {
          e.preventDefault();
          togglePlay();
        }
        return;
      }

      // 7. Stop Key (Samsung Stop 413)
      if (keyCode === 413 || key === 'MediaStop') {
        e.preventDefault();
        if (videoRef.current) videoRef.current.pause();
        return;
      }

      // 8. Fullscreen (KeyF)
      if (code === 'KeyF' || key === 'f' || key === 'F') {
        e.preventDefault();
        toggleFullscreen();
        return;
      }

      // 9. Mute (KeyM)
      if (code === 'KeyM' || key === 'm' || key === 'M') {
        e.preventDefault();
        toggleMute();
        return;
      }

      // 10. Subtitles (KeyC or Samsung Remote Red Button 403)
      if (code === 'KeyC' || key === 'c' || key === 'C' || keyCode === 403) {
        e.preventDefault();
        toggleCaptions();
        return;
      }

      // 11. TV Mode (KeyT or Samsung Remote Yellow Button 405)
      if (code === 'KeyT' || key === 't' || key === 'T' || keyCode === 405) {
        e.preventDefault();
        handleToggleTvMode();
        return;
      }

      // 12. PiP (KeyP)
      if (code === 'KeyP' || key === 'p' || key === 'P') {
        e.preventDefault();
        togglePiP();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleMouseMove,
    togglePlay,
    seek,
    adjustVolume,
    toggleMute,
    toggleFullscreen,
    toggleCaptions,
    handleToggleTvMode,
    togglePiP,
    isCaptionModalOpen,
    onClose,
  ]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl select-none ${
        isTvMode ? 'tv-mode text-lg' : ''
      }`}
    >
      {/* HTML5 Video Element with AirPlay & Casting support */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        preload="auto"
        controlsList="nodownload"
        x-webkit-airplay="allow"
        onClick={togglePlay}
        onPlay={() => {
          setIsPlaying(true);
          stopBuffering();
          if (videoRef.current && playbackRate !== 1) {
            videoRef.current.playbackRate = playbackRate;
          }
        }}
        onPause={() => setIsPlaying(false)}
        onWaiting={startBufferingCheck}
        onPlaying={() => {
          stopBuffering();
          if (videoRef.current && playbackRate !== 1) {
            videoRef.current.playbackRate = playbackRate;
          }
          captureThumbnail();
        }}
        onSeeking={startBufferingCheck}
        onSeeked={stopBuffering}
        onCanPlay={stopBuffering}
        onCanPlayThrough={stopBuffering}
        onLoadedData={() => {
          stopBuffering();
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
      >
        {subtitleUrl && showCaptions && (
          <track
            kind="subtitles"
            src={subtitleUrl}
            srcLang="en"
            label="English"
            default
          />
        )}
      </video>

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
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          title="Previous Media"
          className={`absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 ${
            isTvMode ? 'p-3.5 sm:p-4' : 'p-2.5 sm:p-3.5'
          } rounded-full bg-zinc-900/85 hover:bg-blue-600 text-zinc-200 hover:text-white border border-zinc-700/80 hover:border-blue-500 backdrop-blur-md z-40 transition-all duration-200 shadow-2xl ${
            showOverlay ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          <ChevronLeft className={`${isTvMode ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-5 h-5 sm:w-6 sm:h-6'}`} />
        </button>
      )}

      {onNext && (
        <button
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          title="Next Media"
          className={`absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 ${
            isTvMode ? 'p-3.5 sm:p-4' : 'p-2.5 sm:p-3.5'
          } rounded-full bg-zinc-900/85 hover:bg-blue-600 text-zinc-200 hover:text-white border border-zinc-700/80 hover:border-blue-500 backdrop-blur-md z-40 transition-all duration-200 shadow-2xl ${
            showOverlay ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          }`}
        >
          <ChevronRight className={`${isTvMode ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-5 h-5 sm:w-6 sm:h-6'}`} />
        </button>
      )}

      {/* Top Header Overlay */}
      <div
        className={`absolute top-0 left-0 right-0 ${
          isTvMode
            ? 'p-4 sm:p-6 bg-gradient-to-b from-black/95 via-black/60 to-transparent'
            : 'p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent'
        } flex items-center justify-between transition-opacity duration-300 z-20 gap-2 ${
          showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <h3
              className={`${
                isTvMode ? 'text-sm sm:text-xl' : 'text-xs sm:text-sm'
              } font-bold text-white font-mono truncate max-w-[40vw] sm:max-w-md`}
            >
              {media.fileName}
            </h3>
            <span
              className={`${
                isTvMode ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]'
              } rounded-full font-mono font-black bg-purple-500/20 text-purple-300 border border-purple-500/40`}
            >
              {media.quality ||
                (media.streamUrl?.includes('1080')
                  ? '1080p FHD'
                  : media.streamUrl?.includes('720')
                  ? '720p HD'
                  : 'HD')}
            </span>
            {isTvMode && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                <Tv className="w-3.5 h-3.5 text-indigo-400" />
                <span>TV Mode</span>
              </span>
            )}
          </div>
          <p className={`${isTvMode ? 'text-xs sm:text-sm text-zinc-300' : 'text-[10px] sm:text-xs text-zinc-400'} mt-0.5`}>
            {formatBytes(media.size)}{' '}
            {currentIndex !== undefined && totalCount ? `• ${currentIndex + 1} of ${totalCount}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
          {/* Subtitles / Captions Button */}
          <div className="relative flex items-center">
            <button
              tabIndex={0}
              onClick={toggleCaptions}
              onContextMenu={(e) => {
                e.preventDefault();
                setIsCaptionModalOpen(true);
              }}
              title={
                showCaptions
                  ? 'Subtitles: ON (Click to toggle, right-click for settings) (C)'
                  : subtitleUrl
                  ? 'Subtitles: OFF (Click to turn on, right-click for settings) (C)'
                  : 'Subtitles / Closed Captions (C)'
              }
              className={`${
                isTvMode ? 'p-3 sm:p-3.5' : 'p-2 sm:p-2.5'
              } rounded-full border transition-all focus-visible:ring-4 focus-visible:ring-purple-400 ${
                showCaptions && subtitleUrl
                  ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                  : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/70'
              }`}
            >
              <Subtitles className={`${isTvMode ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-4 h-4 sm:w-5 sm:h-5'}`} />
            </button>
            {subtitleUrl && (
              <button
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCaptionModalOpen(true);
                }}
                title="Subtitle Settings"
                className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-zinc-800 hover:bg-purple-600 text-zinc-300 hover:text-white border border-zinc-600 flex items-center justify-center text-[9px] font-bold shadow"
              >
                ⚙
              </button>
            )}
          </div>

          {/* TV Big Screen 10-foot Mode Toggle */}
          <button
            tabIndex={0}
            onClick={handleToggleTvMode}
            title={isTvMode ? 'Exit TV Mode (T)' : 'TV Big Screen Mode (T)'}
            className={`${
              isTvMode ? 'p-3 sm:p-3.5' : 'p-2 sm:p-2.5'
            } rounded-full border transition-all focus-visible:ring-4 focus-visible:ring-purple-400 ${
              isTvMode
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/50'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/70'
            }`}
          >
            <Tv className={`${isTvMode ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-4 h-4 sm:w-5 sm:h-5'}`} />
          </button>

          {/* Picture-in-Picture */}
          <button
            tabIndex={0}
            onClick={togglePiP}
            title="Picture-in-Picture (P)"
            className={`${
              isTvMode ? 'p-3 sm:p-3.5' : 'p-2 sm:p-2.5'
            } rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/70 transition-all focus-visible:ring-4 focus-visible:ring-purple-400`}
          >
            <PictureInPicture className={`${isTvMode ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-4 h-4 sm:w-5 sm:h-5'}`} />
          </button>

          {/* Favorite Button */}
          <button
            tabIndex={0}
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
            className={`${
              isTvMode ? 'p-3 sm:p-3.5' : 'p-2 sm:p-2.5'
            } rounded-full border transition-all ${
              media.isFavorite
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/70'
            }`}
          >
            <Star
              className={`${isTvMode ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-4 h-4 sm:w-5 sm:h-5'} ${
                media.isFavorite ? 'fill-amber-400 text-amber-400' : ''
              }`}
            />
          </button>

          {/* Open in FastStream (Open Source Zero-Buffering Player) */}
          <a
            tabIndex={0}
            href={`https://faststream.online/#${encodeURIComponent(media.streamUrl || '')}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in FastStream Player (Zero-Buffering External Player)"
            onClick={(e) => e.stopPropagation()}
            className={`hidden sm:flex items-center gap-1.5 ${
              isTvMode ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'
            } rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/40 hover:to-orange-500/40 text-amber-300 border border-amber-500/40 font-bold transition-all shadow-sm`}
          >
            <Zap className={`${isTvMode ? 'w-4 h-4' : 'w-3.5 h-3.5'} fill-amber-400 text-amber-400`} />
            <span>FastStream</span>
          </a>

          {/* Download Button */}
          <a
            tabIndex={0}
            href={`${media.streamUrl}&download=true`}
            download={media.fileName}
            onClick={(e) => e.stopPropagation()}
            title="Download video"
            className={`${
              isTvMode ? 'p-3 sm:p-3.5' : 'p-2 sm:p-2.5'
            } rounded-full bg-zinc-900/80 hover:bg-emerald-600 text-zinc-300 hover:text-white border border-zinc-700/70 transition-all`}
          >
            <Download className={`${isTvMode ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-4 h-4 sm:w-5 sm:h-5'}`} />
          </a>

          <button
            tabIndex={0}
            onClick={onClose}
            className={`${
              isTvMode ? 'p-3 sm:p-3.5' : 'p-2 sm:p-2.5'
            } rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700/70`}
          >
            <X className={`${isTvMode ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-4 h-4 sm:w-5 sm:h-5'}`} />
          </button>
        </div>
      </div>

      {/* Bottom Controls Bar Overlay */}
      <div
        className={`absolute bottom-0 left-0 right-0 ${
          isTvMode
            ? 'p-4 sm:p-8 bg-gradient-to-t from-black/95 via-black/70 to-transparent'
            : 'p-3 sm:p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent'
        } transition-opacity duration-300 z-20 ${
          showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Timeline Seekbar */}
        <div className={`flex items-center space-x-2 sm:space-x-4 ${isTvMode ? 'mb-3 sm:mb-5' : 'mb-2 sm:mb-4'}`}>
          <span
            className={`${
              isTvMode ? 'text-xs sm:text-sm font-bold text-zinc-200' : 'text-[10px] sm:text-xs text-zinc-300'
            } font-mono`}
          >
            {formatDuration(currentTime)}
          </span>
          <input
            tabIndex={0}
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => {
              const newTime = parseFloat(e.target.value);
              if (videoRef.current) videoRef.current.currentTime = newTime;
              setCurrentTime(newTime);
            }}
            className={`flex-1 ${
              isTvMode ? 'h-3 sm:h-3.5 tv-range' : 'h-1.5'
            } bg-zinc-700/80 accent-blue-500 rounded-lg cursor-pointer`}
          />
          <span
            className={`${
              isTvMode ? 'text-xs sm:text-sm font-bold text-zinc-200' : 'text-[10px] sm:text-xs text-zinc-400'
            } font-mono`}
          >
            {formatDuration(duration)}
          </span>
        </div>

        {/* Buttons Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              tabIndex={0}
              onClick={togglePlay}
              className={`${
                isTvMode ? 'p-3.5 sm:p-4 rounded-2xl' : 'p-2 sm:p-2.5 rounded-full'
              } bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/30`}
            >
              {isPlaying ? (
                <Pause className={`${isTvMode ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-4 h-4 sm:w-5 sm:h-5'} fill-white`} />
              ) : (
                <Play
                  className={`${
                    isTvMode ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-4 h-4 sm:w-5 sm:h-5'
                  } fill-white translate-x-0.5`}
                />
              )}
            </button>

            <button
              tabIndex={0}
              onClick={() => seek(-5)}
              title="-5s"
              className={`${
                isTvMode ? 'p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200' : 'text-zinc-400 hover:text-white'
              } transition-colors`}
            >
              <RotateCcw className={`${isTvMode ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-4 h-4 sm:w-5 sm:h-5'}`} />
            </button>

            <button
              tabIndex={0}
              onClick={() => seek(5)}
              title="+5s"
              className={`${
                isTvMode ? 'p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200' : 'text-zinc-400 hover:text-white'
              } transition-colors`}
            >
              <RotateCw className={`${isTvMode ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-5 h-5'}`} />
            </button>

            {/* Volume Control */}
            <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-zinc-800">
              <button
                tabIndex={0}
                onClick={toggleMute}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className={`${isTvMode ? 'w-6 h-6' : 'w-5 h-5'} text-red-400`} />
                ) : (
                  <Volume2 className={`${isTvMode ? 'w-6 h-6' : 'w-5 h-5'}`} />
                )}
              </button>
              <input
                tabIndex={0}
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
                className={`${
                  isTvMode ? 'w-24 sm:w-28 h-2' : 'w-16 sm:w-20 h-1'
                } bg-zinc-700 accent-blue-500 rounded cursor-pointer`}
              />
            </div>

            {/* Playback Speed Selector */}
            <div className="flex items-center space-x-1 pl-2 border-l border-zinc-800">
              {[0.5, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                <button
                  tabIndex={0}
                  key={rate}
                  onClick={() => changeSpeed(rate)}
                  className={`${
                    isTvMode ? 'px-2.5 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]'
                  } rounded font-mono transition-all ${
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
            {/* Keyboard & Remote Shortcuts Tooltip */}
            <div className="hidden sm:flex items-center space-x-2 text-[11px] font-mono text-zinc-400 bg-zinc-900/80 px-3 py-1 rounded-lg border border-zinc-800">
              <span>OK/Space: Play</span>
              <span>•</span>
              <span>◄/►: ±10s</span>
              <span>•</span>
              <span>F: Full</span>
            </div>

            <button
              tabIndex={0}
              onClick={toggleFullscreen}
              className={`${
                isTvMode ? 'p-3 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200' : 'text-zinc-400 hover:text-white p-2'
              } rounded-lg transition-colors`}
            >
              {isFullscreen ? (
                <Minimize className={`${isTvMode ? 'w-6 h-6' : 'w-5 h-5'}`} />
              ) : (
                <Maximize className={`${isTvMode ? 'w-6 h-6' : 'w-5 h-5'}`} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Subtitles & Captions Settings Modal */}
      {isCaptionModalOpen && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCaptionModalOpen(false);
          }}
          className="absolute inset-0 flex items-center justify-center z-50 bg-black/85 backdrop-blur-md p-4 animate-fadeIn"
        >
          <div className="max-w-md w-full glass-panel p-6 rounded-3xl border border-zinc-700/80 shadow-2xl relative text-left">
            <button
              onClick={() => setIsCaptionModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Subtitles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Subtitles & Closed Captions</h3>
                <p className="text-[11px] text-zinc-400">Stream or upload external WebVTT (.vtt) or SubRip (.srt) subtitles</p>
              </div>
            </div>

            {/* Current Subtitle Status */}
            {subtitleUrl && (
              <div className="mb-4 p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-semibold text-purple-200">
                    Track Loaded ({showCaptions ? 'Visible' : 'Hidden'})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCaptions((prev) => !prev)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-purple-600/70 hover:bg-purple-600 text-white font-medium transition-colors"
                  >
                    {showCaptions ? 'Hide Captions' : 'Show Captions'}
                  </button>
                  <button
                    onClick={() => {
                      setSubtitleUrl(null);
                      setShowCaptions(false);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-red-600/40 hover:bg-red-600 text-red-200 font-medium transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* Paste Subtitle URL */}
            <div className="space-y-1.5 mb-4">
              <label className="text-xs font-semibold text-zinc-300">Subtitle Stream / VTT / SRT URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://example.com/subtitles.vtt"
                  value={captionInputUrl}
                  onChange={(e) => setCaptionInputUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleApplyCaptionUrl(captionInputUrl);
                    }
                  }}
                  className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <button
                  onClick={() => handleApplyCaptionUrl(captionInputUrl)}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-600/30 transition-all"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Or Upload File */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300">Or Upload Subtitle File (.srt or .vtt)</label>
              <label className="flex items-center justify-center gap-2.5 p-3.5 rounded-xl border border-dashed border-zinc-700/80 hover:border-purple-500/80 bg-zinc-900/60 hover:bg-purple-950/20 cursor-pointer transition-all group">
                <Upload className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-zinc-300 group-hover:text-purple-200">Select file from device (.vtt, .srt)</span>
                <input
                  type="file"
                  accept=".vtt,.srt,text/vtt,application/x-subrip"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
