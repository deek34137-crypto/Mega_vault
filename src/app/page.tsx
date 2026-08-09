'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { AlbumCard } from '@/components/gallery/AlbumCard';
import { Album } from '@/types';
import { FolderPlus, Sparkles, X, Link as LinkIcon, HardDrive, PlayCircle, Folder, ChevronRight, Video, Image as ImageIcon } from 'lucide-react';

interface DisplayFolder {
  albumId: string;
  albumTitle: string;
  folderName: string;
  subfolderPath: string;
  itemCount: number;
  subfolderCount?: number;
  megaUrl: string;
  createdAt: string;
}

export default function HomePage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [displayFolders, setDisplayFolders] = useState<DisplayFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMegaUrl, setNewMegaUrl] = useState('');

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

      // Fetch subfolder trees for all albums in PARALLEL (not sequentially)
      const results = await Promise.allSettled(
        loadedAlbums.map(async (alb) => {
          try {
            const mediaRes = await fetch(`/api/albums/${alb.id}/media`);
            if (mediaRes.status === 401 || mediaRes.redirected) {
              window.location.href = '/login';
              return null;
            }
            if (!mediaRes.ok) {
              return { alb, mediaData: { subfolders: [], mediaCount: alb.mediaCount || { total: 0, images: 0, videos: 0 } } };
            }
            const mediaData = await mediaRes.json();
            return { alb, mediaData };
          } catch (e) {
            return { alb, mediaData: { subfolders: [], mediaCount: alb.mediaCount || { total: 0, images: 0, videos: 0 } } };
          }
        })
      );

      const foldersList: DisplayFolder[] = [];
      for (const result of results) {
        if (result.status !== 'fulfilled' || !result.value) continue;
        const { alb, mediaData } = result.value;

        // ONLY hide folder if link is confirmed permanently dead/invalid
        if (mediaData && mediaData.isDeadLink) {
          console.warn(`[MegaVault] Skipping album ${alb.title} (${alb.id}) because its link is dead/invalid.`);
          continue;
        }

        if (mediaData && mediaData.subfolders && mediaData.subfolders.length > 0) {
          // Folder has subfolders → render each subfolder as a card
          for (const sub of mediaData.subfolders) {
            foldersList.push({
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
          // Folder has files directly → render as main album folder
          foldersList.push({
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
      setDisplayFolders(foldersList);
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

  return (
    <PageContainer>
      {/* Top Bar Header */}
      <div className="flex items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>MegaVault</span>
            <Sparkles className="w-5 h-5 text-blue-400" />
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Private Media Collections & Folders</p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20"
        >
          <FolderPlus className="w-4 h-4" />
          <span>New Album Link</span>
        </button>
      </div>

      {/* Folders & Subfolders Section (ONLY Folders on Homepage) */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Indexed Folders</h2>
          <span className="text-xs text-zinc-500 font-medium">{displayFolders.length} folders</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 rounded-2xl bg-zinc-900/60 animate-pulse border border-zinc-800" />
            ))}
          </div>
        ) : displayFolders.length === 0 ? (
          <div className="glass-panel p-12 rounded-3xl text-center border border-zinc-800">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto mb-4">
              <Folder className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">No Folders Added Yet</h3>
            <p className="text-xs text-zinc-400 mb-6">
              Paste a MEGA folder link to index folders and subfolders automatically.
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md"
            >
              Add First MEGA Folder Link
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayFolders.map((folder) => (
              <Link
                key={`${folder.albumId}::${folder.subfolderPath || '__root__'}`}
                href={`/albums/${folder.albumId}${folder.subfolderPath ? `?folder=${encodeURIComponent(folder.subfolderPath)}` : ''}`}
                className="group"
              >
                <div className="glass-panel glass-panel-hover p-6 rounded-3xl border border-zinc-800/80 bg-zinc-950/60 flex items-start justify-between gap-4 transition-all duration-300 hover:border-blue-500/40">
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0 group-hover:scale-105 transition-transform">
                      <Folder className="w-6 h-6 fill-blue-400/20" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                        {folder.folderName}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1 flex items-center gap-2 font-medium">
                        <span>
                          {folder.itemCount === 0 && (folder.subfolderCount || 0) > 0
                            ? `${folder.subfolderCount} ${folder.subfolderCount === 1 ? 'Subfolder' : 'Subfolders'}`
                            : `${folder.itemCount} media items`}
                        </span>
                        {folder.albumTitle !== folder.folderName && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                            {folder.albumTitle}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="p-2 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-blue-400 group-hover:translate-x-1 transition-all">
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
