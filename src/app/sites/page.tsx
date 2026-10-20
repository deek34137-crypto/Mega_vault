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
  ChevronRight,
  ChevronLeft,
  Layers,
  Compass,
} from 'lucide-react';
import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';

export interface ExtractedSection {
  id: string;
  name: string;
  url: string;
}

export interface SavedSite {
  id: string;
  nickname: string;
  url: string;
  poster_url?: string | null;
  video_count: number;
  sections?: ExtractedSection[];
  created_at: string;
  updated_at?: string | null;
}

export interface SavedSiteVideo {
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

  // Section & Pagination State
  const [activeSectionUrl, setActiveSectionUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isBrowsingPage, setIsBrowsingPage] = useState<boolean>(false);
  const [hasNextPage, setHasNextPage] = useState<boolean>(true);
  const [sectionVideosMap, setSectionVideosMap] = useState<Record<string, SavedSiteVideo[]>>({});

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
  const videoGridRef = useRef<HTMLDivElement>(null);

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

  // Reset section and page when selected channel changes
  const handleSelectSite = (siteId: string | null) => {
    setSelectedSiteId(siteId);
    setActiveSectionUrl(null);
    setCurrentPage(1);
    setHasNextPage(true);
  };

  const currentSite = useMemo(() => {
    if (!selectedSiteId) return null;
    return sites.find((s) => s.id === selectedSiteId) || null;
  }, [sites, selectedSiteId]);

