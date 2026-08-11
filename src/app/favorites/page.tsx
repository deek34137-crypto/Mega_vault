'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { MediaCard } from '@/components/gallery/MediaCard';
import { VideoPlayer } from '@/components/viewer/VideoPlayer';
import { ImageLightbox } from '@/components/viewer/ImageLightbox';
import { Pagination } from '@/components/ui/Pagination';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { MediaItem, FilterMediaType } from '@/types';
import {
  ArrowLeft,
  Star,
  Image as ImageIcon,
  Video,
  Search,
  Download,
  CheckSquare,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Play,
  Pause,
  Loader2,
  Trash2,
  Folder,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils/cn';

const ITEMS_PER_PAGE = 24;

export default function FavoritesPage() {
  const { toasts, toastSuccess, toastInfo, removeToast } = useToast();
  const [favorites, setFavorites] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<FilterMediaType>('all');

  // Multi-Select States
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  // Slideshow
  const [isSlideshow, setIsSlideshow] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const loadFavorites = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/favorites');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites || []);
      }
    } catch (err) {
      console.error('Error fetching favorites:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, favorites.length));
        }
      },
      { rootMargin: '300px' }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [favorites.length]);

  const toggleSelectMedia = useCallback((item: MediaItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }, []);

  const starredFolders = favorites.filter(
    (f) => f.mimeType === 'folder' || (f.mediaType as string) === 'ALBUM' || (f.mediaType as string) === 'SUBFOLDER'
  );
  const mediaFavorites = favorites.filter(
    (f) => f.mimeType !== 'folder' && (f.mediaType as string) !== 'ALBUM' && (f.mediaType as string) !== 'SUBFOLDER'
  );

  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, mediaTypeFilter]);

  const filteredFavorites = mediaFavorites.filter((m) => {
    const matchesSearch = m.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      mediaTypeFilter === 'all'
        ? true
        : mediaTypeFilter === 'images'
        ? m.mediaType === 'IMAGE'
        : m.mediaType === 'VIDEO';
    return matchesSearch && matchesType;
  });

  const totalPages = Math.ceil(filteredFavorites.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageMedia = filteredFavorites.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const photoCount = mediaFavorites.filter((m) => m.mediaType === 'IMAGE').length;
  const videoCount = mediaFavorites.filter((m) => m.mediaType === 'VIDEO').length;
  const selectedMedia = selectedIndex !== null ? filteredFavorites[selectedIndex] : null;

  const handlePrev = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex((prev) => (prev! > 0 ? prev! - 1 : filteredFavorites.length - 1));
  }, [selectedIndex, filteredFavorites.length]);

  const handleNext = useCallback(() => {
    if (selectedIndex === null) return;
    setSelectedIndex((prev) => (prev! < filteredFavorites.length - 1 ? prev! + 1 : 0));
  }, [selectedIndex, filteredFavorites.length]);

  const handleDownloadFavoritesZip = () => {
    setIsZipping(true);
    const link = document.createElement('a');
    link.href = '/api/mega/zip?favorites=true';
    link.download = 'favorites-collection.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setIsZipping(false), 2500);
  };

  const handleDownloadSelectedZip = () => {
    const selectedItems = favorites.filter((m) => selectedIds.has(m.id));
    if (selectedItems.length === 0) return;
    setIsZipping(true);

    const handles = selectedItems.map((m) => m.fileHandle).join(',');
    const link = document.createElement('a');
    link.href = `/api/mega/zip?favorites=true&handles=${encodeURIComponent(handles)}`;
    link.download = 'selected-favorites.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setIsZipping(false), 2500);
  };

  const handleBatchUnstar = async () => {
    const selectedItems = favorites.filter((m) => selectedIds.has(m.id));
    for (const item of selectedItems) {
      await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumId: item.albumId,
          handle: item.fileHandle,
          fileName: item.fileName,
          mimeType: item.mimeType,
          mediaType: item.mediaType,
          size: item.size,
        }),
      });
    }
    toastInfo('Unstarred Items', `Removed ${selectedItems.length} items from favorites.`);
    setSelectedIds(new Set());
    loadFavorites();
  };

  const handleBatchCopyLinks = () => {
    const selectedItems = favorites.filter((m) => selectedIds.has(m.id));
    const links = selectedItems.map((m) => `${window.location.origin}${m.streamUrl}`).join('\n');
    navigator.clipboard.writeText(links);
    toastSuccess('Links Copied!', `Copied ${selectedItems.length} direct stream links to clipboard.`);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (selectedIndex === null) return;

      if (e.key === 'ArrowLeft' || e.key === '[') handlePrev();
      if (e.key === 'ArrowRight' || e.key === ']') handleNext();
      if (e.key === 'Escape') {
        setSelectedIndex(null);
        setIsSlideshow(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, handlePrev, handleNext]);

  // Slideshow
  useEffect(() => {
    if (!isSlideshow || selectedIndex === null || selectedMedia?.mediaType !== 'IMAGE') return;
    const interval = setInterval(() => {
      handleNext();
    }, 3500);
    return () => clearInterval(interval);
  }, [isSlideshow, selectedIndex, selectedMedia, handleNext]);

  return (
    <PageContainer>
      {/* Breadcrumb Header */}
      <div className="flex items-center space-x-2 text-xs font-semibold text-zinc-400 mb-6">
        <Link href="/" className="hover:text-white flex items-center space-x-1">
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
          <span>Homepage</span>
        </Link>
        <span>/</span>
        <span className="text-white font-mono">Favorites</span>
      </div>

      {/* Hero Banner */}
      <div className="relative rounded-2xl sm:rounded-3xl glass-panel p-6 sm:p-8 mb-8 overflow-hidden border border-zinc-800/80 bg-gradient-to-br from-amber-950/20 via-zinc-950 to-zinc-950">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold uppercase flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>Starred Collection</span>
              </span>
              <span className="text-xs text-zinc-400 font-mono">{favorites.length} Items</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">
              Starred Media Collection
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
              Access your bookmarked photos and videos in one unified gallery. Stream, view, or download as ZIP anytime.
            </p>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={handleDownloadFavoritesZip}
              disabled={favorites.length === 0 || isZipping}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-600/20"
            >
              {isZipping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>{isZipping ? 'Creating Stream ZIP...' : 'Stream ZIP All Favorites'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Starred Folders Section */}
      {starredFolders.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 fill-amber-400" />
            <span>Starred Albums & Folders ({starredFolders.length})</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {starredFolders.map((f) => {
              const isSub = f.fileHandle.startsWith('folder:');
              const subPath = isSub ? f.fileHandle.replace('folder:', '') : '';
              const targetHref = isSub
                ? `/albums/${f.albumId}?folder=${encodeURIComponent(subPath)}`
                : `/albums/${f.albumId}`;

              return (
                <Link key={f.id} href={targetHref}>
                  <div className="glass-panel glass-panel-hover p-4 rounded-2xl border border-amber-500/30 bg-zinc-950/80 flex items-center justify-between group relative">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 flex-shrink-0">
                        <Folder className="w-5 h-5 fill-amber-400/20" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                            {f.fileName}
                          </h4>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {isSub ? 'SUBFOLDER' : 'ALBUM'}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400">Starred Folder</span>
                      </div>
                    </div>

                    <button
                      onClick={async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        await fetch('/api/favorites', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            albumId: f.albumId,
                            handle: f.fileHandle,
                            fileName: f.fileName,
                            mimeType: 'folder',
                            mediaType: f.mediaType,
                            size: 0,
                          }),
                        });
                        loadFavorites();
                      }}
                      title="Unstar folder"
                      className="p-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-rose-900/60 hover:border-rose-600 hover:text-rose-200 transition-all"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                    </button>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Controls & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-1.5 sm:space-x-2 bg-zinc-900/90 p-1.5 rounded-2xl border border-zinc-800 overflow-x-auto">
          <button
            onClick={() => setMediaTypeFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              mediaTypeFilter === 'all' ? 'bg-amber-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            All ({favorites.length})
          </button>
          <button
            onClick={() => setMediaTypeFilter('images')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
              mediaTypeFilter === 'images' ? 'bg-amber-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Photos ({photoCount})</span>
          </button>
          <button
            onClick={() => setMediaTypeFilter('videos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
              mediaTypeFilter === 'videos' ? 'bg-amber-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Videos ({videoCount})</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedIds(new Set());
            }}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              isSelectMode
                ? 'bg-amber-600 border-amber-500 text-white shadow-md'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isSelectMode ? 'Cancel Select' : 'Select Items'}</span>
          </button>

          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search starred media..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      {/* Copy Toast Message */}
      {copyMsg && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{copyMsg}</span>
        </div>
      )}

      {/* Sticky Bottom Multi-Select Bar */}
      {isSelectMode && (
        <div className="sticky top-4 z-40 mb-6 p-3.5 rounded-2xl glass-panel border border-amber-500/40 bg-zinc-950/90 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 shadow-2xl">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-white font-mono bg-amber-600 px-2.5 py-1 rounded-lg">
              {selectedIds.size} Selected
            </span>
            <button
              onClick={() =>
                selectedIds.size === filteredFavorites.length
                  ? setSelectedIds(new Set())
                  : setSelectedIds(new Set(filteredFavorites.map((m) => m.id)))
              }
              className="text-xs text-zinc-300 hover:text-white font-medium"
            >
              {selectedIds.size === filteredFavorites.length ? 'Deselect All' : `Select All (${filteredFavorites.length})`}
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleBatchCopyLinks}
              disabled={selectedIds.size === 0}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 border border-zinc-700"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Links</span>
            </button>

            <button
              onClick={handleBatchUnstar}
              disabled={selectedIds.size === 0}
              className="px-3.5 py-1.5 rounded-xl bg-rose-900/60 hover:bg-rose-800 disabled:opacity-40 text-rose-200 text-xs font-semibold flex items-center gap-1.5 border border-rose-700/60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Unstar Selected</span>
            </button>

            <button
              onClick={handleDownloadSelectedZip}
              disabled={selectedIds.size === 0 || isZipping}
              className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-amber-600/20"
            >
              {isZipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Stream ZIP Selected ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Favorites Gallery Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square rounded-2xl bg-zinc-900/60 animate-pulse border border-zinc-800" />
          ))}
        </div>
      ) : filteredFavorites.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center border border-zinc-800/80 my-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto mb-4">
            <Star className="w-7 h-7 text-amber-400" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">No Starred Items Yet</h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto mb-6">
            Click the star button on any photo or video while browsing your albums to add them to your persistent favorites collection.
          </p>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-2"
          >
            <span>Browse Albums</span>
          </Link>
        </div>
      ) : (
        <>
          {/* Top Pagination Control */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredFavorites.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={(p) => {
              setCurrentPage(p);
              window.scrollTo({ top: 300, behavior: 'smooth' });
            }}
            accentColor="amber"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {pageMedia.map((media) => {
              const filteredIdx = filteredFavorites.findIndex((m) => m.id === media.id);
              return (
                <MediaCard
                  key={media.id}
                  media={media}
                  isSelectMode={isSelectMode}
                  isSelected={selectedIds.has(media.id)}
                  onSelectToggle={toggleSelectMedia}
                  onFavoriteToggle={() => loadFavorites()}
                  onClick={() => setSelectedIndex(filteredIdx)}
                />
              );
            })}
          </div>

          {/* Bottom Pagination Control */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredFavorites.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={(p) => {
              setCurrentPage(p);
              window.scrollTo({ top: 300, behavior: 'smooth' });
            }}
            accentColor="amber"
          />
        </>
      )}

      {/* Video Player Modal */}
      {selectedMedia && selectedMedia.mediaType === 'VIDEO' && (
        <VideoPlayer
          media={selectedMedia}
          onClose={() => setSelectedIndex(null)}
          onPrev={handlePrev}
          onNext={handleNext}
          currentIndex={selectedIndex!}
          totalCount={filteredFavorites.length}
        />
      )}

      {/* Fullscreen Image Lightbox Modal */}
      {selectedMedia && selectedMedia.mediaType === 'IMAGE' && (
        <ImageLightbox
          media={selectedMedia}
          currentIndex={selectedIndex!}
          totalCount={filteredFavorites.length}
          onClose={() => setSelectedIndex(null)}
          onPrev={handlePrev}
          onNext={handleNext}
          onFavoriteToggle={() => loadFavorites()}
        />
      )}
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </PageContainer>
  );
}
