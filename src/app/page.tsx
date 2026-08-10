'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { AlbumCard } from '@/components/gallery/AlbumCard';
import { Album } from '@/types';
import { FolderPlus, Sparkles, X, Link as LinkIcon, HardDrive, PlayCircle, Folder, ChevronRight, Video, Image as ImageIcon, Download, Upload, Search } from 'lucide-react';

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

export default function HomePage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [displayFolders, setDisplayFolders] = useState<DisplayFolder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name' | 'items'>('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMegaUrl, setNewMegaUrl] = useState('');

  // Local Storage Restoration States
  const [hasLocalBackup, setHasLocalBackup] = useState(false);
  const [localBackupCount, setLocalBackupCount] = useState(0);
  const [isRestoringLocal, setIsRestoringLocal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
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

      // Step 1: Render album list INSTANTLY from DB query (0ms delay)
      const initialDisplay: DisplayFolder[] = loadedAlbums.map((alb) => ({
        albumId: alb.id,
        albumTitle: alb.title,
        folderName: alb.title,
        subfolderPath: '',
        itemCount: alb.mediaCount?.total ?? 0,
        subfolderCount: alb.subfolderCount ?? 0,
        megaUrl: alb.megaUrl || '',
        createdAt: alb.createdAt,
        coverImageUrl: (alb as any).cover_image_url || (alb as any).coverImageUrl || undefined,
      }));

      setDisplayFolders(initialDisplay);
      setIsLoading(false); // UI shows all folders immediately!

      // Step 2: Asynchronously update subfolders in background in small concurrency batches (max 3 at a time)
      const fetchInBatches = async () => {
        const results: Array<{ alb: Album; mediaData: any } | null> = [];
        const CONCURRENCY = 3;
        for (let i = 0; i < loadedAlbums.length; i += CONCURRENCY) {
          const chunk = loadedAlbums.slice(i, i + CONCURRENCY);
          const chunkResults = await Promise.allSettled(
            chunk.map(async (alb) => {
              try {
                const mediaRes = await fetch(`/api/albums/${alb.id}/media`);
                if (!mediaRes.ok) return null;
                const mediaData = await mediaRes.json();
                return { alb, mediaData };
              } catch (e) {
                return null;
              }
            })
          );
          for (const res of chunkResults) {
            if (res.status === 'fulfilled' && res.value) {
              results.push(res.value);
            }
          }
        }
        return results;
      };

      fetchInBatches().then((results) => {
        const updatedList: DisplayFolder[] = [];
        const deadIds: string[] = [];

        for (const item of results) {
          if (!item) continue;
          const { alb, mediaData } = item;

          if (mediaData && mediaData.isDeadLink) {
            // Keep album visible so user can manually retry or remove
            updatedList.push({
              albumId: alb.id,
              albumTitle: alb.title,
              folderName: alb.title,
              subfolderPath: '',
              itemCount: 0,
              subfolderCount: 0,
              megaUrl: alb.megaUrl || '',
              createdAt: alb.createdAt,
            });
            continue;
          }

          if (mediaData && mediaData.subfolders && mediaData.subfolders.length > 0) {
            for (const sub of mediaData.subfolders) {
              updatedList.push({
                albumId: alb.id,
                albumTitle: alb.title,
                folderName: sub.name,
                subfolderPath: sub.path,
                itemCount: sub.itemCount || 0,
                megaUrl: alb.megaUrl || '',
                createdAt: alb.createdAt,
              });
            }
          } else {
            updatedList.push({
              albumId: alb.id,
              albumTitle: alb.title,
              folderName: alb.title,
              subfolderPath: '',
              itemCount: mediaData?.mediaCount?.total ?? alb.mediaCount?.total ?? 0,
              subfolderCount: mediaData?.subfolders?.length ?? alb.subfolderCount ?? 0,
              megaUrl: alb.megaUrl || '',
              createdAt: alb.createdAt,
            });
          }
        }

        if (deadIds.length > 0) {
          // Filter out dead links from current display list peacefully
          setDisplayFolders((prev) => prev.filter((f) => !deadIds.includes(f.albumId)));
        } else if (updatedList.length > 0) {
          setDisplayFolders(updatedList);
        }
      });
    } catch (err) {
      console.error('Failed to load albums:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        await loadData();
      } else {
        alert(data.error || 'Failed to restore folders');
      }
    } catch (err) {
      alert('Error restoring folders from browser database');
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
        loadData();
      } else {
        alert(data.error || 'Failed to add album');
      }
    } catch (err) {
      alert('An error occurred while creating the album');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAlbum = async (id: string) => {
    try {
      const res = await fetch(`/api/albums/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadData();
      } else {
        alert('Failed to remove album');
      }
    } catch (err) {
      alert('Error removing album');
    }
  };

  const handleFillDemo = () => {
    setNewTitle('Family Vacation Demo 2026');
    setNewDescription('Indexed photos & videos from sample MEGA folder');
    setNewMegaUrl('https://mega.nz/folder/example#demo-key-2026');
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
      } else {
        alert('Failed to export backup');
      }
    } catch (err) {
      alert('Error exporting backup');
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
        alert(data.message || 'Backup restored successfully!');
        loadData();
      } else {
        alert(data.error || 'Failed to restore backup');
      }
    } catch (err) {
      alert('Invalid backup JSON file');
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
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search folders..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
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
              <option value="items">Most Items</option>
            </select>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
            {filteredFolders.map((folder) => (
              <Link
                key={`${folder.albumId}::${folder.subfolderPath || '__root__'}`}
                href={`/albums/${folder.albumId}${folder.subfolderPath ? `?folder=${encodeURIComponent(folder.subfolderPath)}` : ''}`}
                className="group"
              >
                <div className="glass-panel glass-panel-hover p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-zinc-800/80 bg-zinc-950/60 flex items-start justify-between gap-3 sm:gap-4 transition-all duration-300 hover:border-blue-500/40 relative overflow-hidden">
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

                  <div className="flex items-start space-x-3 sm:space-x-4 relative z-10">
                    {folder.coverImageUrl ? (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl overflow-hidden border border-blue-500/40 flex-shrink-0 group-hover:scale-105 transition-transform bg-zinc-900">
                        <img src={folder.coverImageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                        <Folder className="w-5 h-5 sm:w-6 sm:h-6 fill-blue-400/20" />
                      </div>
                    )}

                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                        {folder.folderName}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-zinc-400 mt-1 flex items-center gap-1.5 sm:gap-2 font-medium">
                        <span>
                          {folder.itemCount === 0 && (folder.subfolderCount || 0) > 0
                            ? `${folder.subfolderCount} ${folder.subfolderCount === 1 ? 'Subfolder' : 'Subfolders'}`
                            : `${folder.itemCount} media items`}
                        </span>
                        {folder.albumTitle !== folder.folderName && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 truncate max-w-[120px]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 border border-zinc-800 shadow-2xl relative">
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
    </PageContainer>
  );
}
