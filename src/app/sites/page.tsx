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
import { getHighestQualityRawUrl } from '@/lib/extractor';

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
  duration?: string | null;
  mime_type: string;
  source?: string | null;
  created_at: string;
  site_nickname?: string;
}

function getVideoTime(duration?: string | null, id?: string): string {
  if (duration && duration.trim()) {
    const isoMatch = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
    if (isoMatch) {
      const h = isoMatch[1] ? `${isoMatch[1]}:` : '';
      const m = (isoMatch[2] || '0').padStart(h ? 2 : 1, '0');
      const s = (isoMatch[3] || '0').padStart(2, '0');
      return `${h}${m}:${s}`;
    }
    if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(duration.trim())) {
      return duration.trim();
    }
  }

  if (id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    }
    const mins = (hash % 28) + 4;
    const secs = (hash % 59);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return '10:00';
}

function cleanChannelName(nickname?: string | null, url?: string): string {
  if (!nickname) return 'Channel';
  let cleaned = nickname.replace(/^\d+[\s:.-]*/, '').trim();
  if (!cleaned && url) {
    try {
      cleaned = new URL(url).hostname.replace(/^www\./, '').split('.')[0];
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    } catch {
      cleaned = 'Channel';
    }
  }
  return cleaned || nickname;
}

function cleanDisplayTitle(title: string): string {
  if (!title) return 'Video Stream';
  let t = title.trim();
  t = t.replace(/^thumbnail\s+(?:for\s+)?/i, '');
  t = t.replace(/\s+on\s+[a-z0-9.-]+\.[a-z]{2,}(?:,.*)?$/i, '');
  t = t.replace(/\s+all\s+your\s+.*needs.*$/i, '');
  return t.trim() || 'Video Stream';
}

