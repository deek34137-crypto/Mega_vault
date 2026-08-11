'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { AlbumCard } from '@/components/gallery/AlbumCard';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { Album } from '@/types';
import { FolderPlus, Sparkles, X, Link as LinkIcon, HardDrive, PlayCircle, Folder, ChevronRight, Video, Image as ImageIcon, Download, Upload, Search, LayoutGrid, List } from 'lucide-react';

interface DisplayFolder {
  albumId: string;
  albumTitle: string;
  folderName: string;
  subfolderPath: string;
  itemCount: number;
  subfolderCount?: number;
  megaUrl: string;
  createdAt: string;
  coverImageUrl?: string;
}

let cachedAlbums: Album[] = [];
let cachedDisplayFolders: DisplayFolder[] = [];

export default function HomePage() {
  const { toasts, toastSuccess, toastError, toastInfo, removeToast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [albums, setAlbumsState] = useState<Album[]>(cachedAlbums);
  const [displayFolders, setDisplayFoldersState] = useState<DisplayFolder[]>(cachedDisplayFolders);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'items'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(cachedDisplayFolders.length === 0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMegaUrl, setNewMegaUrl] = useState('');

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

  // Local Storage Restoration States
  const [hasLocalBackup, setHasLocalBackup] = useState(false);
  const [localBackupCount, setLocalBackupCount] = useState(0);
  const [isRestoringLocal, setIsRestoringLocal] = useState(false);

  const loadData = useCallback(async () => {
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

      // Check if browser LocalStorage has saved links
      let savedLocalItems: any[] = [];
      try {
        const stored = localStorage.getItem('megavault_saved_links');
        if (stored) savedLocalItems = JSON.parse(stored);
      } catch (e) {}

      if (loadedAlbums.length > 0) {
        // Automatically sync loaded albums to browser LocalStorage cache (sanitized without raw decryption keys)
        const cacheItems = loadedAlbums.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
        }));
        localStorage.setItem('megavault_saved_links', JSON.stringify(cacheItems));
        setHasLocalBackup(false);
      } else if (savedLocalItems.length > 0) {
        // Server returned 0 folders (Render restart), but browser has saved links!
        setHasLocalBackup(true);
        setLocalBackupCount(savedLocalItems.length);
      }

      // Render albums and subfolders instantly from single API response (0ms delay, 0 N+1 calls)
      const folderList: DisplayFolder[] = [];
      for (const alb of loadedAlbums) {
        const coverUrl = (alb as any).cover_image_url || (alb as any).coverImageUrl || (alb as any).coverUrl || undefined;
        const subfolders = (alb as any).subfolders || [];
        if (subfolders.length > 0) {
          for (const sub of subfolders) {
            folderList.push({
              albumId: alb.id,
              albumTitle: alb.title,
              folderName: sub.name,
              subfolderPath: sub.path,
              itemCount: sub.itemCount || 0,
              megaUrl: alb.megaUrl || '',
              createdAt: alb.createdAt,
              coverImageUrl: coverUrl,
            });
          }
        } else {
          folderList.push({
            albumId: alb.id,
            albumTitle: alb.title,
            folderName: alb.title,
            subfolderPath: '',
            itemCount: alb.mediaCount?.total ?? 0,
            subfolderCount: alb.subfolderCount ?? 0,
            megaUrl: alb.megaUrl || '',
            createdAt: alb.createdAt,
            coverImageUrl: coverUrl,
          });
        }
      }

      setDisplayFolders(folderList);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load albums:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Global Keyboard Shortcut for Search (Press '/' or 'Ctrl+K')
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

  const [isSubmitting, setIsSubmitting] = useState(false);

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
        toastSuccess('Restored Saved Folders!', `Successfully restored ${savedLocalItems.length} folders from browser cache.`);
        await loadData();
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
        loadData();
      } else {
        toastError('Failed to Link Album', data.error || 'Failed to add album');
      }
    } catch (err) {
      toastError('Error', 'An error occurred while creating the album');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAlbum = async (id: string) => {
    try {
      const res = await fetch(`/api/albums/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toastInfo('Album Removed', 'Album link was successfully removed.');
        loadData();
      } else {
        toastError('Failed to remove album');
      }
    } catch (err) {
      toastError('Error removing album');
    }
  };

  const handleFillDemo = () => {
    setNewTitle('Family Vacation Demo 2026');
    setNewDescription('Indexed photos & videos from sample MEGA folder');
    setNewMegaUrl('https://mega.nz/folder/example#demo-key-2026');
    toastInfo('Demo Details Loaded', 'Sample MEGA folder link filled in.');
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
        loadData();
      } else {
        toastError('Import Failed', data.error || 'Failed to restore backup');
      }
    } catch (err) {
      toastError('Invalid File', 'Invalid backup JSON file');
    }
  };

  const filteredFolders = displayFolders
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
                Server storage was reset (Render restart). Click below to show and restore all your saved folders.
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
          <p className="text-xs text-zinc-400 mt-0.5">Private Media Collections & Folders</p>
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
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20"
          >
            <FolderPlus className="w-4 h-4" />
            <span>New Album Link</span>
          </button>
        </div>
      </div>

      {/* Folders & Subfolders Section */}
      <section className="mb-12">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Indexed Folders</h2>
            <span className="text-xs text-zinc-500 font-medium font-mono">({displayFolders.length})</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search folders..."
                className="w-full bg-zinc-900/80 border border-zinc-800 rounded-xl pl-8 pr-12 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
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
              className="bg-zinc-900/80 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name (A-Z)</option>
              <option value="items">Most Items</option>
            </select>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-zinc-900/80 p-0.5 rounded-xl border border-zinc-800">
              <button
                onClick={() => setViewMode('grid')}
                title="Grid View"
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="Detailed List View"
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'list' ? 'bg-blue-600/30 text-blue-400 border border-blue-500/40' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-2xl bg-zinc-900/60 animate-pulse border border-zinc-800" />
            ))}
          </div>
        ) : filteredFolders.length === 0 ? (
          <div className="glass-panel p-12 rounded-3xl text-center border border-zinc-800">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto mb-4">
              <Folder className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              {searchQuery ? 'No Matching Folders Found' : 'No Folders Displaying Currently'}
            </h3>
            <p className="text-xs text-zinc-400 mb-6">
              {searchQuery
                ? `No folders matched "${searchQuery}". Try a different keyword.`
                : hasLocalBackup
                ? `Render container restarted. Found ${localBackupCount} saved folder links in your browser database!`
                : 'Paste a MEGA folder link to index folders and subfolders automatically.'}
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
            {filteredFolders.map((folder) => (
              <Link
                key={`${folder.albumId}::${folder.subfolderPath || '__root__'}`}
                href={`/albums/${folder.albumId}${folder.subfolderPath ? `?folder=${encodeURIComponent(folder.subfolderPath)}` : ''}`}
                className="group"
              >
                <div className="glass-panel glass-panel-hover p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between gap-3 sm:gap-4 transition-all duration-300 hover:border-blue-500/40 relative overflow-hidden">
                  {/* Dynamic Album Cover Background if available */}
                  {folder.coverImageUrl && (
                    <div className="absolute inset-0 z-0 opacity-15 group-hover:opacity-25 transition-opacity pointer-events-none">
                      <img
                        src={folder.coverImageUrl}
                        alt={folder.folderName}
                        className="w-full h-full object-cover blur-[2px]"
                      />
                    </div>
                  )}

                  <div className="flex items-center space-x-3 sm:space-x-4 relative z-10 min-w-0">
                    {folder.coverImageUrl ? (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl overflow-hidden border border-blue-500/40 flex-shrink-0 group-hover:scale-105 transition-transform bg-zinc-900">
                        <img src={folder.coverImageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                        <Folder className="w-5 h-5 sm:w-6 sm:h-6 fill-blue-400/20" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                        {folder.folderName}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 flex flex-wrap items-center gap-1.5 font-medium">
                        <span>
                          {folder.itemCount === 0 && (folder.subfolderCount || 0) > 0
                            ? `${folder.subfolderCount} ${folder.subfolderCount === 1 ? 'Subfolder' : 'Subfolders'}`
                            : `${folder.itemCount} media items`}
                        </span>
                        {folder.albumTitle !== folder.folderName && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 truncate max-w-[100px] sm:max-w-[140px]">
                            {folder.albumTitle}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="p-1.5 sm:p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all flex-shrink-0 relative z-10">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

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
