'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { VideoPlayer } from '@/components/viewer/VideoPlayer';
import { MediaItem } from '@/types';
import { Loader2, ArrowLeft, ExternalLink, Zap } from 'lucide-react';

function PlayerView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const url = searchParams.get('url') || '';
  const title = searchParams.get('title') || 'Video Stream';
  const poster = searchParams.get('poster') || '';
  const quality = searchParams.get('quality') || '';
  const site = searchParams.get('site') || '';

  if (!url) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center text-white p-4">
        <div className="glass-panel p-6 rounded-3xl border border-zinc-800 text-center max-w-md w-full">
          <h2 className="text-lg font-bold mb-2">No Stream URL Provided</h2>
          <p className="text-xs text-zinc-400 mb-6">
            Please select a video from the channels or extractor to stream ad-free.
          </p>
          <button
            onClick={() => router.push('/sites')}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-lg shadow-purple-600/30"
          >
            Go to Saved Sites
          </button>
        </div>
      </div>
    );
  }

  const mediaItem: MediaItem = {
    id: `stream-${Date.now()}`,
    albumId: 'stream-player',
    fileHandle: 'stream-handle',
    fileName: site ? `[${site}] ${title}` : title,
    mimeType: url.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4',
    size: 0,
    createdAt: new Date().toISOString(),
    thumbnailUrl: poster || undefined,
    streamUrl: url,
    mediaType: 'VIDEO',
    quality: quality || undefined,
  };

  const handleClose = () => {
    if (window.opener) {
      window.close();
    } else {
      router.back();
    }
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      <VideoPlayer media={mediaItem} onClose={handleClose} />
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-black flex items-center justify-center text-purple-400">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      }
    >
      <PlayerView />
    </Suspense>
  );
}
