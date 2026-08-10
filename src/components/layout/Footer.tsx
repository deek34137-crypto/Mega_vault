'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, HardDrive, Heart } from 'lucide-react';
import { APP_NAME, APP_VERSION } from '@/lib/constants';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-zinc-800/80 bg-zinc-950/60 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Left info */}
          <div className="flex items-center space-x-3 text-sm text-zinc-400">
            <div className="flex items-center space-x-1.5 font-medium text-white">
              <span>{APP_NAME}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">v{APP_VERSION}</span>
            </div>
            <span>•</span>
            <span className="flex items-center space-x-1 text-xs">
              <Lock className="w-3.5 h-3.5 text-blue-400" />
              <span>Zero-Storage Private Gallery</span>
            </span>
          </div>

          {/* Center badge */}
          <div className="flex items-center space-x-2 text-xs text-zinc-500 bg-zinc-900/80 px-3 py-1.5 rounded-full border border-zinc-800">
            <HardDrive className="w-3.5 h-3.5 text-red-400" />
            <span>Direct MEGA Folder Encryption Index</span>
          </div>

          {/* Right copyright */}
          <div className="flex items-center space-x-4 text-xs text-zinc-500">
            <Link href="/brand" className="hover:text-blue-400 font-medium transition-colors">
              Brand Guidelines
            </Link>
            <span>•</span>
            <p className="flex items-center gap-1">
              <span>Built with</span>
              <Heart className="w-3 h-3 text-red-500 fill-red-500 inline" />
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
