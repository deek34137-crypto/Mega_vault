'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Image as ImageIcon, Video, Layers, ChevronRight, HardDrive, Trash2 } from 'lucide-react';
import { Album } from '@/types';
import { formatDate } from '@/lib/utils/cn';

interface AlbumCardProps {
  album: Album;
  onDelete?: (id: string) => void;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album, onDelete }) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(`Are you sure you want to remove the album "${album.title}"?`)) {
      if (onDelete) onDelete(album.id);
    }
  };

  return (
    <div className="relative group">
      <Link href={`/albums/${album.id}`}>
        <motion.div
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="glass-panel glass-panel-hover rounded-3xl overflow-hidden cursor-pointer border border-zinc-800/80 flex flex-col h-full bg-zinc-950/60"
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
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-zinc-900/80 backdrop-blur-md border border-zinc-700/60 text-[11px] font-medium text-zinc-300 flex items-center gap-1.5 shadow-md">
              <HardDrive className="w-3 h-3 text-red-400" />
              <span>MEGA Link</span>
            </div>

            {/* Delete Album Button */}
            {onDelete && (
              <button
                onClick={handleDelete}
                title="Remove Album"
                className="absolute top-3 right-3 p-2 rounded-full bg-red-600/80 hover:bg-red-600 text-white backdrop-blur-md transition-all shadow-md z-20 opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Media Count Pills */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-zinc-300 font-medium">
              <div className="flex items-center space-x-2">
                <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10">
                  <ImageIcon className="w-3 h-3 text-blue-400" />
                  <span>{album.mediaCount.images}</span>
                </span>
                <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/10">
                  <Video className="w-3 h-3 text-purple-400" />
                  <span>{album.mediaCount.videos}</span>
                </span>
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