function VideoPoster({ poster, title }: { poster?: string | null; title: string }) {
  const [hasError, setHasError] = useState(false);
  const [isVideo, setIsVideo] = useState(() => {
    if (!poster) return false;
    const lower = poster.toLowerCase();
    return lower.includes('.webm') || lower.includes('myspacecat.pictures');
  });

  if (!poster || hasError) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-purple-950/80 via-zinc-900 to-zinc-950 flex items-center justify-center">
        <Film className="w-7 h-7 text-purple-500/30" />
      </div>
    );
  }

  if (isVideo) {
    return (
      <video
        src={poster}
        muted
        autoPlay
        loop
        playsInline
        preload="metadata"
        className="w-full h-full object-cover object-top pointer-events-none"
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <img
      src={poster}
      alt=""
      aria-label={title}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (poster.includes('myspacecat.pictures') || poster.includes('webm')) {
          setIsVideo(true);
        } else {
          setHasError(true);
        }
      }}
      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
    />
  );
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
  const [isUnifiedSearching, setIsUnifiedSearching] = useState(false);
  const [unifiedSearchResults, setUnifiedSearchResults] = useState<SavedSiteVideo[] | null>(null);

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

  const browseSectionPage = useCallback(
    async (site: SavedSite, sectionUrl: string, page: number, query?: string) => {
      const q = (query || '').trim();
      const cacheKey = q
        ? `${site.id}_search_${q.toLowerCase()}_${page}`
        : `${site.id}_${sectionUrl}_${page}`;

      if (!q && sectionVideosMap[cacheKey] && sectionVideosMap[cacheKey].length > 0) return;

      try {
        setIsBrowsingPage(true);
        const res = await fetch(`/api/sites/${site.id}/browse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sectionUrl, page, query: q }),
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

          if (q) {
            if (items.length > 0) {
              toastSuccess('Live Search Found', `Extracted ${items.length} streams for "${q}".`);
            } else {
              toastInfo('No Live Streams', `No streamable videos found on ${cleanChannelName(site.nickname)} for "${q}".`);
            }
          }

          if (data.sections && data.sections.length > 0) {
            setSites((prev) =>
              prev.map((s) => (s.id === site.id ? { ...s, sections: data.sections } : s))
            );
          }

          // Auto-move: if homepage has 0 videos, automatically switch to first valid candidate section
          if (items.length === 0 && !q && (!sectionUrl || sectionUrl === site.url)) {
            const candidate = (data.sections || site.sections || []).find(
              (s: any) =>
                s.id !== 'home' &&
                !s.url.includes('#') &&
                !s.name.toLowerCase().includes('terms') &&
                !s.name.toLowerCase().includes('comment')
            );
            if (candidate && candidate.url !== sectionUrl) {
              setActiveSectionUrl(candidate.url);
              browseSectionPage(site, candidate.url, 1);
            }
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
    [sectionVideosMap, toastError, toastSuccess, toastInfo]
  );

  const handleSelectSite = useCallback(
    (siteId: string | null) => {
      setSelectedSiteId(siteId);
      setActiveSectionUrl(null);
      setCurrentPage(1);
      setHasNextPage(true);
      setSearchQuery('');
      setUnifiedSearchResults(null);

      if (siteId) {
        const site = sites.find((s) => s.id === siteId);
        if (site) {
          const siteVideos = videos.filter((v) => v.site_id === site.id);
          // If site homepage has 0 videos, automatically move to first candidate video section
          if (siteVideos.length === 0 || (site.video_count || 0) === 0) {
            const candidate = (site.sections || []).find(
              (s) =>
                s.id !== 'home' &&
                !s.url.includes('#') &&
                !s.name.toLowerCase().includes('terms') &&
                !s.name.toLowerCase().includes('comment')
            );
            if (candidate) {
              setActiveSectionUrl(candidate.url);
              browseSectionPage(site, candidate.url, 1);
            }
          }
        }
      }
    },
    [sites, videos, browseSectionPage]
  );

  const currentSite = useMemo(() => {
    if (!selectedSiteId) return null;
    return sites.find((s) => s.id === selectedSiteId) || null;
  }, [sites, selectedSiteId]);

  const handleUnifiedOnlineSearch = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q || isUnifiedSearching) return;
      try {
        setIsUnifiedSearching(true);
        const res = await fetch(`/api/sites/all-videos?search=${encodeURIComponent(q)}&online=true`);
        if (res.ok) {
          const data = await res.json();
          const items: SavedSiteVideo[] = (data.videos || []).map((v: any) => ({
            id: v.id,
            site_id: v.site_id,
            title: v.title,
            stream_url: v.stream_url,
            proxy_stream_url: v.proxy_stream_url,
            poster_url: v.poster_url,
            format: v.format,
            mime_type: v.mime_type,
            source: v.source,
            created_at: v.created_at || new Date().toISOString(),
            site_nickname: v.site_nickname,
          }));
          setUnifiedSearchResults(items);
          if (items.length > 0) {
            toastSuccess('Online Search Found', `Discovered ${items.length} streams across channels for "${q}".`);
          } else {
            toastInfo('No Online Results', `No stream matches found across channels for "${q}".`);
          }
        } else {
          toastError('Search Failed', 'Failed to search channels online.');
        }
      } catch (err: any) {
        toastError('Search Error', err.message || 'Error searching channels');
      } finally {
        setIsUnifiedSearching(false);
      }
    },
    [isUnifiedSearching, toastSuccess, toastInfo, toastError]
  );

  const handleSelectSection = (sectionUrl: string | null) => {
    if (!currentSite) return;
    setActiveSectionUrl(sectionUrl);
    setCurrentPage(1);
    setHasNextPage(true);
    setSearchQuery('');
    if (sectionUrl) {
      browseSectionPage(currentSite, sectionUrl, 1);
    }
    videoGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleNavigatePage = async (newPage: number) => {
    if (!currentSite || newPage < 1 || isBrowsingPage) return;
    setCurrentPage(newPage);
    const targetSection = activeSectionUrl || currentSite.url;
    await browseSectionPage(currentSite, targetSection, newPage, searchQuery.trim() || undefined);
    videoGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleLiveSearchOnSite = async () => {
    if (!currentSite || !searchQuery.trim() || isBrowsingPage) return;
    setCurrentPage(1);
    const targetSection = activeSectionUrl || currentSite.url;
    await browseSectionPage(currentSite, targetSection, 1, searchQuery.trim());
    videoGridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Auto-trigger live site search when typing in a selected channel
  useEffect(() => {
    if (!selectedSiteId || !currentSite) return;
    const q = searchQuery.trim();
    if (!q || q.length < 2 || isBrowsingPage) return;

    const searchKey = `${currentSite.id}_search_${q.toLowerCase()}_1`;
    if (sectionVideosMap[searchKey] !== undefined) return;

    const timer = setTimeout(() => {
      const targetSection = activeSectionUrl || currentSite.url;
      browseSectionPage(currentSite, targetSection, 1, q);
    }, 750);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedSiteId, currentSite, activeSectionUrl, browseSectionPage, isBrowsingPage, sectionVideosMap]);

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

  // Total indexed video count across all saved channels
  const totalIndexedCount = useMemo(() => {
    return sites.reduce((sum, s) => sum + (s.video_count || 0), 0);
  }, [sites]);

  // Clean sections strictly matching the current site's root domain
  const siteSections = useMemo(() => {
    if (!currentSite?.sections || currentSite.sections.length === 0) return [];
    try {
      const baseHost = new URL(currentSite.url).hostname.toLowerCase().replace(/^www\./, '');
      return currentSite.sections.filter((s) => {
        if (s.id === 'home') return true;
        try {
          const secHost = new URL(s.url).hostname.toLowerCase().replace(/^www\./, '');
          return secHost === baseHost || secHost.endsWith('.' + baseHost);
        } catch {
          return false;
        }
      });
    } catch {
      return currentSite.sections;
    }
  }, [currentSite]);

  // Active videos for the current channel:
  // - If live search was performed: return live search results
  // - If a specific section is chosen: return that section's videos (or empty while loading/empty, NEVER leak homepage videos)
  // - If page > 1: return that page's videos
  // - Otherwise: return channel's default indexed videos
  const activeVideoList = useMemo(() => {
    if (!currentSite) return videos;

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const searchKey = `${currentSite.id}_search_${q}_${currentPage}`;
      if (sectionVideosMap[searchKey] !== undefined) {
        return sectionVideosMap[searchKey];
      }
    }

    if (activeSectionUrl) {
      const cacheKey = `${currentSite.id}_${activeSectionUrl}_${currentPage}`;
      if (sectionVideosMap[cacheKey] !== undefined) {
        return sectionVideosMap[cacheKey];
      }
      return []; // Real-time section is loading or returned 0: do not show homepage videos!
    }

    if (currentPage > 1) {
      const targetUrl = currentSite.url;
      const cacheKey = `${currentSite.id}_${targetUrl}_${currentPage}`;
      if (sectionVideosMap[cacheKey] !== undefined) {
        return sectionVideosMap[cacheKey];
      }
      return [];
    }

    return videos.filter((v) => v.site_id === currentSite.id);
  }, [currentSite, searchQuery, activeSectionUrl, currentPage, sectionVideosMap, videos]);

  // Search Filtering:
  // - If a specific channel is selected: ONLY search within that channel
  // - If All Channels is selected: search across all channels
  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // 1. Specific Channel Selected -> SEARCH ONLY IN THIS CHANNEL
    if (selectedSiteId && currentSite) {
      const searchKey = `${currentSite.id}_search_${q}_${currentPage}`;
      if (q && sectionVideosMap[searchKey] !== undefined) {
        return sectionVideosMap[searchKey];
      }

      const siteVideos = activeVideoList.filter((v) => v.site_id === currentSite.id);
      if (!q) return siteVideos;
      return siteVideos.filter((v) => {
        const titleMatch = v.title.toLowerCase().includes(q);
        const formatMatch = v.format.toLowerCase().includes(q);
        return titleMatch || formatMatch;
      });
    }

    // 2. All Channels Selected -> SEARCH ACROSS ALL SITES
    if (unifiedSearchResults && unifiedSearchResults.length > 0) {
      const seen = new Set<string>();
      const combined: SavedSiteVideo[] = [];
      for (const v of unifiedSearchResults) {
        const key = v.stream_url || v.id;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(v);
        }
      }
      for (const v of videos) {
        const titleMatch = v.title.toLowerCase().includes(q);
        const nicknameMatch = v.site_nickname ? v.site_nickname.toLowerCase().includes(q) : false;
        const formatMatch = v.format.toLowerCase().includes(q);
        if (titleMatch || nicknameMatch || formatMatch) {
          const key = v.stream_url || v.id;
          if (!seen.has(key)) {
            seen.add(key);
            combined.push(v);
          }
        }
      }
      return combined;
    }

    if (!q) return videos;
    return videos.filter((v) => {
      const titleMatch = v.title.toLowerCase().includes(q);
      const nicknameMatch = v.site_nickname ? v.site_nickname.toLowerCase().includes(q) : false;
      const formatMatch = v.format.toLowerCase().includes(q);
      return titleMatch || nicknameMatch || formatMatch;
    });
  }, [selectedSiteId, currentSite, activeVideoList, videos, searchQuery, currentPage, sectionVideosMap, unifiedSearchResults]);

  // Opens direct stream URL in a new tab with NOTHING ELSE for 0 buffering
  const openInPlayerTab = useCallback((vid: SavedSiteVideo) => {
    // When CORS Bypass / proxy is enabled (useProxy is true), open the proxy URL so that:
    // 1. ISP DNS/SNI blocking is bypassed (runs through local backend)
    // 2. Expired tokens are auto-healed transparently
    // 3. Browser opens a native, clean black tab with 0 buffering!
    const target = (useProxy && vid.proxy_stream_url) ? vid.proxy_stream_url : getHighestQualityRawUrl(vid.stream_url);
    if (target) {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
  }, [useProxy]);

  // Shares/copies the direct stream URL for zero buffering
  const handleSharePlayerLink = useCallback((vid: SavedSiteVideo) => {
    const stream = (useProxy && vid.proxy_stream_url)
      ? `${window.location.origin}${vid.proxy_stream_url}`
      : getHighestQualityRawUrl(vid.stream_url || '');
    if (stream) {
      navigator.clipboard.writeText(stream);
      setCopiedId(vid.id);
      toastSuccess('Stream URL Copied!', useProxy ? 'Stream link copied (bypasses ISP block).' : 'Direct video URL copied for 0 buffering.');
      setTimeout(() => setCopiedId(null), 2500);
    }
  }, [useProxy, toastSuccess]);

  const handleCopyDirectStream = useCallback((vid: SavedSiteVideo) => {
    const stream = (useProxy && vid.proxy_stream_url) ? vid.proxy_stream_url : vid.stream_url;
    navigator.clipboard.writeText(stream);
    setCopiedId(vid.id);
    toastSuccess('Stream URL Copied!', 'Direct media stream URL copied to clipboard.');
    setTimeout(() => setCopiedId(null), 2500);
  }, [useProxy, toastSuccess]);

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
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value.trim()) {
                setUnifiedSearchResults(null);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (selectedSiteId && currentSite && searchQuery.trim()) {
                  handleLiveSearchOnSite();
                } else if (!selectedSiteId && searchQuery.trim()) {
                  handleUnifiedOnlineSearch(searchQuery.trim());
                }
              }
            }}
            placeholder={
              selectedSiteId && currentSite
                ? `Search "${cleanChannelName(currentSite.nickname, currentSite.url)}" (press Enter for live site search)...`
                : `Search across all channels (press Enter to search online across sites)...`
            }
            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-2xl pl-11 pr-36 py-3.5 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-purple-500/50 transition-all backdrop-blur-sm"
          />

          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {/* Single Channel Search button */}
            {selectedSiteId && currentSite && searchQuery.trim() && (
              <button
                onClick={handleLiveSearchOnSite}
                disabled={isBrowsingPage}
                title={`Search "${searchQuery}" live on ${cleanChannelName(currentSite.nickname, currentSite.url)}`}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition-all active:scale-95 disabled:opacity-50"
              >
                {isBrowsingPage ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5 fill-white" />
                )}
                <span className="hidden sm:inline">Search Site</span>
              </button>
            )}

            {/* All Channels Unified Online Search button */}
            {!selectedSiteId && searchQuery.trim() && (
              <button
                onClick={() => handleUnifiedOnlineSearch(searchQuery.trim())}
                disabled={isUnifiedSearching}
                title={`Search "${searchQuery}" online across all channels`}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-purple-600/30 transition-all active:scale-95 disabled:opacity-50"
              >
                {isUnifiedSearching ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                )}
                <span className="hidden sm:inline">Search Online</span>
              </button>
            )}

            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setUnifiedSearchResults(null);
                }}
                className="p-1 text-zinc-600 hover:text-zinc-300 transition-colors"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Compact Banner when Channels are Hidden but a specific channel is filtered */}
        {isSitesBarCollapsed && selectedSiteId && currentSite && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-purple-950/25 border border-purple-500/25 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Watching Channel:</span>
              <span className="font-bold text-purple-300">{cleanChannelName(currentSite.nickname, currentSite.url)}</span>
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
                {totalIndexedCount || videos.length}
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
                  <span>{cleanChannelName(site.nickname, site.url)}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-black/40 text-zinc-400 group-hover:text-zinc-300">
                    {site.video_count}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSite(site.id, site.nickname);
                  }}
                  title={`Remove ${cleanChannelName(site.nickname, site.url)}`}
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
                <h2 className="text-sm font-bold text-white">{cleanChannelName(currentSite.nickname, currentSite.url)}</h2>
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

            {siteSections && siteSections.length > 0 ? (
              siteSections
                .filter((s) => s.id !== 'home' && !s.url.includes('#') && !s.name.toLowerCase().includes('terms') && !/^\d+$/.test(s.name))
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
              ? searchQuery
                ? `${currentSite?.nickname} — Search "${searchQuery}"`
                : `${currentSite?.nickname} — Page ${currentPage}`
              : searchQuery
              ? `All Channels — Search "${searchQuery}"`
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
      {isLoading || isBrowsingPage || isUnifiedSearching ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3.5 items-start">
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
            {searchQuery
              ? selectedSiteId
                ? `No matching videos in "${cleanChannelName(currentSite?.nickname, currentSite?.url)}"`
                : `No streams match "${searchQuery}"`
              : sites.length === 0
              ? 'No Channels Yet'
              : 'No Videos Here'}
          </h3>
          <p className="text-xs text-zinc-600 max-w-sm mx-auto mb-6 leading-relaxed">
            {searchQuery
              ? selectedSiteId
                ? `No videos inside "${cleanChannelName(currentSite?.nickname, currentSite?.url)}" matched "${searchQuery}". Press Enter to search this site live or search across All Channels.`
                : `No streams currently match "${searchQuery}". Click "Search Online" to scan all channels in real time.`
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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setUnifiedSearchResults(null);
                }}
                className="px-5 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.09] border border-white/[0.08] text-white text-xs font-semibold transition-all"
              >
                Clear Search
              </button>
              {!selectedSiteId ? (
                <button
                  onClick={() => handleUnifiedOnlineSearch(searchQuery.trim())}
                  disabled={isUnifiedSearching}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-lg shadow-purple-600/30"
                >
                  {isUnifiedSearching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-yellow-300" />}
                  <span>Search Online Across All Channels</span>
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                  <button
                    onClick={handleLiveSearchOnSite}
                    disabled={isBrowsingPage}
                    className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-lg shadow-purple-600/30 active:scale-95 disabled:opacity-50"
                  >
                    {isBrowsingPage ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 fill-white" />}
                    <span>Search "{cleanChannelName(currentSite?.nickname, currentSite?.url)}" Live</span>
                  </button>
                  <button
                    onClick={() => handleSelectSite(null)}
                    className="px-4 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.09] border border-white/[0.08] text-zinc-300 text-xs font-semibold transition-all inline-flex items-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Search across All Channels</span>
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3.5 items-start">
          {filteredVideos.map((vid) => {
            const poster = vid.poster_url;
            const isHovered = hoveredId === vid.id;
            const cleanTitle = cleanDisplayTitle(vid.title);
            const cleanNick = cleanChannelName(vid.site_nickname);

            return (
              <div
                key={vid.id}
                onMouseEnter={() => setHoveredId(vid.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => openInPlayerTab(vid)}
                className="group relative rounded-2xl overflow-hidden border border-white/[0.08] bg-zinc-950 cursor-pointer shadow-md hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 w-full"
                style={{
                  transform: isHovered ? 'translateY(-2px)' : 'none',
                }}
              >
                {/* Poster Container */}
                <div className={`relative ${cardLayout === 'compact' ? 'aspect-video' : 'aspect-[3/4]'} overflow-hidden bg-zinc-900`}>
                  <VideoPoster poster={poster} title={cleanTitle} />

                  {/* Video Time Badge without hover */}
                  <div className="absolute bottom-2 right-2 z-10 opacity-70 group-hover:opacity-0 transition-opacity duration-200 pointer-events-none">
                    <span className="px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono font-medium text-white shadow backdrop-blur-sm">
                      {getVideoTime(vid.duration, vid.id)}
                    </span>
                  </div>

                  {/* Channel Nickname Pill on Top Left */}
                  <div className="absolute top-2 left-2 z-10 pointer-events-none">
                    <span className="px-1.5 py-0.5 rounded bg-black/75 border border-white/10 text-[9px] font-mono font-bold text-purple-300 backdrop-blur-sm">
                      {cleanNick}
                    </span>
                  </div>

                  {/* Hover Overlay: Play Raw URL (0 Buffering), In-App Player, Copy URL */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-2 z-20">
                    {/* Top Row in Hover: Quick Actions */}
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-mono text-zinc-300 bg-black/60 px-1.5 py-0.5 rounded border border-white/10">
                        {vid.format.toUpperCase()}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSharePlayerLink(vid);
                          }}
                          title="Copy Raw Stream URL (0 Buffering)"
                          className="p-1 rounded-md bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition-colors"
                        >
                          {copiedId === vid.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVideo(vid);
                          }}
                          title="Play in Ad-Free Vault Player"
                          className="p-1 rounded-md bg-white/10 hover:bg-purple-600 text-zinc-300 hover:text-white transition-colors"
                        >
                          <Tv className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Center: Play Raw URL (0 Buffering in New Tab) */}
                    <div className="self-center">
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          openInPlayerTab(vid);
                        }}
                        title="Play raw video directly in new tab (0 buffering)"
                        className="w-8 h-8 rounded-full bg-purple-600/90 group-hover:bg-purple-500 text-white flex items-center justify-center shadow-lg shadow-purple-600/50 transform group-hover:scale-110 active:scale-95 transition-all cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-white text-white translate-x-0.5" />
                      </div>
                    </div>

                    {/* Bottom: Title & Action Buttons */}
                    <div>
                      <h3
                        className="text-[11px] font-bold text-white leading-tight line-clamp-1 drop-shadow mb-1.5"
                        title={cleanTitle}
                      >
                        {cleanTitle}
                      </h3>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openInPlayerTab(vid);
                          }}
                          title="Play raw video directly (0 buffering, no website UI)"
                          className="flex-1 py-1 px-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold flex items-center justify-center gap-1 shadow-md shadow-purple-600/40 transition-all active:scale-95"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span>Raw (0 Buff)</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVideo(vid);
                          }}
                          title="Play in Ad-Free Vault Player"
                          className="py-1 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-semibold transition-all active:scale-95"
                        >
                          App
                        </button>
                      </div>
                    </div>
                  </div>
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
