'use client';

import React, { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AlbumCard } from '@/components/gallery/AlbumCard';
import { MediaCard } from '@/components/gallery/MediaCard';
import { Album, MediaItem } from '@/types';
import { FolderPlus, Sparkles, X, Link as LinkIcon, HardDrive, PlayCircle } from 'lucide-react';

export default function HomePage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [recentMedia, setRecentMedia] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMegaUrl, setNewMegaUrl] = useState('');

  const loadData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/albums');
      if (res.ok) {
        const data = await res.json();
        setAlbums(data.albums || []);
        
        // Load media from first album for recent photos stream
        if (data.albums && data.albums.length > 0) {
          const mediaRes = await fetch(`/api/albums/${data.albums[0].id}/media`);
          if (mediaRes.ok) {
            const mediaData = await mediaRes.json();
            setRecentMedia(mediaData.items || []);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load albums:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newMegaUrl) return;

    try {
      const res = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          megaUrl: newMegaUrl,
        }),
      });

      if (res.ok) {
        setNewTitle('');
        setNewDescription('');
        setNewMegaUrl('');
        setIsAddModalOpen(false);
        loadData();
      } else {
        alert('Failed to add album');
      }
    } catch (err) {
      alert('An error occurred');
    }
  };

  const handleDeleteAlbum = async (id: string) => {
    try {
      const res = await fetch(`/api/albums?id=${id}`, { method: 'DELETE' });
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
          <p className="text-xs text-zinc-400 mt-0.5">Family & Personal Photo Vault</p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20"
        >
          <FolderPlus className="w-4 h-4" />
          <span>New Album</span>
        </button>
      </div>

      {/* Albums Section (Google Photos Style) */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Albums</h2>
          <span className="text-xs text-zinc-500 font-medium">{albums.length} collections</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-zinc-900/60 animate-pulse border border-zinc-800" />
            ))}
          </div>
        ) : albums.length === 0 ? (
          <div className="glass-panel p-8 rounded-2xl text-center border border-zinc-800">
            <p className="text-sm text-zinc-400 mb-4">No albums created yet.</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold"
            >
              Add First MEGA Folder
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} onDelete={handleDeleteAlbum} />
            ))}
          </div>
        )}
      </section>

      <hr className="border-zinc-800/80 my-8" />

      {/* Recent Photos Stream (Google Photos Style) */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wider">Recent Photos & Videos</h2>
          <span className="text-xs text-zinc-500 font-medium">All Media</span>
        </div>

        {recentMedia.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-sm">
            <span>No recent media indexed yet.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {recentMedia.map((media) => (
              <MediaCard key={media.id} media={media} />
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
              Paste your shared MEGA folder link. MegaVault will index media without uploading or storing files.
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
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-md shadow-blue-600/20"
                >
                  Save Album
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
