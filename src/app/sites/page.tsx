'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { VideoPlayer } from '@/components/viewer/VideoPlayer';
import { MediaItem } from '@/types';
import {
  Globe,
  Plus,
  Search,
  Play,
  Film,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Download,
  AlertCircle,
  X,
  Tv,
  Radio,
  Zap,
} from 'lucide-react';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

interface SavedSite {
  id: string;
  nickname: string;
  url: string;
  poster_url?: string | null;
  video_count: number;
  created_at: string;
  updated_at?: string | null;
}

interface SavedSiteVideo {
  id: string;
  site_id: string;
  title: string;
  stream_url: string;
  proxy_stream_url?: string | null;
  poster_url?: string | null;
  format: string;
  mime_type: string;
  source?: string | null;
  created_at: string;
  site_nickname?: string;
}

export default function SavedSitesPage() {
  const { toasts, toastSuccess, toastError, toastInfo, removeToast } = useToast();

  const [sites, setSites] = useState<SavedSite[]>([]);
  const [videos, setVideos] = useState<SavedSiteVideo[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Playback state
  const [selectedVideo, setSelectedVideo] = useState<SavedSiteVideo | null>(null);
  const [useProxy, setUseProxy] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load Saved Sites & Videos
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [sitesRes, videosRes] = await Promise.all([
        fetch('/api/sites'),
        fetch('/api/sites/all-videos'),
      ]);

      if (sitesRes.status === 401 || sitesRes.redirected) {
        window.location.href = '/login';
        return;
      }

      if (sitesRes.ok) {
        const sitesData = await sitesRes.json();
        setSites(sitesData.sites || []);
      }

      if (videosRes.ok) {
        const videosData = await videosRes.json();
        setVideos(videosData.videos || []);
      }
    } catch (err) {
      console.error('Failed to load saved sites:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Add Site
  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNickname.trim() || !newUrl.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setAddError(null);

      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: newNickname.trim(),
          url: newUrl.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toastSuccess(
          'Website Channel Saved!',
          `Extracted ${data.videosCount} video stream${data.videosCount === 1 ? '' : 's'} from "${newNickname}".`
        );
        setNewNickname('');
        setNewUrl('');
        setIsAddModalOpen(false);
        await loadData();
      } else {
        setAddError(data.error || 'Failed to extract and save website');
      }
    } catch (err: any) {
      setAddError(err.message || 'Network error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Refresh Site
  const handleRefreshSite = async (siteId: string, nickname: string) => {
    try {
      setIsRefreshing(siteId);
      const res = await fetch(`/api/sites/${siteId}/refresh`, { method: 'POST' });
      const data = await res.json();

      if (res.ok && data.success) {
        toastSuccess('Channel Re-scanned', `Updated "${nickname}" with ${data.videoCount} videos.`);
        await loadData();
      } else {
        toastError('Refresh Failed', data.error || 'Failed to re-scan site');
      }
    } catch (err: any) {
      toastError('Refresh Error', err.message || 'Error communicating with server');
    } finally {
      setIsRefreshing(null);
    }
  };

  // Handle Delete Site
  const handleDeleteSite = async (siteId: string, nickname: string) => {
    if (!confirm(`Are you sure you want to remove "${nickname}" and its saved video streams?`)) return;

    try {
      const res = await fetch(`/api/sites/${siteId}`, { method: 'DELETE' });
      if (res.ok) {
        toastSuccess('Site Removed', `"${nickname}" was deleted.`);
        if (selectedSiteId === siteId) setSelectedSiteId(null);
        await loadData();
      } else {
        toastError('Failed to delete site');
      }
    } catch {
      toastError('Error deleting site');
    }
  };

  // Unified Search Filtering across all saved sites
  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return videos.filter((v) => {
      // Filter by selected site pill
      if (selectedSiteId && v.site_id !== selectedSiteId) return false;

      // Filter by search query
      if (q) {
        const titleMatch = v.title.toLowerCase().includes(q);
        const nicknameMatch = v.site_nickname ? v.site_nickname.toLowerCase().includes(q) : false;
        const formatMatch = v.format.toLowerCase().includes(q);
        return titleMatch || nicknameMatch || formatMatch;
      }

      return true;
    });
  }, [videos, selectedSiteId, searchQuery]);

  const handleCopyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Convert to MediaItem for clean on-demand VideoPlayer streaming (Zero pre-downloading)
  const playerMediaItem: MediaItem | null = selectedVideo
    ? {
        id: selectedVideo.id,
        albumId: 'web-extracted',
        albumTitle: selectedVideo.site_nickname || 'Saved Web Channel',
        folderPath: 'Ad-Free Play',
        fileHandle: 'web',
        fileName: selectedVideo.title,
        mimeType: selectedVideo.mime_type || 'video/mp4',
        mediaType: 'VIDEO',
        size: 0,
        createdAt: selectedVideo.created_at,
        thumbnailUrl: selectedVideo.poster_url || undefined,
        streamUrl: useProxy && selectedVideo.proxy_stream_url ? selectedVideo.proxy_stream_url : selectedVideo.stream_url,
      }
    : null;

  return (
    <PageContainer>
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero-Storage • Plays Only on Click • No Pre-Downloading</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>Saved Video Sites & Channels</span>
            <Sparkles className="w-5 h-5 text-purple-400" />
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
            Store video site links with custom nicknames. Videos stream on-demand directly inside our clean player without popups, ads, or local file storage.
          </p>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
          <button
            onClick={() => setUseProxy(!useProxy)}
            title="Toggle Stream Proxy for hotlinked or CORS protected videos"
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border ${
              useProxy
                ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{useProxy ? 'CORS Bypass: ON' : 'Direct Stream'}</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-purple-600/25"
          >
            <Plus className="w-4 h-4" />
            <span>Add Website Channel</span>
          </button>
        </div>
      </div>

      {/* Unified Search & Site Filter Bar */}
      <div className="mb-6 p-3 rounded-2xl glass-panel border border-zinc-800 bg-zinc-950/90 shadow-xl space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search across all saved sites, video titles, and formats..."
            className="w-full bg-zinc-900/90 border border-zinc-800 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Site Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedSiteId(null)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedSiteId === null
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <Globe className="w-3 h-3" />
            <span>All Channels ({videos.length})</span>
          </button>

          {sites.map((site) => (
            <button
              key={site.id}
              onClick={() => setSelectedSiteId(selectedSiteId === site.id ? null : site.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                selectedSiteId === site.id
                  ? 'bg-purple-600/30 text-purple-300 border-purple-500/50 shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border-zinc-800'
              }`}
            >
              <span>{site.nickname}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-black/60 text-zinc-300">
                {site.video_count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Saved Sites Channel Cards Carousel / Grid */}
      {sites.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Tv className="w-3.5 h-3.5 text-purple-400" />
              <span>Saved Website Channels ({sites.length})</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {sites.map((site) => {
              const isSelected = selectedSiteId === site.id;
              const isRef = isRefreshing === site.id;

              return (
                <div
                  key={site.id}
                  onClick={() => setSelectedSiteId(isSelected ? null : site.id)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-center justify-between gap-3 relative overflow-hidden group ${
                    isSelected
                      ? 'border-purple-500 bg-purple-950/20 ring-1 ring-purple-500/40 shadow-lg'
                      : 'border-zinc-800 bg-zinc-950/70 hover:border-purple-500/40'
                  }`}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    {site.poster_url ? (
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-purple-500/30 flex-shrink-0 bg-zinc-900">
                        <img src={site.poster_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 flex-shrink-0">
                        <Globe className="w-6 h-6" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors truncate">
                        {site.nickname}
                      </h3>
                      <p className="text-[11px] text-zinc-400 font-mono mt-0.5 truncate max-w-[200px]">
                        {site.url}
                      </p>
                      <span className="inline-block mt-1 text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30">
                        {site.video_count} {site.video_count === 1 ? 'Video' : 'Videos'} Stored
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleRefreshSite(site.id, site.nickname)}
                      disabled={isRef}
                      title="Re-scan and update website video streams"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                      <RefreshCw className={`w-4 h-4 text-blue-400 ${isRef ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                      onClick={() => handleDeleteSite(site.id, site.nickname)}
                      title="Delete website channel"
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Videos Section */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
            <Film className="w-3.5 h-3.5 text-blue-400" />
            <span>
              {searchQuery
                ? `Search Results (${filteredVideos.length})`
                : selectedSiteId
                ? `Channel Streams (${filteredVideos.length})`
                : `All Stored Website Streams (${filteredVideos.length})`}
            </span>
          </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="aspect-video rounded-2xl bg-zinc-900 animate-pulse border border-zinc-800" />
            ))}
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="glass-panel p-12 rounded-3xl text-center border border-zinc-800 my-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mx-auto mb-4">
              <Globe className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              {searchQuery ? 'No Matching Video Streams' : 'No Saved Website Channels Yet'}
            </h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mb-6">
              {searchQuery
                ? `No video stream matched "${searchQuery}". Try searching a different keyword or nickname.`
                : 'Add any website URL and give it a nickname. We will index and store video streams with real thumbnails so you can stream them anytime without popups or ads.'}
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
                className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-md"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Website Link</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredVideos.map((vid) => {
              const poster = vid.poster_url;

              return (
                <div
                  key={vid.id}
                  className="glass-panel rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-950 flex flex-col group hover:border-purple-500/50 hover:shadow-xl transition-all duration-200"
                >
                  {/* Poster / Play Overlay */}
                  <div
                    onClick={() => setSelectedVideo(vid)}
                    className="relative aspect-video w-full bg-zinc-900 cursor-pointer overflow-hidden flex items-center justify-center"
                  >
                    {poster ? (
                      <img
                        src={poster}
                        alt={vid.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
                        <Film className="w-10 h-10 text-purple-500/40" />
                      </div>
                    )}

                    {/* Top Badges */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
                      <span className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-extrabold text-purple-300 border border-white/10 uppercase font-mono">
                        {vid.format}
                      </span>
                      {vid.site_nickname && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-600/90 text-[10px] font-bold text-white shadow-sm truncate max-w-[140px]">
                          {vid.site_nickname}
                        </span>
                      )}
                    </div>

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                      <div className="w-12 h-12 rounded-full bg-purple-600 text-white flex items-center justify-center group-hover:scale-110 group-hover:bg-purple-500 transition-all shadow-xl shadow-purple-600/50 border border-white/20">
                        <Play className="w-5 h-5 fill-white translate-x-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Video Details & Actions */}
                  <div className="p-3.5 flex flex-col justify-between flex-1 space-y-3">
                    <div>
                      <h3 className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-purple-400 transition-colors" title={vid.title}>
                        {vid.title}
                      </h3>
                    </div>

                    <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setSelectedVideo(vid)}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>Play Stream</span>
                      </button>

                      <button
                        onClick={() => handleCopyLink(vid.id, useProxy && vid.proxy_stream_url ? vid.proxy_stream_url : vid.stream_url)}
                        title="Copy direct stream URL"
                        className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
                      >
                        {copiedId === vid.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>

                      {vid.proxy_stream_url && (
                        <a
                          href={`${vid.proxy_stream_url}&download=true`}
                          download
                          title="Download stream"
                          className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add Website Channel Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 border border-zinc-800 shadow-2xl relative my-auto">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
              <Globe className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-white mb-1">Save Website Video Channel</h3>
            <p className="text-xs text-zinc-400 mb-6">
              MegaVault will index the page's video streams and posters. Videos are stored strictly as stream references — no pre-downloading or local file storage.
            </p>

            {addError && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddSite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Website Nickname / Label
                </label>
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder="e.g. My Anime Site, Tech Course, Film Archive"
                  required
                  disabled={isSubmitting}
                  className="w-full bg-zinc-900 border border-zinc-700/70 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Website URL
                </label>
                <input
                  type="text"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://your-site.com/videos"
                  required
                  disabled={isSubmitting}
                  className="w-full bg-zinc-900 border border-zinc-700/70 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold transition-all shadow-md flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Scanning & Saving...</span>
                    </>
                  ) : (
                    <span>Save Channel</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Built-in Video Player Modal (Plays strictly on-demand, zero pre-downloading) */}
      {playerMediaItem && (
        <VideoPlayer
          media={playerMediaItem}
          onClose={() => setSelectedVideo(null)}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </PageContainer>
  );
}
