'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Film, Image as ImageIcon, Check, Star, Folder } from 'lucide-react';
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

  useEffect(() => {
    setIsFavorite(media.isFavorite || false);
  }, [media.isFavorite]);

  const isVideo = media.mediaType === 'VIDEO';
  const ext = media.fileName.split('.').pop()?.toUpperCase() || (isVideo ? 'VIDEO' : 'IMG');
  const gradient = getGradientFromFileName(media.fileName);

  // Lazy load media ONLY when card enters browser viewport (with 300px preload margin)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '300px' }
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
    <div
      ref={cardRef}
      onClick={() => {
        if (isSelectMode && onSelectToggle) {
          onSelectToggle(media);
        } else if (onClick) {
          onClick(media);
        }
      }}
      className={`rounded-2xl overflow-hidden group cursor-pointer border relative bg-zinc-950 flex flex-col h-full shadow-md transition-all duration-150 transform hover:-translate-y-1 hover:shadow-xl will-change-transform ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-zinc-800/80 hover:border-blue-500/50'
      }`}
    >
      {/* Checkbox Badge in Select Mode */}
      {(isSelectMode || isSelected) && (
        <div className="absolute top-2.5 right-2.5 z-30">
          <div
            className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
              isSelected
                ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                : 'bg-black/70 border-white/40 text-transparent'
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
          className={`absolute top-2.5 right-2.5 z-30 p-1.5 rounded-xl border transition-all duration-200 ${
            isFavorite
              ? 'bg-amber-500/30 border-amber-500/50 text-amber-400 opacity-100 shadow-md'
              : 'bg-black/60 border-white/10 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-amber-400 hover:border-amber-500/30'
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
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {!imageLoaded && (
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} p-3.5 flex flex-col justify-between animate-pulse`}>
                <div className="flex items-center justify-between z-10">
                  <span className="px-2 py-0.5 rounded-md bg-black/70 text-[10px] font-extrabold text-zinc-200 border border-white/10 uppercase flex items-center gap-1">
                    <ImageIcon className="w-3 h-3 text-blue-400" />
                    <span>{ext}</span>
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 bg-black/60 px-1.5 py-0.5 rounded">
                    {formatBytes(media.size)}
                  </span>
                </div>
              </div>
            )}

            <div className="absolute bottom-2 left-2 right-2 z-10 bg-black/85 p-2 rounded-xl border border-white/10 flex flex-col gap-1">
              <p className="text-xs font-semibold text-white font-mono truncate leading-snug" title={media.fileName}>
                {media.fileName}
              </p>
              {(media.albumTitle || media.folderPath) && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/albums/${media.albumId}${media.folderPath ? `?folder=${encodeURIComponent(media.folderPath)}` : ''}`;
                  }}
                  className="inline-flex items-center gap-1 text-[10px] text-blue-300 hover:text-white bg-blue-500/15 hover:bg-blue-500/30 px-1.5 py-0.5 rounded-md border border-blue-500/20 max-w-full transition-colors cursor-pointer"
                  title={`Open: ${[media.albumTitle, media.folderPath].filter(Boolean).join(' / ')}`}
                >
                  <Folder className="w-3 h-3 flex-shrink-0 text-blue-400" />
                  <span className="truncate">{[media.albumTitle, media.folderPath].filter(Boolean).join(' • ')}</span>
                </div>
              )}
            </div>
          </div>
        ) : isVideo ? (
          /* Video Card — high speed poster with play button */
          <div className="relative w-full h-full overflow-hidden bg-zinc-950">
            {media.thumbnailUrl && isVisible && !imageError ? (
              <img
                src={media.thumbnailUrl}
                alt={media.fileName}
                loading="lazy"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ) : null}

            {(!media.thumbnailUrl || !imageLoaded) && (
              <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-90`} />
            )}

            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/10 transition-colors z-10">
              <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/50 border border-white/20">
                <Play className="w-5 h-5 fill-white translate-x-0.5" />
              </div>
            </div>

            {/* Top badge row */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 pr-8">
              <span className="px-2 py-0.5 rounded-md bg-black/70 text-[10px] font-extrabold text-zinc-200 border border-white/10 uppercase flex items-center gap-1">
                <Film className="w-3 h-3 text-purple-400" />
                <span>{ext}</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400 bg-black/60 px-1.5 py-0.5 rounded">
                {formatBytes(media.size)}
              </span>
            </div>

            {/* Bottom filename & origin */}
            <div className="absolute bottom-2 left-2 right-2 z-10 bg-black/85 p-2 rounded-xl border border-white/10 flex flex-col gap-1">
              <p className="text-xs font-semibold text-white font-mono truncate leading-snug" title={media.fileName}>
                {media.fileName}
              </p>
              {(media.albumTitle || media.folderPath) && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/albums/${media.albumId}${media.folderPath ? `?folder=${encodeURIComponent(media.folderPath)}` : ''}`;
                  }}
                  className="inline-flex items-center gap-1 text-[10px] text-purple-300 hover:text-white bg-purple-500/15 hover:bg-purple-500/30 px-1.5 py-0.5 rounded-md border border-purple-500/20 max-w-full transition-colors cursor-pointer"
                  title={`Open: ${[media.albumTitle, media.folderPath].filter(Boolean).join(' / ')}`}
                >
                  <Folder className="w-3 h-3 flex-shrink-0 text-purple-400" />
                  <span className="truncate">{[media.albumTitle, media.folderPath].filter(Boolean).join(' • ')}</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Fallback Poster Card */
          <div className={`w-full h-full bg-gradient-to-br ${gradient} p-3.5 flex flex-col justify-between relative overflow-hidden`}>
            <div className="flex items-center justify-between z-10 pr-8">
              <span className="px-2 py-0.5 rounded-md bg-black/70 text-[10px] font-extrabold text-zinc-200 border border-white/10 uppercase flex items-center gap-1">
                {isVideo ? <Film className="w-3 h-3 text-purple-400" /> : <ImageIcon className="w-3 h-3 text-blue-400" />}
                <span>{ext}</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-400 bg-black/60 px-1.5 py-0.5 rounded">
                {formatBytes(media.size)}
              </span>
            </div>

            <div className="z-10 bg-black/85 p-2 rounded-xl border border-white/10 mt-auto flex flex-col gap-1">
              <p className="text-xs font-semibold text-white font-mono truncate leading-snug" title={media.fileName}>
                {media.fileName}
              </p>
              {(media.albumTitle || media.folderPath) && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/albums/${media.albumId}${media.folderPath ? `?folder=${encodeURIComponent(media.folderPath)}` : ''}`;
                  }}
                  className="inline-flex items-center gap-1 text-[10px] text-blue-300 hover:text-white bg-blue-500/15 hover:bg-blue-500/30 px-1.5 py-0.5 rounded-md border border-blue-500/20 max-w-full transition-colors cursor-pointer"
                  title={`Open: ${[media.albumTitle, media.folderPath].filter(Boolean).join(' / ')}`}
                >
                  <Folder className="w-3 h-3 flex-shrink-0 text-blue-400" />
                  <span className="truncate">{[media.albumTitle, media.folderPath].filter(Boolean).join(' • ')}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
