'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { MediaCard } from '@/components/gallery/MediaCard';
import { VideoPlayer } from '@/components/viewer/VideoPlayer';
import { Album, MediaItem, FilterMediaType } from '@/types';
import {
  ArrowLeft,
  Image as ImageIcon,
  Video,
  RefreshCw,
  Search,
  X,
  Download,
  ChevronLeft,
  ChevronRight,
  Folder,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { formatBytes, formatDate } from '@/lib/utils/cn';

interface SubfolderItem {
  name: string;
  path: string;
  itemCount: number;
}

const ITEMS_PER_PAGE = 24;

function AlbumContent() {
  const params = useParams();
  const searchParams = useSearchParams();

  const rawId = params?.id;
  const albumId = Array.isArray(rawId) ? rawId[0] : (rawId as string) || '';
  const folderParam = searchParams?.get('folder') || '';

  const [album, setAlbum] = useState<Album | null>(null);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [subfolders, setSubfolders] = useState<SubfolderItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<FilterMediaType>('all');

  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMedia = useCallback(async () => {
    if (!albumId) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);
      setVisibleCount(ITEMS_PER_PAGE);

      const url = `/api/albums/${encodeURIComponent(albumId)}/media${folderParam ? `?folder=${encodeURIComponent(folderParam)}` : ''}`;
      const res = await fetch(url);

      if (res.status === 401 || res.redirected) {
        window.location.href = '/login';
        return;
      }

      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setAlbum(data.album);
          setMediaItems(data.items || []);
          setSubfolders(data.subfolders || []);

          if (data.timedOut) {
            setErrorMessage('MEGA folder connection timed out. Click "Refresh Album" to retry.');
          }
        } catch (e) {
          // If non-JSON returned, user session likely expired
          window.location.href = '/login';
          return;
        }
      } else {
        setErrorMessage('Failed to load media for this album.');
      }
    } catch (err) {
      console.error('Error loading album media:', err);
      setErrorMessage('Network error while connecting to album.');
    } finally {
      setIsLoading(false);
    }
  }, [albumId, folderParam]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, mediaItems.length));
        }
      },
      { rootMargin: '300px' }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [mediaItems.length]);

  // Reset pagination count on search or filter changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchQuery, mediaTypeFilter]);

  const handleRefresh = async () => {
    if (!albumId) return;

    try {
      setIsRefreshing(true);
      const res = await fetch(`/api/albums/${encodeURIComponent(albumId)}/refresh`, { method: 'POST' });
      if (res.ok) {
        loadMedia();
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

  const visibleMedia = filteredMedia.slice(0, visibleCount);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIndex === null || selectedMedia?.mediaType === 'VIDEO') return;
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') setSelectedIndex(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, selectedMedia, handlePrev, handleNext]);

  return (
    <PageContainer>
      {/* Back Navigation & Breadcrumb */}
      <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-400 mb-6 flex-wrap gap-y-1">
        <Link href="/" className="hover:text-white flex items-center space-x-1">
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
          <span>Homepage</span>
        </Link>
        <span>/</span>
        <Link href={`/albums/${albumId}`} className="hover:text-white">
          {album?.title || 'Album'}
        </Link>
        {folderParam &&
          folderParam.split('/').map((seg, idx, arr) => {
            const pathUpToSegment = arr.slice(0, idx + 1).join('/');
            const isLast = idx === arr.length - 1;
            return (
              <React.Fragment key={idx}>
                <span>/</span>
                {isLast ? (
                  <span className="text-white font-mono">{seg}</span>
                ) : (
                  <Link
                    href={`/albums/${albumId}?folder=${encodeURIComponent(pathUpToSegment)}`}
                    className="hover:text-white font-mono"
                  >
                    {seg}
                  </Link>
                )}
              </React.Fragment>
            );
          })}
      </div>

      {/* Album Header Banner */}
      <div className="relative rounded-3xl glass-panel p-8 mb-8 overflow-hidden border border-zinc-800/80">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold uppercase">
                {folderParam ? 'SUBFOLDER VIEW' : 'ALBUM VIEW'}
              </span>
              {album && <span className="text-xs text-zinc-400">{formatDate(album.createdAt)}</span>}
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-1">
              {folderParam || album?.title || 'Album Details'}
            </h1>
            {album?.description && !folderParam && (
              <p className="text-sm text-zinc-400 max-w-xl">{album.description}</p>
            )}
          </div>

          <div className="flex items-center space-x-3">
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

      {/* Error Alert Banner */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Subfolders Grid inside Album */}
      {subfolders.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Subfolders</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {subfolders.map((sub) => (
              <Link key={sub.path} href={`/albums/${albumId}?folder=${encodeURIComponent(sub.path)}`}>
                <div className="glass-panel glass-panel-hover p-4 rounded-2xl border border-zinc-800/80 flex items-center justify-between group">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                      <Folder className="w-5 h-5 fill-blue-400/20" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                        {sub.name}
                      </h4>
                      <span className="text-xs text-zinc-400">{sub.itemCount} items</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

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

      {/* Media Grid (Paginated via Infinite Scroll) */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square rounded-2xl bg-zinc-900/60 animate-pulse border border-zinc-800" />
          ))}
        </div>
      ) : filteredMedia.length === 0 && subfolders.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center border border-zinc-800 my-8">
          <p className="text-sm text-zinc-400 mb-2">No media items found in this folder.</p>
          <p className="text-xs text-zinc-500">Click "Refresh Album" to fetch folder contents from MEGA.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {visibleMedia.map((media) => {
              // Find the true index in filteredMedia (not the paginated slice index)
              const filteredIdx = filteredMedia.findIndex((m) => m.id === media.id);
              return (
                <MediaCard
                  key={media.id}
                  media={media}
                  onClick={() => setSelectedIndex(filteredIdx)}
                />
              );
            })}
          </div>

          {/* Infinite Scroll Sentinel */}
          {visibleCount < filteredMedia.length && (
            <div ref={sentinelRef} className="py-8 text-center flex items-center justify-center space-x-2 text-zinc-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span>Loading more media on scroll... ({visibleCount} of {filteredMedia.length})</span>
            </div>
          )}
        </>
      )}

      {/* Custom Video Player Modal */}
      {selectedMedia && selectedMedia.mediaType === 'VIDEO' && (
        <VideoPlayer
          media={selectedMedia}
          onClose={() => setSelectedIndex(null)}
          onPrev={handlePrev}
          onNext={handleNext}
          currentIndex={selectedIndex!}
          totalCount={filteredMedia.length}
        />
      )}

      {/* Image Lightbox Viewer Modal */}
      {selectedMedia && selectedMedia.mediaType === 'IMAGE' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
          <button
            onClick={() => setSelectedIndex(null)}
            className="absolute top-4 right-4 p-3 rounded-full bg-zinc-900/80 text-zinc-400 hover:text-white border border-zinc-700 z-20"
          >
            <X className="w-6 h-6" />
          </button>

          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-zinc-900/80 text-zinc-300 hover:text-white border border-zinc-700/80 hover:bg-zinc-800 z-20 transition-all"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

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
              ) : selectedMedia.streamUrl ? (
                // Load real image via the stream API endpoint
                <img
                  src={selectedMedia.streamUrl}
                  alt={selectedMedia.fileName}
                  className="max-h-[75vh] object-contain select-none"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="p-16 text-zinc-500 flex flex-col items-center">
                  <ImageIcon className="w-16 h-16 mb-2 text-blue-500" />
                  <span className="font-mono text-sm text-zinc-300 mb-1">{selectedMedia.fileName}</span>
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
                <a
                  href={selectedMedia.streamUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Open Image</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default function AlbumDetailsPageWrapper() {
  return (
    <Suspense fallback={
      <PageContainer>
        <div className="h-64 rounded-3xl bg-zinc-900/60 animate-pulse border border-zinc-800" />
      </PageContainer>
    }>
      <AlbumContent />
    </Suspense>
  );
}
