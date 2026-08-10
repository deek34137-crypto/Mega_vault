'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Video, Layers, ChevronRight, HardDrive, Trash2, Folder, Star } from 'lucide-react';
import { Album } from '@/types';
import { formatDate } from '@/lib/utils/cn';

interface AlbumCardProps {
  album: Album;
  onDelete?: (id: string) => void;
  onFavoriteToggle?: (albumId: string, isFav: boolean) => void;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, onDelete, onFavoriteToggle }) => {
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    fetch(`/api/favorites`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.favorites)) {
          const isFav = data.favorites.some(
            (f: any) => f.albumId === album.id && (f.fileHandle === 'album:root' || f.mediaType === 'ALBUM')
          );
          setIsFavorite(isFav);
        }
      })
      .catch(() => {});
  }, [album.id]);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextFavState = !isFavorite;
    setIsFavorite(nextFavState);
    if (onFavoriteToggle) onFavoriteToggle(album.id, nextFavState);

    try {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumId: album.id,
          handle: 'album:root',
          fileName: album.title,
          mimeType: 'folder',
          mediaType: 'ALBUM',
          size: 0,
          thumbnailUrl: album.coverUrl,
        }),
      });
    } catch (err) {
      console.error('Failed to toggle album favorite:', err);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Are you sure you want to remove the album "${album.title}"?`)) {
      if (onDelete) onDelete(album.id);
    }
  };

  const hasNoDirectMedia = (album.mediaCount?.images || 0) === 0 && (album.mediaCount?.videos || 0) === 0;
  const subCount = album.subfolderCount || 0;

  return (
    <div className="relative group">
      <Link href={`/albums/${album.id}`}>
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="glass-panel glass-panel-hover rounded-3xl overflow-hidden cursor-pointer border border-zinc-800/80 flex flex-col h-full bg-zinc-950/60 relative"
        >
          {/* Cover Preview Image Container */}
          <div className="relative aspect-[16/10] w-full bg-zinc-900 overflow-hidden">
            {album.coverUrl ? (
              <img
                src={album.coverUrl}
                alt={album.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-zinc-600">
                <Layers className="w-12 h-12 mb-2 text-zinc-700" />
                <span className="text-xs text-zinc-500">No cover photo</span>
              </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-80" />

            {/* MEGA Source Badge */}
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-700/60 text-[11px] font-medium text-zinc-300 flex items-center gap-1.5 shadow-md z-10">
              <HardDrive className="w-3 h-3 text-red-400" />
              <span>MEGA Link</span>
            </div>

            {/* Top Action Buttons (Favorite Star + Delete) */}
            <div className="absolute top-3 right-3 flex items-center space-x-2 z-20">
              {/* Star Favorite Button & Sticker */}
              <button
                onClick={handleFavoriteClick}
                title={isFavorite ? 'Unstar album' : 'Star album'}
                className={`p-2 rounded-full border backdrop-blur-md transition-all shadow-md ${
                  isFavorite
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 opacity-100'
                    : 'bg-black/60 border-white/20 text-zinc-300 opacity-0 group-hover:opacity-100 hover:text-amber-400'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-400 text-amber-400 scale-110' : ''}`} />
              </button>

              {/* Delete Album Button */}
              {onDelete && (
                <button
                  onClick={handleDelete}
                  title="Remove Album"
                  className="p-2 rounded-full bg-red-600/80 hover:bg-red-600 text-white backdrop-blur-md transition-all shadow-md opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Favorited Gold Sticker Badge */}
            {isFavorite && (
              <div className="absolute top-12 right-3 z-10 px-2 py-0.5 rounded-md bg-amber-500/20 backdrop-blur-md border border-amber-500/40 text-amber-300 text-[10px] font-extrabold tracking-wider uppercase flex items-center gap-1 shadow-lg">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>Starred Folder</span>
              </div>
            )}

            {/* Media Count Pills */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-zinc-300 font-medium">
              <div className="flex items-center space-x-2">
                {hasNoDirectMedia && subCount > 0 ? (
                  <span className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 backdrop-blur-md border border-amber-500/30 text-amber-300 text-xs font-bold shadow-md">
                    <Folder className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                    <span>{subCount} {subCount === 1 ? 'Subfolder' : 'Subfolders'}</span>
                  </span>
                ) : (
                  <>
                    <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10">
                      <ImageIcon className="w-3 h-3 text-blue-400" />
                      <span>{album.mediaCount?.images || 0}</span>
                    </span>
                    <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10">
                      <Video className="w-3 h-3 text-purple-400" />
                      <span>{album.mediaCount?.videos || 0}</span>
                    </span>
                    {subCount > 0 && (
                      <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-amber-300">
                        <Folder className="w-3 h-3 text-amber-400" />
                        <span>{subCount}</span>
                      </span>
                    )}
                  </>
                )}
              </div>
              <span className="text-[11px] text-zinc-400">{formatDate(album.createdAt)}</span>
            </div>
          </div>

          {/* Card Content Info */}
          <div className="p-5 flex flex-col flex-1 justify-between bg-zinc-950/40">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                  {album.title}
                </h3>
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
              </div>
              {album.description && (
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed font-normal">
                  {album.description}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </Link>
    </div>
  );
};
