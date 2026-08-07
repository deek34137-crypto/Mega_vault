'use client';

import React, { useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { AlbumCard } from '@/components/gallery/AlbumCard';
import { MOCK_ALBUMS } from '@/lib/constants';
import { Plus, Search, FolderPlus, Link as LinkIcon, HardDrive, X } from 'lucide-react';

export default function AlbumsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [megaUrlInput, setMegaUrlInput] = useState('');

  const filteredAlbums = MOCK_ALBUMS.filter(
    (album) =>
      album.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      album.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PageContainer>
      {/* Header Section */}
      <SectionTitle
        title="Albums"
        subtitle="Manage and browse your indexed MEGA folder albums"
        action={
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Add MEGA Folder</span>
          </button>
        }
      />

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search albums..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-10 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50"
          />
        </div>
        <div className="text-xs text-zinc-400 font-medium">
          Showing <span className="text-white font-bold">{filteredAlbums.length}</span> albums
        </div>
      </div>

      {/* Albums Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredAlbums.map((album) => (
          <AlbumCard key={album.id} album={album} />
        ))}
      </div>

      {/* Add MEGA Folder Modal Placeholder UI */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 border border-zinc-800 shadow-2xl relative">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
              <HardDrive className="w-6 h-6 text-red-400" />
            </div>

            <h3 className="text-xl font-bold text-white mb-1">Add MEGA Folder Link</h3>
            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              Paste a public or shared MEGA folder link that contains the decryption key. MegaVault will read folder metadata without downloading files.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  MEGA Folder URL
                </label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={megaUrlInput}
                    onChange={(e) => setMegaUrlInput(e.target.value)}
                    placeholder="https://mega.nz/folder/..."
                    className="w-full bg-zinc-900 border border-zinc-700/70 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Album Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Auto-detected from folder if empty"
                  className="w-full bg-zinc-900 border border-zinc-700/70 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3">
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    alert('Folder indexing will be processed when backend is connected.');
                    setIsAddModalOpen(false);
                  }}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-all shadow-md shadow-blue-600/20"
                >
                  Retrieve Folder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
