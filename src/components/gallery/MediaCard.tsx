'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Play, Film, Image as ImageIcon, FileText } from 'lucide-react';
import { MediaItem } from '@/types';
import { formatBytes, formatDuration } from '@/lib/utils/cn';

interface MediaCardProps {
  media: MediaItem;
  onClick?: (media: MediaItem) => void;
}

// Generate consistent gradient backdrop from filename
function getGradientFromFileName(name: string): string {
  const gradients = [
    'from-blue-900/60 via-indigo-950/80 to-zinc-950',
    'from-purple-900/60 via-slate-950/80 to-zinc-950',
    'from-cyan-900/60 via-blue-950/80 to-zinc-950',
    'from-emerald-900/60 via-teal-950/80 to-zinc-950',
    'from-rose-900/60 via-zinc-950/80 to-zinc-950',
    'from-amber-900/60 via-zinc-950/80 to-zinc-950',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

export const MediaCard: React.FC<MediaCardProps> = ({ media, onClick }) => {
  const isVideo = media.mediaType === 'VIDEO';
  const ext = media.fileName.split('.').pop()?.toUpperCase() || (isVideo ? 'VIDEO' : 'IMG');
  const gradient = getGradientFromFileName(media.fileName);

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.02 }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick && onClick(media)}
      className="glass-panel glass-panel-hover rounded-2xl overflow-hidden group cursor-pointer border border-zinc-800/80 relative bg-zinc-950 flex flex-col h-full shadow-md"
    >
      {/* Media Cover / Preview Container */}
      <div className="relative aspect-square w-full bg-zinc-900 overflow-hidden flex flex-col justify-between">
        {media.thumbnailUrl ? (
          <img
            src={media.thumbnailUrl}
            alt={media.fileName}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        ) : (
          /* Rich Cover Graphic when Thumbnail is unavailable */
          <div className={`w-full h-full bg-gradient-to-br ${gradient} p-3.5 flex flex-col justify-between relative overflow-hidden`}>
            {/* Background Film Mesh Pattern */}
            <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
              {isVideo ? <Film className="w-24 h-24 text-white" /> : <ImageIcon className="w-24 h-24 text-white" />}
            </div>

            {/* Top Format Badge */}
            <div className="flex items-center justify-between z-10">
              <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-extrabold tracking-wider text-zinc-200 border border-white/10 uppercase flex items-center gap-1">
                {isVideo ? <Film className="w-3 h-3 text-purple-400" /> : <ImageIcon className="w-3 h-3 text-blue-400" />}
                <span>{ext}</span>
              </span>

              <span className="text-[10px] font-mono text-zinc-400 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
                {formatBytes(media.size)}
              </span>
            </div>

            {/* Video Play Button Overlay */}
            {isVideo && (
              <div className="my-auto mx-auto z-10">
                <div className="w-12 h-12 rounded-full bg-blue-600/90 text-white flex items-center justify-center backdrop-blur-md group-hover:scale-110 group-hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/40 border border-white/20">
                  <Play className="w-5 h-5 fill-white translate-x-0.5" />
                </div>
              </div>
            )}

            {/* Filename Preview Label directly on cover */}
            <div className="z-10 bg-black/60 backdrop-blur-md p-2 rounded-xl border border-white/10 mt-auto">
              <p className="text-xs font-semibold text-white font-mono truncate leading-snug" title={media.fileName}>
                {media.fileName}
              </p>
            </div>
          </div>
        )}

        {/* Top Badges for Images with Thumbnail */}
        {media.thumbnailUrl && (
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
            <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md text-[10px] font-semibold tracking-wider text-zinc-200 uppercase border border-white/10 flex items-center gap-1">
              {isVideo ? (
                <>
                  <Film className="w-3 h-3 text-purple-400" />
                  <span>{ext}</span>
                </>
              ) : (
                <>
                  <ImageIcon className="w-3 h-3 text-blue-400" />
                  <span>{ext}</span>
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Bottom Info Bar for Thumbnailed Items */}
      {media.thumbnailUrl && (
        <div className="p-2.5 bg-zinc-950/90 border-t border-zinc-800/80 flex items-center justify-between text-xs">
          <span className="truncate text-zinc-200 font-mono text-[11px]" title={media.fileName}>
            {media.fileName}
          </span>
          <span className="text-[10px] text-zinc-400 font-mono flex-shrink-0 ml-2">
            {formatBytes(media.size)}
          </span>
        </div>
      )}
    </motion.div>
  );
};
