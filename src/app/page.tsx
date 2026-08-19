'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { MediaCard } from '@/components/gallery/MediaCard';
import { ImageLightbox } from '@/components/viewer/ImageLightbox';
import { VideoPlayer } from '@/components/viewer/VideoPlayer';
import { Pagination } from '@/components/ui/Pagination';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { Album, MediaItem } from '@/types';
import {
  FolderPlus,
  Sparkles,
  X,
  Link as LinkIcon,
  HardDrive,
  PlayCircle,
  Folder,
  ChevronRight,
  Video,
  Image as ImageIcon,
  Download,
  Upload,
  Search,
  LayoutGrid,
  List,
  CheckSquare,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { formatBytes } from '@/lib/utils/cn';

interface DisplayFolder {
  albumId: string;
  albumTitle: string;
  folderName: string;
  subfolderPath: string;
  itemCount: number;
  imageCount?: number;
  videoCount?: number;
  subfolderCount: number;
  megaUrl: string;
  createdAt: string;
  coverImageUrl?: string;
}

type TabFilter = 'folders' | 'all' | 'images' | 'videos';

let cachedAlbums: Album[] = [];
let cachedDisplayFolders: DisplayFolder[] = [];
let cachedVaultMedia: MediaItem[] = [];
let cachedVaultStats = {
  totalCount: 0,
  imagesCount: 0,
  videosCount: 0,
  albumsCount: 0,
  foldersCount: 0,
};

const ITEMS_PER_PAGE = 24;

export default function HomePage() {
  const { toasts, toastSuccess, toastError, toastInfo, removeToast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Core Data States
  const [albums, setAlbumsState] = useState<Album[]>(cachedAlbums);
  const [displayFolders, setDisplayFoldersState] = useState<DisplayFolder[]>(cachedDisplayFolders);
  const [vaultMedia, setVaultMedia] = useState<MediaItem[]>(cachedVaultMedia);
  const [vaultStats, setVaultStats] = useState(cachedVaultStats);

  // View & Filter States
  const [activeTab, setActiveTab] = useState<TabFilter>('folders');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'items' | 'size'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);

  // Loading & Modal States
  const [isLoading, setIsLoading] = useState(cachedDisplayFolders.length === 0);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMegaUrl, setNewMegaUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Multi-Select & Batch Actions
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  // Lightbox, Video Player, Slideshow
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isSlideshow, setIsSlideshow] = useState(false);

  // Local Storage Restoration States
  const [hasLocalBackup, setHasLocalBackup] = useState(false);
  const [localBackupCount, setLocalBackupCount] = useState(0);
  const [isRestoringLocal, setIsRestoringLocal] = useState(false);

  const setAlbums = (val: Album[] | ((prev: Album[]) => Album[])) => {
    if (typeof val === 'function') {
      setAlbumsState((prev) => {
        const next = val(prev);
        cachedAlbums = next;
        return next;
      });
    } else {
      cachedAlbums = val;
      setAlbumsState(val);
    }
  };

  const setDisplayFolders = (val: DisplayFolder[] | ((prev: DisplayFolder[]) => DisplayFolder[])) => {
    if (typeof val === 'function') {
      setDisplayFoldersState((prev) => {
        const next = val(prev);
        cachedDisplayFolders = next;
        return next;
      });
    } else {
      cachedDisplayFolders = val;
      setDisplayFoldersState(val);
    }
  };

  // Load Main Folders (Albums) with instant 0ms rendering
  const loadAlbumsData = useCallback(async () => {
    try {
      if (cachedDisplayFolders.length === 0) {
        setIsLoading(true);
      }
      const res = await fetch('/api/albums');
      if (res.status === 401 || res.redirected) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) return;

      const data = await res.json();
      const loadedAlbums: Album[] = data.albums || [];
      setAlbums(loadedAlbums);

      // Check browser LocalStorage for saved links backup
      let savedLocalItems: any[] = [];
      try {
        const stored = localStorage.getItem('megavault_saved_links');
        if (stored) savedLocalItems = JSON.parse(stored);
      } catch (e) {}

      if (loadedAlbums.length > 0) {
        const cacheItems = loadedAlbums.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
        }));
        localStorage.setItem('megavault_saved_links', JSON.stringify(cacheItems));
        setHasLocalBackup(false);
      } else if (savedLocalItems.length > 0) {
        setHasLocalBackup(true);
        setLocalBackupCount(savedLocalItems.length);
      }

      // Build main folder cards (each album is a main folder)
      let totalVaultImages = 0;
      let totalVaultVideos = 0;
      let totalVaultMediaCount = 0;

      const folderList: DisplayFolder[] = loadedAlbums.map((alb) => {
        const coverUrl =
          (alb as any).cover_image_url ||
          (alb as any).coverImageUrl ||
          (alb as any).coverUrl ||
          undefined;
        const subfolders = (alb as any).subfolders || [];
        const mainSubCount = alb.subfolderCount ?? subfolders.length;
        const imgCount = alb.mediaCount?.images ?? 0;
        const vidCount = alb.mediaCount?.videos ?? 0;
        const totCount = alb.mediaCount?.total ?? (imgCount + vidCount);

        totalVaultImages += imgCount;
        totalVaultVideos += vidCount;
        totalVaultMediaCount += totCount;

        return {
          albumId: alb.id,
          albumTitle: alb.title,
          folderName: alb.title,
          subfolderPath: '',
          itemCount: totCount,
          imageCount: imgCount,
          videoCount: vidCount,
          subfolderCount: mainSubCount,
          megaUrl: alb.megaUrl || '',
          createdAt: alb.createdAt,
          coverImageUrl: coverUrl,
        };
      });

      setDisplayFolders(folderList);

      // Set baseline stats from albums response immediately without extra network call
      setVaultStats({
        totalCount: totalVaultMediaCount,
        imagesCount: totalVaultImages,
        videosCount: totalVaultVideos,
        albumsCount: loadedAlbums.length,
        foldersCount: folderList.length,
      });
    } catch (err) {
      console.error('Failed to load albums:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Lazy-load Vault-Wide Media ONLY when user enters 'all', 'images', or 'videos' tabs
  const loadVaultMediaData = useCallback(async (refresh = false) => {
    try {
      if (cachedVaultMedia.length === 0 || refresh) {
        setIsLoadingMedia(true);
      }
      const res = await fetch(`/api/albums/all-media${refresh ? '?refresh=true' : ''}`);
      if (res.status === 401 || res.redirected) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) return;

      const data = await res.json();
      const items: MediaItem[] = data.items || [];
      const stats = data.stats || {
        totalCount: items.length,
        imagesCount: items.filter((i) => i.mediaType === 'IMAGE').length,
        videosCount: items.filter((i) => i.mediaType === 'VIDEO').length,
        albumsCount: 0,
        foldersCount: 0,
      };

      setVaultMedia(items);
      cachedVaultMedia = items;
      setVaultStats(stats);
      cachedVaultStats = stats;
    } catch (err) {
      console.error('Failed to load vault media:', err);
    } finally {
      setIsLoadingMedia(false);
    }
  }, []);

  // Load albums on mount
  useEffect(() => {
    loadAlbumsData();
  }, [loadAlbumsData]);

  // Load media lazily when tab switches away from 'folders'
  useEffect(() => {
    if (activeTab !== 'folders' && vaultMedia.length === 0) {
      loadVaultMediaData();
    }
  }, [activeTab, vaultMedia.length, loadVaultMediaData]);

  // Global Keyboard Shortcut for Search ('/' or 'Ctrl+K')
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === '/' || ((e.metaKey || e.ctrlKey) && e.key === 'k')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset pagination on tab or search change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
    setIsSelectMode(false);
  }, [activeTab, searchQuery, sortBy]);

  const handleRestoreFromLocalCache = async () => {
    try {
      setIsRestoringLocal(true);
      const stored = localStorage.getItem('megavault_saved_links');
      if (!stored) return;

      const savedLocalItems = JSON.parse(stored);
      const res = await fetch('/api/albums/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedLocalItems),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setHasLocalBackup(false);
        toastSuccess('Restored Saved Folders!', `Successfully restored ${savedLocalItems.length} folders.`);
        await loadAlbumsData();
        if (activeTab !== 'folders') {
          await loadVaultMediaData(true);
        }
      } else {
        toastError('Restoration Failed', data.error || 'Failed to restore folders');
      }
    } catch (err) {
      toastError('Restoration Error', 'Error restoring folders from browser database');
    } finally {
      setIsRestoringLocal(false);
    }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newMegaUrl || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          megaUrl: newMegaUrl,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setNewTitle('');
        setNewDescription('');
        setNewMegaUrl('');
        setIsAddModalOpen(false);
        toastSuccess('MEGA Album Linked!', `Successfully indexed "${newTitle}".`);
        loadAlbumsData();
        if (activeTab !== 'folders') {
          loadVaultMediaData(true);
        }
      } else {
        toastError('Failed to Link Album', data.error || 'Failed to add album');
      }
    } catch (err) {
      toastError('Error', 'An error occurred while creating the album');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportBackup = async () => {
    try {
      const res = await fetch('/api/albums/backup');
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `megavault-albums-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toastSuccess('Backup Exported!', 'JSON backup downloaded to your device.');
      } else {
        toastError('Failed to export backup');
      }
    } catch (err) {
      toastError('Error exporting backup');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      const res = await fetch('/api/albums/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toastSuccess('Backup Restored!', data.message || 'Albums imported successfully.');
        loadAlbumsData();
        if (activeTab !== 'folders') {
          loadVaultMediaData(true);
        }
      } else {
        toastError('Import Failed', data.error || 'Failed to restore backup');
      }
    } catch (err) {
      toastError('Invalid File', 'Invalid backup JSON file');
    }
  };

  const handleFillDemo = () => {
    setNewTitle('Family Vacation Demo 2026');
    setNewDescription('Indexed photos & videos from sample MEGA folder');
    setNewMegaUrl('https://mega.nz/folder/example#demo-key-2026');
    toastInfo('Demo Details Loaded', 'Sample MEGA folder link filled in.');
  };

  // Filtered & Sorted Main Folders List
  const filteredFolders = useMemo(() => {
    return displayFolders
      .filter((f) => {
        const q = searchQuery.toLowerCase();
        return f.folderName.toLowerCase().includes(q) || f.albumTitle.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.folderName.localeCompare(b.folderName);
        if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortBy === 'items') return b.itemCount - a.itemCount;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [displayFolders, searchQuery, sortBy]);

  // Filtered & Sorted Media List (for 'all', 'images', 'videos' tabs)
  const filteredMedia = useMemo(() => {
    return vaultMedia
      .filter((m) => {
        if (activeTab === 'images' && m.mediaType !== 'IMAGE') return false;
        if (activeTab === 'videos' && m.mediaType !== 'VIDEO') return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const nameMatch = m.fileName.toLowerCase().includes(q);
          const albumMatch = m.albumTitle ? m.albumTitle.toLowerCase().includes(q) : false;
          const folderMatch = m.folderPath ? m.folderPath.toLowerCase().includes(q) : false;
          return nameMatch || albumMatch || folderMatch;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.fileName.localeCompare(b.fileName);
        if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (sortBy === 'size') return (b.size || 0) - (a.size || 0);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [vaultMedia, activeTab, searchQuery, sortBy]);

  // Paginated Media for smooth 60fps rendering
  const totalPages = Math.ceil(filteredMedia.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageMedia = filteredMedia.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const selectedMedia = selectedIndex !== null ? filteredMedia[selectedIndex] : null;

  // Media Selection & Batch Operations
  const toggleSelectMedia = useCallback((item: MediaItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  }, []);

  const handleBatchDownload = useCallback(() => {
    const selectedItems = vaultMedia.filter((m) => selectedIds.has(m.id));
    if (selectedItems.length === 0) return;

    selectedItems.forEach((m, idx) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = `${m.streamUrl}&download=true`;
        a.download = m.fileName;
        a.click();
      }, idx * 400);
    });
    toastSuccess('Downloading Selected', `Started download for ${selectedItems.length} items.`);
  }, [vaultMedia, selectedIds, toastSuccess]);

  const handleBatchCopyLinks = useCallback(() => {
    const selectedItems = vaultMedia.filter((m) => selectedIds.has(m.id));
    if (selectedItems.length === 0) return;

    const links = selectedItems
      .map((m) => `${window.location.origin}${m.streamUrl}`)
      .join('\n');
    navigator.clipboard.writeText(links);
    setCopyMsg(`Copied ${selectedItems.length} direct stream links!`);
    setTimeout(() => setCopyMsg(null), 3000);
  }, [vaultMedia, selectedIds]);

  // Lightbox & Slideshow Navigation
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
      if (selectedIndex === null) return;

      if (selectedMedia?.mediaType === 'IMAGE') {
        if (e.key === 'ArrowLeft' || e.key === '[') handlePrev();
        if (e.key === 'ArrowRight' || e.key === ']') handleNext();
      }
      if (e.key === 'Escape') {
        setSelectedIndex(null);
        setIsSlideshow(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, selectedMedia, handlePrev, handleNext]);

  // Auto-advance slideshow
  useEffect(() => {
    if (!isSlideshow || selectedIndex === null || selectedMedia?.mediaType !== 'IMAGE') return;
    const interval = setInterval(() => {
      handleNext();
    }, 3500);
    return () => clearInterval(interval);
  }, [isSlideshow, selectedIndex, selectedMedia, handleNext]);

  // Dynamic counts for badge counters
  const totalFoldersCount = displayFolders.length;
  const totalAllMediaCount = vaultMedia.length || vaultStats.totalCount;
  const totalPhotosCount = vaultMedia.filter((m) => m.mediaType === 'IMAGE').length || vaultStats.imagesCount;
  const totalVideosCount = vaultMedia.filter((m) => m.mediaType === 'VIDEO').length || vaultStats.videosCount;

  return (
    <PageContainer>
      {/* Restorable Local Backup Banner */}
      {hasLocalBackup && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-emerald-600/20 border border-blue-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                {localBackupCount} Saved {localBackupCount === 1 ? 'Folder' : 'Folders'} Found in Browser Database!
              </h4>
              <p className="text-xs text-zinc-300">
                Server storage was reset. Click below to show and restore all your saved folders.
              </p>
            </div>
          </div>

          <button
            onClick={handleRestoreFromLocalCache}
            disabled={isRestoringLocal}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md flex-shrink-0"
          >
            <span>{isRestoringLocal ? 'Restoring Folders...' : 'Show / Restore Folders Now'}</span>
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>MegaVault</span>
            <Sparkles className="w-5 h-5 text-blue-400" />
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Private Media Collections & High-Speed Stream Gallery</p>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
          <button
            onClick={handleExportBackup}
            title="Export Albums JSON Backup"
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-all text-xs flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <label
            title="Restore Albums JSON Backup"
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-all text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Restore</span>
            <input type="file" accept=".json" onChange={handleImportBackup} className="hidden" />
          </label>

          <button
            onClick={() => {
              loadAlbumsData();
              if (activeTab !== 'folders') loadVaultMediaData(true);
            }}
            title="Refresh All Vault Media"
            disabled={isLoadingMedia}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-all text-xs flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 text-purple-400 ${isLoadingMedia ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync Vault</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20"
          >
            <FolderPlus className="w-4 h-4" />
            <span>New Album Link</span>
          </button>
        </div>
      </div>

      {/* Main Homepage Vault Filter Navigation Bar */}
      <div className="mb-6 p-2 rounded-2xl glass-panel border border-zinc-800/90 bg-zinc-950/90 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-lg">
        {/* Tab Selection Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {/* Folders Tab */}
          <button
            onClick={() => setActiveTab('folders')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all ${
              activeTab === 'folders'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Main Folders</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                activeTab === 'folders' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {totalFoldersCount}
            </span>
          </button>

          {/* All Media Tab */}
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all ${
              activeTab === 'all'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>All Media</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {totalAllMediaCount}
            </span>
          </button>

          {/* Photos Tab */}
          <button
            onClick={() => setActiveTab('images')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all ${
              activeTab === 'images'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>All Photos</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                activeTab === 'images' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {totalPhotosCount}
            </span>
          </button>

          {/* Videos Tab */}
          <button
            onClick={() => setActiveTab('videos')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all ${
              activeTab === 'videos'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>All Videos</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                activeTab === 'videos' ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {totalVideosCount}
            </span>
          </button>
        </div>

        {/* Action Controls (Search, Sort, Multi-Select, View Mode) */}
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'folders' ? 'Search main folders...' : 'Search media & folders...'}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-10 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-400 border border-zinc-700 pointer-events-none">
                /
              </span>
            )}
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name">Name (A-Z)</option>
            {activeTab === 'folders' ? (
              <option value="items">Most Items</option>
            ) : (
              <option value="size">Largest Size</option>
            )}
          </select>

          {/* Media View Tools (Select Mode for Media Tabs) */}
          {activeTab !== 'folders' && (
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
              <span className="hidden sm:inline">{isSelectMode ? 'Cancel' : 'Select'}</span>
            </button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center bg-zinc-900 p-0.5 rounded-xl border border-zinc-800">
            <button
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="Detailed List View"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Copy Message Banner */}
      {copyMsg && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{copyMsg}</span>
        </div>
      )}

      {/* Sticky Multi-Select Action Bar (for Media Tabs) */}
      {isSelectMode && activeTab !== 'folders' && (
        <div className="sticky top-4 z-40 mb-6 p-3.5 rounded-2xl glass-panel border border-blue-500/40 bg-zinc-950/95 backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 shadow-2xl">
          <div className="flex items-center space-x-3">
            <span className="text-xs font-bold text-white font-mono bg-blue-600 px-2.5 py-1 rounded-lg">
              {selectedIds.size} Selected
            </span>
            <button
              onClick={() =>
                selectedIds.size === filteredMedia.length
                  ? setSelectedIds(new Set())
                  : setSelectedIds(new Set(filteredMedia.map((m) => m.id)))
              }
              className="text-xs text-zinc-300 hover:text-white font-medium"
            >
              {selectedIds.size === filteredMedia.length ? 'Deselect All' : `Select All (${filteredMedia.length})`}
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
              onClick={handleBatchDownload}
              disabled={selectedIds.size === 0}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Selected ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MAIN FOLDERS VIEW (Shows Main Folder Cards with Subfolder Numbering)   */}
      {/* ========================================================================= */}
      {activeTab === 'folders' && (
        <section className="mb-12">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-2xl bg-zinc-900 animate-pulse border border-zinc-800" />
              ))}
            </div>
          ) : filteredFolders.length === 0 ? (
            <div className="glass-panel p-12 rounded-3xl text-center border border-zinc-800">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto mb-4">
                <Folder className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                {searchQuery ? 'No Matching Main Folders Found' : 'No Main Folders in Vault'}
              </h3>
              <p className="text-xs text-zinc-400 mb-6">
                {searchQuery
                  ? `No main folders matched "${searchQuery}". Try a different keyword.`
                  : hasLocalBackup
                  ? `Found ${localBackupCount} saved folder links in your browser database!`
                  : 'Paste a shared MEGA folder link to index and organize folders automatically.'}
              </p>
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold"
                >
                  Clear Search Filter
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  {hasLocalBackup && (
                    <button
                      onClick={handleRestoreFromLocalCache}
                      disabled={isRestoringLocal}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>{isRestoringLocal ? 'Restoring Folders...' : `Show / Restore ${localBackupCount} Saved Folders`}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md"
                  >
                    Add MEGA Folder Link
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5'
                  : 'flex flex-col space-y-3'
              }
            >
              {filteredFolders.map((folder) => {
                const hasSubfolders = folder.subfolderCount > 0;
                const imgCount = folder.imageCount ?? 0;
                const vidCount = folder.videoCount ?? 0;

                return (
                  <Link
                    key={folder.albumId}
                    href={`/albums/${folder.albumId}`}
                    className="group block"
                  >
                    <div className="p-4 sm:p-5 rounded-2xl border border-zinc-800 bg-zinc-950 hover:border-blue-500/50 hover:shadow-xl transition-all duration-150 flex items-center justify-between gap-4 relative overflow-hidden">
                      <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
                        {folder.coverImageUrl ? (
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden border border-blue-500/30 flex-shrink-0 bg-zinc-900 group-hover:scale-105 transition-transform">
                            <img src={folder.coverImageUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                            <Folder className="w-6 h-6 fill-blue-400/20" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                            {folder.folderName}
                          </h3>

                          {/* EXACT USER RULE: If folder has subfolders, FIRST show subfolder numbering! Otherwise show photos and videos breakdown */}
                          <div className="text-[11px] sm:text-xs text-zinc-400 mt-1.5 flex flex-wrap items-center gap-1.5 font-medium">
                            {hasSubfolders ? (
                              <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-1.5 shadow-sm">
                                <Folder className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                                <span>
                                  {folder.subfolderCount}{' '}
                                  {folder.subfolderCount === 1 ? 'Subfolder' : 'Subfolders'}
                                </span>
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-blue-300 font-mono text-[11px] flex items-center gap-1">
                                  <ImageIcon className="w-3 h-3 text-blue-400" />
                                  <span>{imgCount} Photos</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-purple-300 font-mono text-[11px] flex items-center gap-1">
                                  <Video className="w-3 h-3 text-purple-400" />
                                  <span>{vidCount} Videos</span>
                                </span>
                              </div>
                            )}

                            {hasSubfolders && folder.itemCount > 0 && (
                              <span className="text-[11px] text-zinc-500 font-mono">
                                • {folder.itemCount} items total
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all flex-shrink-0">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ========================================================================= */}
      {/* 2. MEDIA GALLERY VIEW (For 'all', 'images', 'videos' across all folders)  */}
      {/* ========================================================================= */}
      {activeTab !== 'folders' && (
        <section className="mb-12">
          {isLoadingMedia ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                <div key={i} className="aspect-square rounded-2xl bg-zinc-900 animate-pulse border border-zinc-800" />
              ))}
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="glass-panel p-12 rounded-3xl text-center border border-zinc-800 my-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto mb-4">
                {activeTab === 'videos' ? (
                  <Video className="w-7 h-7 text-purple-400" />
                ) : activeTab === 'images' ? (
                  <ImageIcon className="w-7 h-7 text-cyan-400" />
                ) : (
                  <Sparkles className="w-7 h-7 text-blue-400" />
                )}
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                {searchQuery
                  ? 'No Matching Media Files'
                  : activeTab === 'videos'
                  ? 'No Videos Found in Any Folder'
                  : activeTab === 'images'
                  ? 'No Photos Found in Any Folder'
                  : 'No Media Files in Vault'}
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto mb-6">
                {searchQuery
                  ? `No media matched "${searchQuery}". Try a different search term.`
                  : 'Add a MEGA folder link on the main page to index and stream photos & videos.'}
              </p>
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold"
                >
                  Clear Search Filter
                </button>
              ) : (
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-2"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Add MEGA Folder Link</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Pagination Bar (Top) */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredMedia.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={(p) => {
                  setCurrentPage(p);
                  window.scrollTo({ top: 200, behavior: 'smooth' });
                }}
                accentColor="blue"
              />

              {/* Media Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {pageMedia.map((media) => {
                  const filteredIdx = filteredMedia.findIndex((m) => m.id === media.id);
                  return (
                    <MediaCard
                      key={media.id}
                      media={media}
                      isSelectMode={isSelectMode}
                      isSelected={selectedIds.has(media.id)}
                      onSelectToggle={toggleSelectMedia}
                      onFavoriteToggle={() => loadVaultMediaData()}
                      onClick={() => setSelectedIndex(filteredIdx)}
                    />
                  );
                })}
              </div>

              {/* Pagination Bar (Bottom) */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredMedia.length}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={(p) => {
                  setCurrentPage(p);
                  window.scrollTo({ top: 200, behavior: 'smooth' });
                }}
                accentColor="blue"
              />
            </>
          )}
        </section>
      )}

      {/* Video Player Modal */}
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

      {/* Fullscreen Image Lightbox Modal */}
      {selectedMedia && selectedMedia.mediaType === 'IMAGE' && (
        <ImageLightbox
          media={selectedMedia}
          currentIndex={selectedIndex!}
          totalCount={filteredMedia.length}
          onClose={() => setSelectedIndex(null)}
          onPrev={handlePrev}
          onNext={handleNext}
          onFavoriteToggle={() => loadVaultMediaData()}
        />
      )}

      {/* New Album Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="glass-panel w-full max-w-lg rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-zinc-800 shadow-2xl relative my-auto max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <HardDrive className="w-6 h-6 text-red-400" />
              </div>

              {/* Demo Fill Button */}
              <button
                type="button"
                onClick={handleFillDemo}
                className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:text-white hover:bg-purple-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>Fill Demo Link</span>
              </button>
            </div>

            <h3 className="text-xl font-bold text-white mb-1">Add MEGA Folder Album</h3>
            <p className="text-xs text-zinc-400 mb-6">
              Paste your shared MEGA folder link. MegaVault will index media and subfolders without uploading or storing files.
            </p>

            <form onSubmit={handleCreateAlbum} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Album Title
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Family Vacation 2026"
                  required
                  className="w-full bg-zinc-900 border border-zinc-700/70 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="e.g. Beach sunsets and highlights"
                  className="w-full bg-zinc-900 border border-zinc-700/70 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  MEGA Folder URL
                </label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={newMegaUrl}
                    onChange={(e) => setNewMegaUrl(e.target.value)}
                    placeholder="https://mega.nz/folder/..."
                    required
                    className="w-full bg-zinc-900 border border-zinc-700/70 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-all shadow-md shadow-blue-600/20"
                >
                  {isSubmitting ? 'Saving Album...' : 'Save Album'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </PageContainer>
  );
}
