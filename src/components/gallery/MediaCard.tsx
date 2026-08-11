'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Film, Image as ImageIcon, Check, Star } from 'lucide-react';
import { MediaItem } from '@/types';
import { formatBytes } from '@/lib/utils/cn';

interface MediaCardProps {
  media: MediaItem;
  onClick?: (media: MediaItem) => void;
  isSelectMode?: boolean;
  isSelected?: boolean;
  onSelectToggle?: (media: MediaItem) => void;
  onFavoriteToggle?: (media: MediaItem, isFav: boolean) => void;
}

function getGradientFromFileName(name: string): string {
  const gradients = [
    'from-blue-900/80 via-indigo-950/90 to-zinc-950',
    'from-purple-900/80 via-slate-950/90 to-zinc-950',
    'from-cyan-900/80 via-blue-950/90 to-zinc-950',
    'from-emerald-900/80 via-teal-950/90 to-zinc-950',
    'from-rose-900/80 via-zinc-950/90 to-zinc-950',
    'from-amber-900/80 via-zinc-950/90 to-zinc-950',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

const sampledCache = new Map<string, string>();

async function sampleVideoFrame(streamUrl: string, albumId: string, handle: string): Promise<string | null> {
  const cacheKey = `${albumId}_${handle}`;
  if (sampledCache.has(cacheKey)) return sampledCache.get(cacheKey)!;

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';
    video.src = streamUrl;

    const timeout = setTimeout(() => {
      video.remove();
      resolve(null);
    }, 10000);

    video.onloadeddata = () => {
      video.currentTime = 1.0;
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const aspect = (video.videoWidth || 16) / (video.videoHeight || 9);
        const targetWidth = 400;
        canvas.width = targetWidth;
        canvas.height = Math.round(targetWidth / aspect);

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          sampledCache.set(cacheKey, dataUrl);

          // Save thumbnail in background DB
          fetch('/api/mega/thumbnail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ albumId, handle, thumbnailDataUrl: dataUrl }),
          }).catch(() => {});

          resolve(dataUrl);
        } else {
          resolve(null);
        }
      } catch (err) {
        resolve(null);
      } finally {
        video.remove();
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      video.remove();
      resolve(null);
    };
  });
}

