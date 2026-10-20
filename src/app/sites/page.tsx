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
  Zap,
  ChevronRight,
  ChevronLeft,
  Layers,
  Compass,
  ArrowRight,
  Signal,
  Eye,
  EyeOff,
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
  quality?: string | null;
  mime_type: string;
  source?: string | null;
  created_at: string;
  site_nickname?: string;
}

function formatColor(format: string) {
  const f = format.toUpperCase();
  if (f.includes('M3U8') || f.includes('HLS')) return { bg: 'bg-violet-500/20', border: 'border-violet-500/40', text: 'text-violet-300' };
  if (f.includes('MP4')) return { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-300' };
  if (f.includes('WEBM')) return { bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-300' };
  return { bg: 'bg-zinc-700/40', border: 'border-zinc-600/40', text: 'text-zinc-300' };
}

export default function SavedSitesPage() {
  const { toasts, toastSuccess, toastError, toastInfo, removeToast } = useToast();

  const [sites, setSites] = useState<SavedSite[]>([]);
  const [videos, setVideos] = useState<SavedSiteVideo[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState<string | null>(null);
  const [isSitesBarCollapsed, setIsSitesBarCollapsed] = useState(false);

  const [activeSectionUrl, setActiveSectionUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isBrowsingPage, setIsBrowsingPage] = useState<boolean>(false);
  const [hasNextPage, setHasNextPage] = useState<boolean>(true);
  const [sectionVideosMap, setSectionVideosMap] = useState<Record<string, SavedSiteVideo[]>>({});

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [selectedVideo, setSelectedVideo] = useState<SavedSiteVideo | null>(null);
  const [useProxy, setUseProxy] = useState(true);
  const [cardLayout, setCardLayout] = useState<'compact' | 'vertical'>('compact');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const videoGridRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  // Ambient cursor
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.left = e.clientX + 'px';
        cursorRef.current.style.top = e.clientY + 'px';
      }
    };
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);

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

  useEffect(() => { loadData(); }, [loadData]);

  const handleSelectSite = (siteId: string | null) => {
    setSelectedSiteId(siteId);
    setActiveSectionUrl(null);
    setCurrentPage(1);
    setHasNextPage(true);
    setSearchQuery('');
  };

  const currentSite = useMemo(() => {
    if (!selectedSiteId) return null;
    return sites.find((s) => s.id === selectedSiteId) || null;
  }, [sites, selectedSiteId]);

  const browseSectionPage = useCallback(
    async (site: SavedSite, sectionUrl: string, page: number) => {
      const cacheKey = `${site.id}_${sectionUrl}_${page}`;
      if (sectionVideosMap[cacheKey] && sectionVideosMap[cacheKey].length > 0) return;

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

          setSectionVideosMap((prev) => ({ ...prev, [cacheKey]: items }));
          setHasNextPage(items.length > 0);

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

  const handleSelectSection = (sectionUrl: string | null) => {
    if (!currentSite) return;
    setActiveSectionUrl(sectionUrl);
    setCurrentPage(1);
    setHasNextPage(true);
    if (sectionUrl) browseSectionPage(currentSite, sectionUrl, 1);
    videoGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleNavigatePage = async (newPage: number) => {
    if (!currentSite || newPage < 1 || isBrowsingPage) return;
    setCurrentPage(newPage);
    const targetSection = activeSectionUrl || currentSite.url;
    await browseSectionPage(currentSite, targetSection, newPage);
    videoGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNickname.trim() || !newUrl.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      setAddError(null);

      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: newNickname.trim(), url: newUrl.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        toastSuccess('Channel Added!', `"${newNickname}" indexed with ${data.videosCount} streams.`);
        setNewNickname('');
        setNewUrl('');
        setIsAddModalOpen(false);
        await loadData();
        if (data.site?.id) handleSelectSite(data.site.id);
      } else {
        setAddError(data.error || 'Failed to extract video streams');
      }
    } catch (err: any) {
      setAddError(err.message || 'Network error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefreshSite = async (siteId: string, nickname: string) => {
    try {
      setIsRefreshing(siteId);
      toastInfo('Scanning...', `Re-indexing "${nickname}"`);

      const res = await fetch(`/api/sites/${siteId}/refresh`, { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        toastSuccess('Updated', data.message || `Found ${data.videoCount} streams.`);
        setSectionVideosMap((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((k) => { if (k.startsWith(`${siteId}_`)) delete next[k]; });
          return next;
        });
        await loadData();
      } else {
        toastError('Refresh Failed', data.error || 'Failed to re-scan');
      }
    } catch (err: any) {
      toastError('Error', err.message || 'Error communicating with server');
    } finally {
      setIsRefreshing(null);
    }
  };

  const handleDeleteSite = async (siteId: string, nickname: string) => {
    if (!confirm(`Remove "${nickname}" and its saved streams?`)) return;
    try {
      const res = await fetch(`/api/sites/${siteId}`, { method: 'DELETE' });
      if (res.ok) {
        toastSuccess('Removed', `"${nickname}" deleted.`);
        if (selectedSiteId === siteId) handleSelectSite(null);
        await loadData();
      } else toastError('Failed to delete');
    } catch {
      toastError('Error deleting site');
    }
  };

  const activeVideoList = useMemo(() => {
    if (!currentSite) return videos;
    if (activeSectionUrl || currentPage > 1) {
      const targetUrl = activeSectionUrl || currentSite.url;
      const cacheKey = `${currentSite.id}_${targetUrl}_${currentPage}`;
      if (sectionVideosMap[cacheKey]) return sectionVideosMap[cacheKey];
    }
    return videos.filter((v) => v.site_id === currentSite.id);
  }, [currentSite, activeSectionUrl, currentPage, sectionVideosMap, videos]);

  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const baseList = selectedSiteId ? activeVideoList : videos;
    if (!q) return baseList;
    return baseList.filter((v) => {
      const titleMatch = v.title.toLowerCase().includes(q);
      const nicknameMatch = v.site_nickname ? v.site_nickname.toLowerCase().includes(q) : false;
      const formatMatch = v.format.toLowerCase().includes(q);
      return titleMatch || nicknameMatch || formatMatch;
    });
  }, [selectedSiteId, activeVideoList, videos, searchQuery]);

  const handleCopyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const playerMediaItem: MediaItem | null = selectedVideo
    ? {
        id: selectedVideo.id,
        albumId: 'web-extracted',
        albumTitle: selectedVideo.site_nickname || 'Saved Channel',
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
        quality: selectedVideo.quality || (selectedVideo.stream_url.includes('1080') ? '1080p FHD' : selectedVideo.stream_url.includes('720') ? '720p HD' : undefined),
        createdAt: selectedVideo.created_at,
        isFavorite: false,
      }
    : null;

  return (
    <PageContainer>
      <ToastContainer toasts={toasts} onDismiss={removeToast} />

      {/* Ambient cursor */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed z-0 w-[500px] h-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.025]"
        style={{
          background: 'radial-gradient(circle, rgba(168,85,247,1) 0%, transparent 70%)',
          transition: 'left 0.15s ease-out, top 0.15s ease-out',
        }}
      />

      {/* ─── Page Header ─────────────────────────────────────────── */}
      <div className="relative mb-10">
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
          <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-zinc-400">
            Saved Channels · Live Browsing · Ad-Free
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none mb-3">
              Website{' '}
              <span
                style={{
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundImage: 'linear-gradient(135deg, #c084fc 0%, #818cf8 50%, #67e8f9 100%)',
                  backgroundClip: 'text',
                }}
              >
                Channels
              </span>
            </h1>
            <p className="text-sm text-zinc-500 max-w-lg leading-relaxed">
              Save any website as a channel. Browse sections, navigate pages, and play streams
              instantly — zero ads, zero storage.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setIsSitesBarCollapsed(!isSitesBarCollapsed)}
              title={isSitesBarCollapsed ? "Show Saved Channels" : "Hide Saved Channels for clean Search & Watch mode"}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
                isSitesBarCollapsed
                  ? 'bg-purple-600/25 border border-purple-500/40 text-purple-300 hover:bg-purple-600/35 shadow-md'
                  : 'bg-white/[0.06] border border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              {isSitesBarCollapsed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isSitesBarCollapsed ? `Show Channels (${sites.length})` : 'Hide Channels'}</span>
            </button>

            <button
              onClick={() => setCardLayout(cardLayout === 'compact' ? 'vertical' : 'compact')}
              title={`Card Layout: ${cardLayout === 'compact' ? 'Compact 16:9 Cards' : 'Vertical Poster Cards'}`}
              className="px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 bg-white/[0.06] border border-white/10 text-zinc-400 hover:text-white transition-all"
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{cardLayout === 'compact' ? 'Compact' : 'Poster'}</span>
            </button>

            <button
              onClick={() => setUseProxy(!useProxy)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
                useProxy
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'bg-white/[0.06] border border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{useProxy ? 'CORS Bypass: ON' : 'Direct'}</span>
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="group relative px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-purple-600/25 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span>Add Channel</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Search + Channel Filter Bar ──────────────────────────── */}
      <div className="mb-8 space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-600 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search across all channels, video titles, and formats..."
            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-2xl pl-11 pr-10 py-3.5 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-purple-500/50 transition-all backdrop-blur-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Compact Banner when Channels are Hidden but a specific channel is filtered */}
        {isSitesBarCollapsed && selectedSiteId && currentSite && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-purple-950/25 border border-purple-500/25 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Watching Channel:</span>
              <span className="font-bold text-purple-300">{currentSite.nickname}</span>
              <span className="text-zinc-600 font-mono text-[11px]">({activeVideoList.length} videos)</span>
            </div>
            <button
              onClick={() => handleSelectSite(null)}
              className="text-purple-400 hover:text-purple-300 text-xs font-semibold underline underline-offset-2"
            >
              Show All Channels
            </button>
          </div>
        )}

        {/* Channel Pills (Shown only when NOT collapsed) */}
        {!isSitesBarCollapsed && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => handleSelectSite(null)}
              className={`group flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                selectedSiteId === null
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                  : 'bg-white/[0.04] text-zinc-500 hover:text-zinc-200 border border-white/[0.06] hover:bg-white/[0.07]'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>All Channels</span>
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-black/40 text-zinc-400">
                {videos.length}
              </span>
            </button>

            {sites.map((site) => (
              <div
                key={site.id}
                className={`group flex items-center rounded-2xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                  selectedSiteId === site.id
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-white/[0.04] text-zinc-400 hover:text-zinc-200 border border-white/[0.06] hover:bg-white/[0.07]'
                }`}
              >
                <button
                  onClick={() => handleSelectSite(selectedSiteId === site.id ? null : site.id)}
                  className="flex items-center gap-2 pl-3.5 pr-2 py-2"
                >
                  <Signal className="w-3 h-3" />
                  <span>{site.nickname}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-black/40 text-zinc-400 group-hover:text-zinc-300">
                    {site.video_count}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSite(site.id, site.nickname);
                  }}
                  title={`Remove ${site.nickname}`}
                  className="pr-2.5 pl-1 py-2 text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Selected Channel Panel (Shown only when NOT collapsed and currentSite exists) ─── */}
      {!isSitesBarCollapsed && currentSite && (
        <div className="mb-8 p-5 rounded-2xl bg-purple-950/10 border border-purple-500/15 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                <Tv className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">{currentSite.nickname}</h2>
                <a
                  href={currentSite.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-zinc-600 hover:text-indigo-400 font-mono transition-colors truncate max-w-xs inline-block"
                >
                  {currentSite.url}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRefreshSite(currentSite.id, currentSite.nickname)}
                disabled={isRefreshing === currentSite.id}
                className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.07] text-zinc-400 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing === currentSite.id ? 'animate-spin text-purple-400' : ''}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => handleDeleteSite(currentSite.id, currentSite.nickname)}
                className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-red-900/30 border border-white/[0.07] hover:border-red-500/30 text-zinc-500 hover:text-red-400 text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </div>
          </div>

          {/* Section Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-zinc-700 whitespace-nowrap pr-2 flex-shrink-0 flex items-center gap-1">
              <Layers className="w-3 h-3 text-purple-500" />
              <span>Browse</span>
            </span>
            <div className="w-px h-3 bg-white/10 flex-shrink-0" />

            <button
              onClick={() => handleSelectSection(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                activeSectionUrl === null
                  ? 'bg-purple-600 text-white'
                  : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05]'
              }`}
            >
              Homepage
            </button>

            {currentSite.sections && currentSite.sections.length > 0 ? (
              currentSite.sections
                .filter((s) => s.id !== 'home')
                .map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => handleSelectSection(sec.url)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      activeSectionUrl === sec.url
                        ? 'bg-purple-600 text-white'
                        : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05]'
                    }`}
                  >
                    {sec.name}
                  </button>
                ))
            ) : (
              <span className="text-[11px] text-zinc-700 italic pl-1">
                No sections detected — browse via pages below
              </span>
            )}
          </div>
        </div>
      )}

      {/* ─── Grid Header ─────────────────────────────────────────── */}
      <div ref={videoGridRef} className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Film className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">
            {selectedSiteId
              ? `${currentSite?.nickname || 'Channel'} — Page ${currentPage}`
              : 'All Indexed Streams'}
          </h2>
          <span className="text-xs text-zinc-700 font-mono">({filteredVideos.length})</span>
        </div>
        {isBrowsingPage && (
          <div className="flex items-center gap-2 text-xs text-purple-400 font-mono">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Loading streams...</span>
          </div>
        )}
      </div>

      {/* ─── Video Grid ──────────────────────────────────────────── */}
      {isLoading || isBrowsingPage ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={`${cardLayout === 'compact' ? 'aspect-video' : 'aspect-[3/4]'} rounded-2xl bg-white/[0.04] border border-white/[0.05] animate-pulse`} />
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-5">
            <Globe className="w-7 h-7 text-purple-500/50" />
          </div>
          <h3 className="text-base font-bold text-white mb-2">
            {searchQuery ? 'No Matching Streams' : sites.length === 0 ? 'No Channels Yet' : 'No Videos Here'}
          </h3>
          <p className="text-xs text-zinc-600 max-w-sm mx-auto mb-6 leading-relaxed">
            {searchQuery
              ? `No stream matched "${searchQuery}".`
              : sites.length === 0
              ? 'Add your first website channel to start browsing ad-free.'
              : 'Try another section or page, or refresh the channel.'}
          </p>
          {sites.length === 0 ? (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Channel</span>
            </button>
          ) : searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="px-5 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.09] border border-white/[0.08] text-white text-xs font-semibold transition-all"
            >
              Clear Search
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3.5">
          {filteredVideos.map((vid) => {
            const poster = vid.poster_url;
            const fmt = formatColor(vid.format);
            const isHovered = hoveredId === vid.id;

            return (
              <div
                key={vid.id}
                onMouseEnter={() => setHoveredId(vid.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="group relative rounded-2xl overflow-hidden border border-white/[0.07] bg-zinc-950 cursor-pointer"
                style={{
                  transform: isHovered ? 'translateY(-3px) scale(1.01)' : 'none',
                  boxShadow: isHovered
                    ? '0 16px 32px rgba(0,0,0,0.6), 0 0 25px rgba(168,85,247,0.12)'
                    : 'none',
                  transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s cubic-bezier(0.16,1,0.3,1)',
                  borderColor: isHovered ? 'rgba(168,85,247,0.25)' : undefined,
                }}
                onClick={() => setSelectedVideo(vid)}
              >
                {/* Poster */}
                <div className={`relative ${cardLayout === 'compact' ? 'aspect-video' : 'aspect-[3/4]'} overflow-hidden bg-zinc-900`}>
                  {poster ? (
                    <img
                      src={poster}
                      alt={vid.title}
                      loading="lazy"
                      className="w-full h-full object-cover object-top"
                      style={{
                        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1)',
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-purple-950/80 via-zinc-900 to-zinc-950 flex items-center justify-center">
                      <Film className="w-7 h-7 text-purple-500/30" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                  {/* Quality & Format Badges */}
                  <div className="absolute top-2 left-2 z-10 flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase font-mono tracking-wider bg-purple-500/30 border border-purple-500/40 text-purple-200 shadow-md backdrop-blur-md">
                      {vid.quality || (vid.stream_url.includes('1080') ? '1080p FHD' : vid.stream_url.includes('720') ? '720p HD' : vid.format.split(' ')[0])}
                    </span>
                  </div>

                  {vid.site_nickname && !selectedSiteId && (
                    <div className="absolute top-2 right-2 z-10">
                      <span className="px-1.5 py-0.5 rounded-md bg-purple-600/90 text-[9px] font-bold text-white truncate max-w-[75px] sm:max-w-[105px] block shadow-md">
                        {vid.site_nickname}
                      </span>
                    </div>
                  )}

                  {/* Play overlay */}
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ opacity: isHovered ? 1 : 0, transition: 'opacity 0.2s ease' }}
                  >
                    <div className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                      <Play className="w-5 h-5 fill-white text-white translate-x-0.5" />
                    </div>
                  </div>

                  {/* Title */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-2.5 z-10 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
                    <h3
                      className="text-[11px] sm:text-xs font-bold text-white leading-tight"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {vid.title}
                    </h3>
                  </div>
                </div>

                {/* Action bar */}
                <div className="px-2.5 py-2 flex items-center gap-1.5 bg-zinc-950" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedVideo(vid); }}
                    className="flex-1 py-1 px-2 rounded-xl bg-purple-600/90 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>Play</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopyLink(vid.id, vid.stream_url); }}
                    title="Copy stream link"
                    className="p-1 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] text-zinc-400 hover:text-white transition-all"
                  >
                    {copiedId === vid.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                  <a
                    href={vid.stream_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open source stream"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] text-zinc-400 hover:text-white transition-all"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Pagination ──────────────────────────────────────────── */}
      {selectedSiteId && currentSite && !isLoading && (
        <div className="mt-8 mb-12 flex items-center justify-center gap-6">
          {currentPage > 1 && (
            <button
              onClick={() => handleNavigatePage(currentPage - 1)}
              disabled={isBrowsingPage}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="text-4xl font-black text-white font-mono tabular-nums">{currentPage}</span>
            <span className="text-zinc-700 text-xs font-mono">page</span>
          </div>

          <button
            onClick={() => handleNavigatePage(currentPage + 1)}
            disabled={isBrowsingPage || !hasNextPage}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all shadow-lg shadow-purple-600/25 active:scale-95 disabled:opacity-40"
          >
            {isBrowsingPage ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Next</span>}
            {!isBrowsingPage && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* ─── Video Player ────────────────────────────────────────── */}
      {selectedVideo && playerMediaItem && (
        <VideoPlayer media={playerMediaItem} onClose={() => setSelectedVideo(null)} />
      )}

      {/* ─── Add Channel Modal ───────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div
            className="w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl"
            style={{
              background: 'rgba(9, 9, 11, 0.95)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(168,85,247,0.15)',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add Website Channel</h3>
                  <p className="text-xs text-zinc-600">Index & stream any site ad-free</p>
                </div>
              </div>
              <button
                onClick={() => { setIsAddModalOpen(false); setAddError(null); }}
                className="p-2 rounded-xl text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2">Channel Nickname</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DesiHub, XNXX, My Channel..."
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-purple-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-2">Website URL</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. desihub.sh, xnxx.health, or https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-700 focus:outline-none focus:border-purple-500/50 transition-all font-mono"
                />
              </div>

              {addError && (
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-red-950/30 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300 leading-relaxed">{addError}</p>
                </div>
              )}

              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Zero-Storage Promise</span>
                </p>
                <p className="text-[11px] text-zinc-600 leading-relaxed">
                  No video files are downloaded. Only stream URLs, sections & thumbnails are indexed for instant ad-free playback.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setAddError(null); }}
                  className="flex-1 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.07] text-white text-sm font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-600/25 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Scanning...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Scan & Save</span>
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
