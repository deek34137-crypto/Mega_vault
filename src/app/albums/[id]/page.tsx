'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { MediaCard } from '@/components/gallery/MediaCard';
import { Album, MediaItem, FilterMediaType } from '@/types';
import {
  ArrowLeft,
  Image as ImageIcon,
  Video,
  RefreshCw,
  Search,
  X,
  Play,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatBytes, formatDate } from '@/lib/utils/cn';

export default function AlbumDetailsPage() {
  const params = useParams();
  const albumId = params?.id as string;

  const [album, setAlbum] = useState<Album | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<FilterMediaType>('all');

  const loadMedia = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/albums/${albumId}/media`);
      if (res.ok) {
        const data = await res.json();
        setAlbum(data.album);
        setMediaItems(data.items || []);
      }
    } catch (err) {
      console.error('Error loading album media:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (albumId) {
      loadMedia();
    }
  }, [albumId]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(`/api/albums/${albumId}/refresh`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setMediaItems(data.media?.items || []);
      }
    } catch (err) {
      console.error('Error refreshing album:', err);
    } finally {
      setIsRefreshing(false);
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

  const photoCount = mediaItems.filter((m) => m.mediaType === 'IMAGE').length;
  const videoCount = mediaItems.filter((m) => m.mediaType === 'VIDEO').length;

  const selectedMedia = selectedIndex !== null ? filteredMedia[selectedIndex] : null;

  const handlePrev = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex((prev) => (prev! > 0 ? prev! - 1 : filteredMedia.length - 1));
  }, [selectedIndex, filteredMedia.length]);

  const handleNext = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex((prev) => (prev! < filteredMedia.length - 1 ? prev! + 1 : 0));
  }, [selectedIndex, filteredMedia.length]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') setSelectedIndex(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, handlePrev, handleNext]);

  return (
    <PageContainer>
      {/* Back Navigation */}
      <Link
        href="/"
        className="inline-flex items-center space-x-2 text-xs font-semibold text-zinc-400 hover:text-white mb-6 group transition-colors"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        <span>Back to Gallery</span>
      </Link>

      {/* Album Header Banner */}
      <div className="relative rounded-3xl glass-panel p-8 mb-8 overflow-hidden border border-zinc-800/80">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold">
                MEGA LINK INDEX
              </span>
              {album && <span className="text-xs text-zinc-400">{formatDate(album.createdAt)}</span>}
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-1">
              {album?.title || 'Album Details'}
            </h1>
            {album?.description && (
              <p className="text-sm text-zinc-400 max-w-xl">{album.description}</p>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {/* Refresh Album Action */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Re-reading MEGA...' : 'Refresh Album'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-2 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
          <button
            onClick={() => setMediaTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              mediaTypeFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All ({mediaItems.length})
          </button>
          <button
            onClick={() => setMediaTypeFilter('images')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              mediaTypeFilter === 'images'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photos ({photoCount})</span>
          </button>
          <button
            onClick={() => setMediaTypeFilter('videos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              mediaTypeFilter === 'videos'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Videos ({videoCount})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search media files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Media Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square rounded-2xl bg-zinc-900/60 animate-pulse border border-zinc-800" />
          ))}
        </div>
      ) : filteredMedia.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center border border-zinc-800 my-8">
          <p className="text-sm text-zinc-400 mb-2">No media items found in this album.</p>
          <p className="text-xs text-zinc-500">Click "Refresh Album" to fetch folder contents from MEGA.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredMedia.map((media, idx) => (
            <MediaCard key={media.id} media={media} onClick={() => setSelectedIndex(idx)} />
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox / Media Viewer with Keyboard Nav & Next/Prev */}
      {selectedMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
          {/* Close Button */}
          <button
            onClick={() => setSelectedIndex(null)}
            className="absolute top-4 right-4 p-3 rounded-full bg-zinc-900/80 text-zinc-400 hover:text-white border border-zinc-700 z-20"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Previous Button */}
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-zinc-900/80 text-zinc-300 hover:text-white border border-zinc-700/80 hover:bg-zinc-800 z-20 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Next Button */}
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-zinc-900/80 text-zinc-300 hover:text-white border border-zinc-700/80 hover:bg-zinc-800 z-20 transition-all"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <div className="max-w-4xl w-full flex flex-col items-center z-10">
            <div className="relative max-h-[75vh] rounded-2xl overflow-hidden mb-4 border border-zinc-800 bg-black flex items-center justify-center shadow-2xl">
              {selectedMedia.thumbnailUrl ? (
                <img
                  src={selectedMedia.thumbnailUrl}
                  alt={selectedMedia.fileName}
                  className="max-h-[75vh] object-contain select-none"
                />
              ) : (
                <div className="p-16 text-zinc-500 flex flex-col items-center">
                  <Play className="w-16 h-16 mb-2 text-blue-500" />
                  <span>Media Preview</span>
                </div>
              )}
            </div>

            <div className="w-full max-w-xl glass-panel p-4 rounded-2xl border border-zinc-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white font-mono">{selectedMedia.fileName}</h4>
                <p className="text-xs text-zinc-400">
                  {formatBytes(selectedMedia.size)} • {selectedMedia.mediaType} • {selectedIndex! + 1} of {filteredMedia.length}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => alert('Media direct link opened.')}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Open / View</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