export const MediaCard: React.FC<MediaCardProps> = ({
  media,
  onClick,
  isSelectMode = false,
  isSelected = false,
  onSelectToggle,
  onFavoriteToggle,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isFavorite, setIsFavorite] = useState(media.isFavorite || false);
  const [sampledThumbnail, setSampledThumbnail] = useState<string | null>(media.thumbnailUrl || null);

  useEffect(() => {
    setIsFavorite(media.isFavorite || false);
  }, [media.isFavorite]);

  const isVideo = media.mediaType === 'VIDEO';
  const ext = media.fileName.split('.').pop()?.toUpperCase() || (isVideo ? 'VIDEO' : 'IMG');
  const gradient = getGradientFromFileName(media.fileName);

  useEffect(() => {
    if (isVideo && isVisible && !media.thumbnailUrl && !sampledThumbnail && media.streamUrl) {
      sampleVideoFrame(media.streamUrl, media.albumId, media.fileHandle).then((thumb) => {
        if (thumb) setSampledThumbnail(thumb);
      });
    }
  }, [isVideo, isVisible, media.thumbnailUrl, media.streamUrl, media.albumId, media.fileHandle, sampledThumbnail]);

  // Lazy load media ONLY when card enters browser viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextFavState = !isFavorite;
    setIsFavorite(nextFavState);
    if (onFavoriteToggle) {
      onFavoriteToggle(media, nextFavState);
    }

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
    } catch (err) {
      console.error('Failed to update favorite status:', err);
    }
  };

  return (
    <motion.div
      ref={cardRef}
      whileHover={{ y: -3, scale: 1.02 }}
      transition={{ duration: 0.2 }}
      onClick={() => {
        if (isSelectMode && onSelectToggle) {
          onSelectToggle(media);
        } else if (onClick) {
          onClick(media);
        }
      }}
      className={`glass-panel glass-panel-hover rounded-2xl overflow-hidden group cursor-pointer border relative bg-zinc-950 flex flex-col h-full shadow-md transition-all ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-zinc-800/80'
      }`}
    >
      {/* Checkbox Badge in Select Mode */}
      {(isSelectMode || isSelected) && (
        <div className="absolute top-2.5 right-2.5 z-30">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
              isSelected
                ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                : 'bg-black/60 border-white/40 text-transparent'
            }`}
          >
            <Check className="w-4 h-4 stroke-[3]" />
          </div>
        </div>
      )}

      {/* Star Favorite Button */}
      {!isSelectMode && (
        <button
          onClick={handleFavoriteClick}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          className={`absolute top-2.5 right-2.5 z-30 p-1.5 rounded-xl border backdrop-blur-md transition-all duration-200 ${
            isFavorite
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 opacity-100 shadow-md shadow-amber-500/10'
              : 'bg-black/40 border-white/10 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-amber-400 hover:border-amber-500/30'
          }`}
        >
          <Star className={`w-4 h-4 transition-transform ${isFavorite ? 'fill-amber-400 scale-110' : ''}`} />
        </button>
      )}

      {/* Media Cover / Preview Container */}
      <div className="relative aspect-square w-full bg-zinc-900 overflow-hidden flex flex-col justify-between">
        {!isVideo && isVisible && media.streamUrl && !imageError ? (
          /* Lazy loaded image from fast stream cache */
          <div className="relative w-full h-full bg-zinc-950 overflow-hidden">
            <img
              src={media.thumbnailUrl || media.streamUrl}
              alt={media.fileName}
              loading="lazy"
              decoding="async"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
              className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ease-out ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {!imageLoaded && (
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} p-3.5 flex flex-col justify-between shimmer-effect`}>
                <div className="flex items-center justify-between z-10">
                  <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-extrabold text-zinc-200 border border-white/10 uppercase flex items-center gap-1">
                    <ImageIcon className="w-3 h-3 text-blue-400" />
                    <span>{ext}</span>
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1.5 py-0.5 rounded">
                    {formatBytes(media.size)}
                  </span>
                </div>
              </div>
            )}

            <div className="absolute bottom-2 left-2 right-2 z-10 bg-black/75 backdrop-blur-md p-2 rounded-xl border border-white/10">
              <p className="text-xs font-semibold text-white font-mono truncate leading-snug" title={media.fileName}>
                {media.fileName}
              </p>
            </div>
          </div>
        ) : isVideo ? (
          /* Video Card — if real thumbnail exists, render it; otherwise render gradient poster */
          <div className="relative w-full h-full overflow-hidden bg-zinc-950">
            {(media.thumbnailUrl || sampledThumbnail) && isVisible && !imageError ? (
              <img
                src={media.thumbnailUrl || sampledThumbnail!}
                alt={media.fileName}
                loading="lazy"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ease-out ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ) : null}

            {(!media.thumbnailUrl && !sampledThumbnail || !imageLoaded) && (
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />
            )}

            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors z-10">
              <div className="w-12 h-12 rounded-full bg-blue-600/90 text-white flex items-center justify-center backdrop-blur-md group-hover:scale-110 group-hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/40 border border-white/20">
                <Play className="w-5 h-5 fill-white translate-x-0.5" />
              </div>
            </div>

            {/* Top badge row */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pr-8">
              <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-extrabold text-zinc-200 border border-white/10 uppercase flex items-center gap-1">
                <Film className="w-3 h-3 text-purple-400" />
                <span>{ext}</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1.5 py-0.5 rounded">
                {formatBytes(media.size)}
              </span>
            </div>

            {/* Bottom filename */}
            <div className="absolute bottom-2 left-2 right-2 z-10 bg-black/75 backdrop-blur-md p-2 rounded-xl border border-white/10">
              <p className="text-xs font-semibold text-white font-mono truncate leading-snug" title={media.fileName}>
                {media.fileName}
              </p>
            </div>
          </div>
        ) : (
          /* Fallback Poster Card (before visible / image failed) */
          <div className={`w-full h-full bg-gradient-to-br ${gradient} p-3.5 flex flex-col justify-between relative overflow-hidden`}>
            <div className="flex items-center justify-between z-10 pr-8">
              <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-extrabold text-zinc-200 border border-white/10 uppercase flex items-center gap-1">
                {isVideo ? <Film className="w-3 h-3 text-purple-400" /> : <ImageIcon className="w-3 h-3 text-blue-400" />}
                <span>{ext}</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1.5 py-0.5 rounded">
                {formatBytes(media.size)}
              </span>
            </div>

            <div className="z-10 bg-black/75 backdrop-blur-md p-2 rounded-xl border border-white/10 mt-auto">
              <p className="text-xs font-semibold text-white font-mono truncate leading-snug" title={media.fileName}>
                {media.fileName}
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
