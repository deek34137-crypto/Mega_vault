'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { VirtualizedMediaGrid } from '@/components/gallery/VirtualizedMediaGrid';
import { ImageLightbox } from '@/components/viewer/ImageLightbox';
import { VideoPlayer } from '@/components/viewer/VideoPlayer';
import { MediaItem } from '@/types';
import {
  Lock,
  Sparkles,
  Download,
  Share2,
  AlertCircle,
  Loader2,
  Folder,
  ChevronRight,
  Video,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils/cn';

export default function SharedGalleryPage() {
  const params = useParams();
  const rawToken = params?.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : (rawToken as string) || '';

  const [pin, setPin] = useState('');
  const [isPinRequired, setIsPinRequired] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const [albumTitle, setAlbumTitle] = useState('');
  const [subfolderPath, setSubfolderPath] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [subfolders, setSubfolders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'images' | 'videos'>('all');
  const [isZipping, setIsZipping] = useState(false);

  const loadSharedMedia = useCallback(async (pinInput?: string) => {
    if (!token) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);
      setPinError(null);

      let url = `/api/share/${encodeURIComponent(token)}`;
      if (pinInput) {
        url += `?pin=${encodeURIComponent(pinInput)}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (res.status === 401 && data.isPinRequired) {
        setIsPinRequired(true);
        if (pinInput) {
          setPinError(data.error || 'Incorrect PIN code');
        }
        setIsLoading(false);
        return;
      }

      if (res.ok && data.success) {
        setIsPinRequired(false);
        setAlbumTitle(data.album.title);
        setSubfolderPath(data.subfolderPath || '');
        setMediaItems(data.items || []);
        setSubfolders(data.subfolders || []);
      } else {
        setErrorMessage(data.error || 'Failed to load shared gallery');
      }
    } catch (err) {
      setErrorMessage('Network error while connecting to shared link');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSharedMedia();
  }, [loadSharedMedia]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) return;
    loadSharedMedia(pin.trim());
  };

  const handleDownloadZip = async () => {
    if (!mediaItems.length) return;
    try {
      setIsZipping(true);
      const albumId = mediaItems[0]?.albumId;
      if (!albumId) return;

      const downloadUrl = `/api/mega/zip?albumId=${encodeURIComponent(albumId)}&shareToken=${encodeURIComponent(token)}${subfolderPath ? `&subfolder=${encodeURIComponent(subfolderPath)}` : ''}`;
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${albumTitle || 'shared-gallery'}.zip`;
      a.click();
    } catch (err) {
      console.error('Error starting ZIP download:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const filteredMedia = mediaItems.filter((m) => {
    const matchesSearch = m.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      mediaTypeFilter === 'all'
        ? true
        : mediaTypeFilter === 'images'
        ? m.mediaType === 'IMAGE'
        : m.mediaType === 'VIDEO';
    return matchesSearch && matchesType;
  });

  const selectedMedia = selectedIndex !== null ? filteredMedia[selectedIndex] : null;

  const handlePrev = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex((prev) => (prev! > 0 ? prev! - 1 : filteredMedia.length - 1));
  }, [selectedIndex, filteredMedia.length]);

  const handleNext = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex((prev) => (prev! < filteredMedia.length - 1 ? prev! + 1 : 0));
  }, [selectedIndex, filteredMedia.length]);

  return (
    <PageContainer>
      {/* PIN Access Verification Overlay */}
      {isPinRequired ? (
        <div className="min-h-[70vh] flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-zinc-950/90 border border-white/10 shadow-2xl glass-panel text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white mb-1">Protected Gallery</h2>
            <p className="text-xs text-zinc-400 mb-5">Please enter the PIN code to view this shared link.</p>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN Code"
                className="w-full px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-center tracking-widest text-lg font-mono focus:outline-none focus:border-blue-500/50"
                autoFocus
              />

              {pinError && <p className="text-xs text-rose-400">{pinError}</p>}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-600/20"
              >
                Unlock Gallery
              </button>
            </form>
          </div>
        </div>
      ) : isLoading ? (
        <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-xs text-zinc-400">Loading shared media gallery...</p>
        </div>
      ) : errorMessage ? (
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-center max-w-md">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Gallery Unavailable</h3>
            <p className="text-xs text-rose-300 mb-4">{errorMessage}</p>
          </div>
        </div>
      ) : (
        <div>
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center space-x-2 text-xs text-zinc-400 mb-1">
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20 uppercase text-[10px]">
                  Shared Gallery
                </span>
                <span>•</span>
                <span>{mediaItems.length} Items</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>{albumTitle}</span>
                <Sparkles className="w-5 h-5 text-blue-400" />
              </h1>
              {subfolderPath && (
                <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                  <Folder className="w-3.5 h-3.5 text-blue-400" />
                  <span>{subfolderPath}</span>
                </p>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={handleDownloadZip}
                disabled={isZipping || mediaItems.length === 0}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20"
              >
                <Download className="w-4 h-4" />
                <span>{isZipping ? 'Preparing ZIP...' : 'Download ZIP Pack'}</span>
              </button>
            </div>
          </div>

          {/* Media Grid */}
          {filteredMedia.length > 0 ? (
            <VirtualizedMediaGrid
              items={filteredMedia}
              onItemClick={(_, index) => setSelectedIndex(index)}
            />
          ) : (
            <div className="py-16 text-center text-zinc-500 text-sm">
              No media files found in this shared collection.
            </div>
          )}
        </div>
      )}

      {/* Lightbox / Video Viewer */}
      {selectedMedia && (
        <>
          {selectedMedia.mediaType === 'IMAGE' ? (
            <ImageLightbox
              onClose={() => setSelectedIndex(null)}
              media={selectedMedia}
              onPrev={handlePrev}
              onNext={handleNext}
              currentIndex={selectedIndex ?? 0}
              totalCount={filteredMedia.length}
            />
          ) : (
            <VideoPlayer
              onClose={() => setSelectedIndex(null)}
              media={selectedMedia}
              onPrev={handlePrev}
              onNext={handleNext}
              currentIndex={selectedIndex ?? 0}
              totalCount={filteredMedia.length}
            />
          )}
        </>
      )}
    </PageContainer>
  );
}