  // Browse a section or target page
  const browseSectionPage = useCallback(
    async (site: SavedSite, sectionUrl: string, page: number) => {
      const cacheKey = `${site.id}_${sectionUrl}_${page}`;
      if (sectionVideosMap[cacheKey] && sectionVideosMap[cacheKey].length > 0) {
        return;
      }

      try {
        setIsBrowsingPage(true);
        const res = await fetch(`/api/sites/${site.id}/browse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionUrl, page }),
        });

        if (res.ok) {
          const data = await res.json();
          const items: SavedSiteVideo[] = (data.videos || []).map((v: any) => ({
            id: v.id,
            site_id: site.id,
            title: v.title,
            stream_url: v.streamUrl,
            proxy_stream_url: v.proxyStreamUrl,
            poster_url: v.posterUrl,
            format: v.format,
            mime_type: v.mimeType,
            source: v.source,
            created_at: new Date().toISOString(),
            site_nickname: site.nickname,
          }));

          setSectionVideosMap((prev) => ({
            ...prev,
            [cacheKey]: items,
          }));

          setHasNextPage(items.length > 0);

          // Update site sections if newly returned
          if (data.sections && data.sections.length > 0) {
            setSites((prev) =>
              prev.map((s) => (s.id === site.id ? { ...s, sections: data.sections } : s))
            );
          }
        } else {
          toastError('Browse Failed', 'Failed to load page videos.');
        }
      } catch (err: any) {
        toastError('Error', err.message || 'Could not fetch section page');
      } finally {
        setIsBrowsingPage(false);
      }
    },
    [sectionVideosMap, toastError]
  );

  // Handle switching sections
  const handleSelectSection = (sectionUrl: string | null) => {
    if (!currentSite) return;
    setActiveSectionUrl(sectionUrl);
    setCurrentPage(1);
    setHasNextPage(true);

    if (sectionUrl) {
      browseSectionPage(currentSite, sectionUrl, 1);
    }
    videoGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Handle pagination navigation (matching user's ref img1)
  const handleNavigatePage = async (newPage: number) => {
    if (!currentSite || newPage < 1 || isBrowsingPage) return;

    setCurrentPage(newPage);
    const targetSection = activeSectionUrl || currentSite.url;
    await browseSectionPage(currentSite, targetSection, newPage);
    videoGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

      if (res.ok) {
        toastSuccess(
          'Channel Added!',
          `"${newNickname}" was indexed with ${data.videosCount} playable streams.`
        );
        setNewNickname('');
        setNewUrl('');
        setIsAddModalOpen(false);
        await loadData();
        if (data.site?.id) {
          handleSelectSite(data.site.id);
        }
      } else {
        setAddError(data.error || 'Failed to extract video streams');
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
      toastInfo('Scanning Channel...', `Extracting live streams from "${nickname}"`);

      const res = await fetch(`/api/sites/${siteId}/refresh`, { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        toastSuccess('Channel Updated', data.message || `Scanned ${data.videoCount} streams.`);
        // Invalidate cached browsed pages for this site
        setSectionVideosMap((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => {
            if (k.startsWith(`${siteId}_`)) delete next[k];
          });
          return next;
        });
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
        if (selectedSiteId === siteId) handleSelectSite(null);
        await loadData();
      } else {
        toastError('Failed to delete site');
      }
    } catch {
      toastError('Error deleting site');
    }
  };

  // Determine current active video list
  const activeVideoList = useMemo(() => {
    if (!currentSite) return videos;

    // If viewing a section or page > 1, check sectionVideosMap
    if (activeSectionUrl || currentPage > 1) {
      const targetUrl = activeSectionUrl || currentSite.url;
      const cacheKey = `${currentSite.id}_${targetUrl}_${currentPage}`;
      if (sectionVideosMap[cacheKey]) {
        return sectionVideosMap[cacheKey];
      }
    }

    // Default to site's initial stored videos
    return videos.filter((v) => v.site_id === currentSite.id);
  }, [currentSite, activeSectionUrl, currentPage, sectionVideosMap, videos]);

  // Unified Search Filtering across videos
  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const baseList = selectedSiteId ? activeVideoList : videos;

    return baseList.filter((v) => {
      if (q) {
        const titleMatch = v.title.toLowerCase().includes(q);
        const nicknameMatch = v.site_nickname ? v.site_nickname.toLowerCase().includes(q) : false;
        const formatMatch = v.format.toLowerCase().includes(q);
        return titleMatch || nicknameMatch || formatMatch;
      }
      return true;
    });
  }, [selectedSiteId, activeVideoList, videos, searchQuery]);

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
        fileHandle: selectedVideo.id,
        fileName: selectedVideo.title,
        mimeType: selectedVideo.mime_type,
        mediaType: 'VIDEO',
        size: 0,
        thumbnailUrl: selectedVideo.poster_url || undefined,
        streamUrl:
          useProxy && selectedVideo.proxy_stream_url
            ? selectedVideo.proxy_stream_url
            : selectedVideo.stream_url,
        createdAt: selectedVideo.created_at,
        isFavorite: false,
      }
    : null;

  return (
    <PageContainer>
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Header Bar */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Tv className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Website Channels & Stored Streams
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Ad-free, popup-free video player with on-demand zero storage & instant streaming.</span>
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
            onClick={() => handleSelectSite(null)}
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
              onClick={() => handleSelectSite(selectedSiteId === site.id ? null : site.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                selectedSiteId === site.id
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
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

      {/* Selected Channel: Sections / Categories Tabs */}
      {currentSite && (
        <div className="mb-6 p-4 rounded-2xl border border-purple-500/30 bg-purple-950/15 backdrop-blur-md shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-bold text-white">
                <span className="text-purple-400">{currentSite.nickname}</span> Sections & Categories
              </h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="font-mono text-[11px] truncate max-w-[260px]">{currentSite.url}</span>
              <button
                onClick={() => handleRefreshSite(currentSite.id, currentSite.nickname)}
                disabled={isRefreshing === currentSite.id}
                title="Re-scan channel"
                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing === currentSite.id ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Section Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
            <button
              onClick={() => handleSelectSection(null)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                activeSectionUrl === null
                  ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30'
                  : 'bg-zinc-900 text-zinc-300 hover:text-white border-zinc-800'
              }`}
            >
              <span>Homepage (All)</span>
            </button>

            {currentSite.sections && currentSite.sections.length > 0 ? (
              currentSite.sections
                .filter((s) => s.id !== 'home')
                .map((sec) => {
                  const isActive = activeSectionUrl === sec.url;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => handleSelectSection(sec.url)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                        isActive
                          ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/30'
                          : 'bg-zinc-900 text-zinc-300 hover:text-white border-zinc-800'
                      }`}
                    >
                      <span>{sec.name}</span>
                    </button>
                  );
                })
            ) : (
              <span className="text-[11px] text-zinc-500 italic pl-1">
                No sub-sections detected. You can browse via pagination below.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Video Grid Section Header */}
      <div ref={videoGridRef} className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Film className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            {selectedSiteId
              ? `${currentSite?.nickname || 'Channel'} Videos (Page ${currentPage})`
              : 'All Indexed Video Streams'}
          </h2>
          <span className="text-xs text-zinc-500 font-mono">({filteredVideos.length})</span>
        </div>

        {isBrowsingPage && (
          <div className="flex items-center gap-2 text-xs text-blue-400 font-mono">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Loading streams...</span>
          </div>
        )}
      </div>

      {/* Video Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-video rounded-2xl bg-zinc-900 animate-pulse border border-zinc-800" />
          ))}
        </div>
      ) : isBrowsingPage ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-video rounded-2xl bg-zinc-900/60 animate-pulse border border-zinc-800 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin opacity-50" />
            </div>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center border border-zinc-800 my-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mx-auto mb-4">
            <Globe className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">
            {searchQuery ? 'No Matching Video Streams' : 'No Videos In This Section'}
          </h3>
          <p className="text-xs text-zinc-400 max-w-md mx-auto mb-6">
            {searchQuery
              ? `No video stream matched "${searchQuery}". Try searching a different keyword or nickname.`
              : 'No videos were found for this section or page. Try clicking another section or returning to Homepage.'}
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
              onClick={() => handleSelectSection(null)}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-md"
            >
              <span>Back to Homepage Videos</span>
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
                    <h3
                      className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-purple-400 transition-colors"
                      title={vid.title}
                    >
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
                      onClick={() => handleCopyLink(vid.id, vid.stream_url)}
                      title="Copy stream link"
                      className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
                    >
                      {copiedId === vid.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>

                    <a
                      href={vid.stream_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open source stream in new tab"
                      className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls - Matching User's Ref Img1 (1 >) */}
      {selectedSiteId && currentSite && !isLoading && (
        <div className="mt-10 mb-6 flex items-center justify-center gap-4 py-4">
          {/* Previous Page Button (if page > 1) */}
          {currentPage > 1 && (
            <button
              onClick={() => handleNavigatePage(currentPage - 1)}
              disabled={isBrowsingPage}
              title="Previous Page"
              className="px-5 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">Prev</span>
            </button>
          )}

          {/* Current Page Number (matching '1' in user's ref image) */}
          <div className="flex items-center justify-center min-w-[32px] h-9 px-2 text-white font-extrabold text-2xl font-mono select-none">
            {currentPage}
          </div>

          {/* Next Page Blue Pill Button (matching blue pill with '>' in user's ref image) */}
          <button
            onClick={() => handleNavigatePage(currentPage + 1)}
            disabled={isBrowsingPage || !hasNextPage}
            title="Next Page"
            className="w-16 h-9 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white flex items-center justify-center transition-all shadow-lg shadow-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed group"
          >
            {isBrowsingPage ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <ChevronRight className="w-5 h-5 text-white stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
            )}
          </button>
        </div>
      )}

      {/* Ad-Free Custom Video Player Overlay */}
      {selectedVideo && playerMediaItem && (
        <VideoPlayer
          media={playerMediaItem}
          onClose={() => setSelectedVideo(null)}
        />
      )}

      {/* Add Website Channel Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel w-full max-w-lg rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add Website Channel</h3>
                  <p className="text-xs text-zinc-400">Scrape, store thumbnails & stream ad-free</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Website Channel Nickname
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DesiHub, MastiRaja, My Channel..."
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Website / Video URL
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. desihub.sh, mastiraja.io, or https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              {addError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                <p className="font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Zero-Storage Promise</span>
                </p>
                <p>
                  No raw video files are downloaded to local storage. Only real stream URLs, categories and posters are indexed so you can play on user click without any ads or popups.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/30 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Scanning Channel...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Scan & Save Channel</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
