'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Play, Heart, Film, Image as ImageIcon } from 'lucide-react';
import { MediaItem } from '@/types';
import { formatBytes, formatDuration } from '@/lib/utils/cn';

interface MediaCardProps {
  media: MediaItem;
  onClick?: (media: MediaItem) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({ media, onClick }) => {
  const isVideo = media.mediaType === 'VIDEO';

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick && onClick(media)}
      className="glass-panel glass-panel-hover rounded-2xl overflow-hidden group cursor-pointer border border-zinc-800/80 relative bg-zinc-950/60"
    >
      {/* Media Image / Thumbnail with Lazy Loading */}
      <div className="relative aspect-square w-full bg-zinc-900 overflow-hidden">
        {media.thumbnailUrl ? (
          <img
            src={media.thumbnailUrl}
            alt={media.fileName}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-600">
            {isVideo ? <Film className="w-10 h-10" /> : <ImageIcon className="w-10 h-10" />}
          </div>
        )}

        {/* Top Overlay Badges */}
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-semibold tracking-wider text-zinc-300 uppercase border border-white/10 flex items-center gap-1">
            {isVideo ? (
              <>
                <Film className="w-3 h-3 text-purple-400" />
                <span>VIDEO</span>
              </>
            ) : (
              <>
                <ImageIcon className="w-3 h-3 text-blue-400" />
                <span>IMAGE</span>
              </>
            )}
          </span>
        </div>

        {/* Video Play Badge */}
        {isVideo && (
          <>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-11 h-11 rounded-full bg-blue-600/80 text-white flex items-center justify-center backdrop-blur-sm group-hover:scale-110 group-hover:bg-blue-600 transition-all shadow-lg shadow-blue-600/30">
                <Play className="w-5 h-5 fill-white translate-x-0.5" />
              </div>
            </div>
            {media.duration && (
              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[11px] font-mono text-zinc-200 border border-white/10">
                {formatDuration(media.duration)}
              </div>
            )}
          </>
        )}

        {/* Hover Quick Info */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3 pointer-events-none">
          <div className="w-full flex items-center justify-between text-white text-xs font-medium pointer-events-auto">
            <span className="truncate max-w-[140px] text-zinc-200 font-mono text-[11px]">
              {media.fileName}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-zinc-900/90 border border-zinc-700 text-[10px] text-zinc-300">
              {formatBytes(media.size)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
