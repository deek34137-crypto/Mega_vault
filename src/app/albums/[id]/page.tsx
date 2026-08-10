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
  CheckSquare,
  Square,
  Play,
  Pause,
  Copy,
  Check,
  HelpCircle,
  Keyboard,
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

  // Multi-Select & Batch Actions States
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  // Slideshow & Hotkeys States
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  const toggleSelectMedia = useCallback((item: MediaItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = new Set(filteredMedia.map((m) => m.id));
    setSelectedIds(allIds);
  }, []);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBatchDownload = useCallback(() => {
    const selectedItems = mediaItems.filter((m) => selectedIds.has(m.id));
    selectedItems.forEach((m, idx) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = `${m.streamUrl}&download=true`;
        a.download = m.fileName;
        a.click();
      }, idx * 400); // Stagger downloads slightly to prevent browser pop-up blocking
    });
  }, [mediaItems, selectedIds]);

  const handleBatchCopyLinks = useCallback(() => {
    const selectedItems = mediaItems.filter((m) => selectedIds.has(m.id));
    const links = selectedItems
      .map((m) => `${window.location.origin}${m.streamUrl}`)
      .join('\n');
    navigator.clipboard.writeText(links);
    setCopyMsg(`Copied ${selectedItems.length} stream links to clipboard!`);
    setTimeout(() => setCopyMsg(null), 3000);
  }, [mediaItems, selectedIds]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

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
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      if (selectedIndex === null) return;

      if (selectedMedia?.mediaType === 'IMAGE') {
        if (e.key === 'ArrowLeft') handlePrev();
        if (e.key === 'ArrowRight') handleNext();
      }
      if (e.key === '[' || (e.shiftKey && e.key === 'ArrowLeft')) handlePrev();
      if (e.key === ']' || (e.shiftKey && e.key === 'ArrowRight')) handleNext();
      if (e.key === 'Escape') {
        setSelectedIndex(null);
        setIsSlideshow(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, selectedMedia, handlePrev, handleNext]);

  // Slideshow Auto-Advance Effect (3.5 seconds per photo)
  useEffect(() => {
    if (!isSlideshow || selectedIndex === null || selectedMedia?.mediaType !== 'IMAGE') return;
    const interval = setInterval(() => {
      handleNext();
    }, 3500);
    return () => clearInterval(interval);
  }, [isSlideshow, selectedIndex, selectedMedia, handleNext]);

  // Preload adjacent images in background for instant 0ms Lightbox switching (2 ahead + 2 behind)
  useEffect(() => {
    if (selectedIndex === null || filteredMedia.length === 0) return;

    const toPreload = [
      filteredMedia[(selectedIndex + 1) % filteredMedia.length],
      filteredMedia[(selectedIndex + 2) % filteredMedia.length],
      filteredMedia[(selectedIndex - 1 + filteredMedia.length) % filteredMedia.length],
      filteredMedia[(selectedIndex - 2 + filteredMedia.length) % filteredMedia.length],
    ];

    toPreload.forEach((m) => {
      if (m && m.mediaType === 'IMAGE' && m.streamUrl) {
        const img = new Image();
        img.fetchPriority = 'low';
        img.src = m.streamUrl;
      }
    });
  }, [selectedIndex, filteredMedia]);

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
      <div className="relative rounded-2xl sm:rounded-3xl glass-panel p-5 sm:p-8 mb-6 sm:mb-8 overflow-hidden border border-zinc-800/80">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold uppercase">
                {folderParam ? 'SUBFOLDER VIEW' : 'ALBUM VIEW'}
              </span>
              {album && <span className="text-xs text-zinc-400">{formatDate(album.createdAt)}</span>}
            </div>
            <h1 className="text-xl sm:text-4xl font-extrabold text-white mb-1 tracking-tight">
              {folderParam || album?.title || 'Album Details'}
            </h1>
            {album?.description && !folderParam && (
              <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">{album.description}</p>
            )}
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full sm:w-auto justify-center px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {subfolders.map((sub) => (
              <Link key={sub.path} href={`/albums/${albumId}?folder=${encodeURIComponent(sub.path)}`}>
                <div className="glass-panel glass-panel-hover p-3.5 sm:p-4 rounded-2xl border border-zinc-800/80 flex items-center justify-between group">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 flex-shrink-0">
                      <Folder className="w-5 h-5 fill-blue-400/20" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                        {sub.name}
                      </h4>
                      <span className="text-[11px] sm:text-xs text-zinc-400">{sub.itemCount} items</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filter Controls & Multi-Select Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 mb-6">
        <div className="flex items-center space-x-1.5 sm:space-x-2 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 overflow-x-auto">
          <button
            onClick={() => setMediaTypeFilter('all')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all ${
              mediaTypeFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            All ({mediaItems.length})
          </button>
          <button
            onClick={() => setMediaTypeFilter('images')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
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
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all ${
              mediaTypeFilter === 'videos'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Videos ({videoCount})</span>
          </button>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          {/* Select Mode Toggle */}
          <button
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedIds(new Set());
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              isSelectMode
                ? 'bg-blue-600 border-blue-500 text-white shadow-md'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{isSelectMode ? 'Cancel Select' : 'Select Items'}</span>
          </button>

          {/* Keyboard Shortcuts Helper Button */}
          <button
            onClick={() => setIsShortcutsOpen(true)}
            title="View Keyboard Shortcuts (?)"
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-all"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search media files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 sm:py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
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

      {/* Sticky Bottom Multi-Select Batch Action Bar */}
      {isSelectMode && (
        <div className="sticky top-4 z-40 mb-6 p-3.5 rounded-2xl glass-panel border border-blue-500/40 bg-zinc-950/90 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 shadow-2xl animate-fadeIn">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-white font-mono bg-blue-600 px-2.5 py-1 rounded-lg">
              {selectedIds.size} Selected
            </span>
            <button
              onClick={selectedIds.size === filteredMedia.length ? handleDeselectAll : handleSelectAll}
              className="text-xs text-zinc-300 hover:text-white font-medium"
            >
              {selectedIds.size === filteredMedia.length ? 'Deselect All' : `Select All (${filteredMedia.length})`}
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleBatchCopyLinks}
              disabled={selectedIds.size === 0}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all border border-zinc-700"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Stream Links</span>
            </button>

            <button
              onClick={handleBatchDownload}
              disabled={selectedIds.size === 0}
              className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Selected ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* Media Grid (Paginated via Infinite Scroll) */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square rounded-2xl bg-zinc-900/60 animate-pulse border border-zinc-800" />
          ))}
        </div>
      ) : filteredMedia.length === 0 && subfolders.length === 0 ? (
        <div className="glass-panel p-8 sm:p-12 rounded-3xl text-center border border-zinc-800 my-8">
          <p className="text-sm text-zinc-400 mb-2">No media items found in this folder.</p>
          <p className="text-xs text-zinc-500">Click "Refresh Album" to fetch folder contents from MEGA.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-4">
            {visibleMedia.map((media) => {
              const filteredIdx = filteredMedia.findIndex((m) => m.id === media.id);
              return (
                <MediaCard
                  key={media.id}
                  media={media}
                  isSelectMode={isSelectMode}
                  isSelected={selectedIds.has(media.id)}
                  onSelectToggle={toggleSelectMedia}
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

      {/* Fullscreen Image Viewer Modal */}
      {selectedMedia && selectedMedia.mediaType === 'IMAGE' && (
        <div
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
            touchStartY.current = e.touches[0].clientY;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null || touchStartY.current === null) return;
            const deltaX = e.changedTouches[0].clientX - touchStartX.current;
            const deltaY = e.changedTouches[0].clientY - touchStartY.current;
            if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
              if (deltaX < 0) handleNext();
              else if (deltaX > 0) handlePrev();
            }
            touchStartX.current = null;
            touchStartY.current = null;
          }}
          className="fixed inset-0 z-50 bg-black select-none"
          style={{ animation: 'fadeInScale 0.22s cubic-bezier(0.22,1,0.36,1) both' }}
        >
          <style>{`
            @keyframes fadeInScale {
              from { opacity: 0; transform: scale(0.96); }
              to   { opacity: 1; transform: scale(1); }
            }
          `}</style>

          {/* Full viewport image — covers 100% screen */}
          <div
            className="absolute inset-0 flex items-center justify-center cursor-zoom-in"
            onClick={() => setSelectedIndex(null)}
          >
            <img
              key={selectedMedia.id}
              src={selectedMedia.streamUrl || selectedMedia.thumbnailUrl || ''}
              alt={selectedMedia.fileName}
              fetchPriority="high"
              decoding="async"
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-full w-full h-full object-contain select-none"
              style={{ animation: 'fadeInScale 0.18s ease both' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>          {/* Top overlay: filename + slideshow + download + close */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
            <div className="pointer-events-auto">
              <p className="text-sm font-bold text-white font-mono truncate max-w-[50vw]">{selectedMedia.fileName}</p>
              <p className="text-xs text-zinc-400">
                {formatBytes(selectedMedia.size)} &nbsp;•&nbsp; {selectedIndex! + 1} / {filteredMedia.length}
                {isSlideshow && <span className="text-blue-400 font-bold ml-2 animate-pulse">• Slideshow Playing (3.5s)</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Play / Pause Slideshow Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsSlideshow(!isSlideshow);
                }}
                title={isSlideshow ? 'Pause Slideshow' : 'Play Auto-Slideshow'}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border backdrop-blur-md transition-all ${
                  isSlideshow
                    ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/30'
                    : 'bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 border-zinc-700/70'
                }`}
              >
                {isSlideshow ? <Pause className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white" />}
                <span>{isSlideshow ? 'Pause' : 'Slideshow'}</span>
              </button>

              <a
                href={`${selectedMedia.streamUrl}&download=true`}
                download={selectedMedia.fileName}
                onClick={(e) => e.stopPropagation()}
                title="Download image"
                className="p-2.5 rounded-full bg-zinc-900/80 hover:bg-emerald-600 text-zinc-300 hover:text-white border border-zinc-700/70 transition-all backdrop-blur-md"
              >
                <Download className="w-5 h-5" />
              </a>

              <button
                onClick={() => {
                  setSelectedIndex(null);
                  setIsSlideshow(false);
                }}
                className="p-2.5 rounded-full bg-zinc-900/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/70 transition-all backdrop-blur-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Left arrow */}
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-zinc-900/80 hover:bg-blue-600 text-zinc-200 hover:text-white border border-zinc-700/80 hover:border-blue-500 backdrop-blur-md transition-all shadow-2xl"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          {/* Right arrow */}
          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-zinc-900/80 hover:bg-blue-600 text-zinc-200 hover:text-white border border-zinc-700/80 hover:border-blue-500 backdrop-blur-md transition-all shadow-2xl"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Bottom dot indicator for <= 20 images */}
          {filteredMedia.length <= 20 && (
            <div className="absolute bottom-4 left-0 right-0 z-20 flex items-center justify-center gap-1.5 pointer-events-none">
              {filteredMedia.map((m, idx) => (
                <button
                  key={m.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedIndex(idx); }}
                  className={`h-2 rounded-full transition-all pointer-events-auto ${
                    idx === selectedIndex ? 'w-6 bg-blue-500 shadow-md' : 'w-2 bg-white/30 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Keyboard Shortcuts Cheatsheet Modal */}
      {isShortcutsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-zinc-800 shadow-2xl relative">
            <button
              onClick={() => setIsShortcutsOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <Keyboard className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Keyboard Shortcuts</h3>
                <p className="text-xs text-zinc-400">Master playback & gallery controls</p>
              </div>
            </div>

            <div className="space-y-2.5 divide-y divide-zinc-800/60 text-xs">
              <div className="pt-2 flex items-center justify-between">
                <span className="text-zinc-300 font-medium">Previous / Next Media</span>
                <div className="flex items-center gap-1 font-mono">
                  <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-200">←</kbd>
                  <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-200">→</kbd>
                  <span className="text-zinc-500">or</span>
                  <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-200">[</kbd>
                  <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-200">]</kbd>
                </div>
              </div>

              <div className="pt-2.5 flex items-center justify-between">
                <span className="text-zinc-300 font-medium">Play / Pause Video</span>
                <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 font-mono">Space</kbd>
              </div>

              <div className="pt-2.5 flex items-center justify-between">
                <span className="text-zinc-300 font-medium">Toggle Fullscreen Video</span>
                <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 font-mono">F</kbd>
              </div>

              <div className="pt-2.5 flex items-center justify-between">
                <span className="text-zinc-300 font-medium">Toggle Mute</span>
                <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 font-mono">M</kbd>
              </div>

              <div className="pt-2.5 flex items-center justify-between">
                <span className="text-zinc-300 font-medium">Seek Video ±5 Seconds</span>
                <div className="flex items-center gap-1 font-mono">
                  <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-200">←</kbd>
                  <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-200">→</kbd>
                </div>
              </div>

              <div className="pt-2.5 flex items-center justify-between">
                <span className="text-zinc-300 font-medium">Toggle Shortcuts Menu</span>
                <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 font-mono">?</kbd>
              </div>

              <div className="pt-2.5 flex items-center justify-between">
                <span className="text-zinc-300 font-medium">Close Viewer / Modal</span>
                <kbd className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 font-mono">Esc</kbd>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsShortcutsOpen(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Got It
              </button>
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
