'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { VideoPlayer } from '@/components/viewer/VideoPlayer';
import { MediaItem } from '@/types';
import {
  Link as LinkIcon,
  Play,
  Film,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  Download,
  AlertCircle,
  Loader2,
  X,
  ExternalLink,
  Clipboard,
  Tv,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Globe,
  Layers,
  ArrowRight,
  Search,
  Maximize2,
  Volume2,
} from 'lucide-react';
import { buildPagedUrl } from '@/lib/extractor';

export interface ExtractedSection {
  id: string;
  name: string;
  url: string;
}

export interface ExtractedVideo {
  id: string;
  title: string;
  streamUrl: string;
  proxyStreamUrl: string;
  posterUrl?: string;
  quality?: string;
  mimeType: string;
  format: string;
  source: 'direct' | 'html5' | 'opengraph' | 'jsonld' | 'script' | 'link' | 'channel-card' | 'iframe';
}

export interface ExtractionResult {
  pageTitle: string;
  pageUrl: string;
  posterUrl?: string;
  count: number;
  videos: ExtractedVideo[];
  sections?: ExtractedSection[];
}

interface SavedSiteChip {
  id: string;
  nickname: string;
  url: string;
  video_count: number;
}

// ─── Format Badge Colors ────────────────────────────────────────────
function formatColor(format: string) {
  const f = format.toUpperCase();
  if (f.includes('M3U8') || f.includes('HLS')) return { bg: 'bg-violet-500/20', border: 'border-violet-500/40', text: 'text-violet-300' };
  if (f.includes('MP4')) return { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-300' };
  if (f.includes('WEBM')) return { bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-300' };
  return { bg: 'bg-zinc-700/40', border: 'border-zinc-600/40', text: 'text-zinc-300' };
}

export default function ExtractorPage() {
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [useProxy, setUseProxy] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedSites, setSavedSites] = useState<SavedSiteChip[]>([]);
  const [activeSectionUrl, setActiveSectionUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isPaginating, setIsPaginating] = useState<boolean>(false);
  const [selectedVideo, setSelectedVideo] = useState<ExtractedVideo | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedInput, setFocusedInput] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  // Custom cursor tracking
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

  useEffect(() => {
    fetch('/api/sites')
      .then((res) => res.json())
      .then((data) => { if (data.sites) setSavedSites(data.sites); })
      .catch(() => {});
    inputRef.current?.focus();
  }, []);

  const handleUrlInputChange = (val: string) => {
    setUrlInput(val);
    if (result && val.trim() !== result.pageUrl) {
      setResult(null);
      setErrorMessage(null);
      setActiveSectionUrl(null);
      setCurrentPage(1);
    }
  };

  const handleExtract = async (overrideUrl?: string, pageNumber: number = 1) => {
    const rawTarget = (overrideUrl || urlInput).trim();
    if (!rawTarget) return;

    if (pageNumber === 1 && !overrideUrl) setResult(null);

    if (pageNumber > 1) setIsPaginating(true);
    else {
      setIsLoading(true);
      setResult(null);
    }
    setErrorMessage(null);
    setSearchQuery('');

    try {
      const targetUrl = pageNumber > 1 ? buildPagedUrl(rawTarget, pageNumber) : rawTarget;
      const res = await fetch('/api/tools/extract-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to extract video streams from this website');
        setResult(null);
      } else if (data.videos.length === 0) {
        setErrorMessage('No video streams found on this page. The site may require login or has bot protection.');
        setResult(data);
      } else {
        setResult(data);
        setCurrentPage(pageNumber);
        setErrorMessage(null);
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred while scanning');
      setResult(null);
    } finally {
      setIsLoading(false);
      setIsPaginating(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setResult(null);
        setUrlInput(text);
        setActiveSectionUrl(null);
        setCurrentPage(1);
        handleExtract(text, 1);
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  const handleSelectSection = (sectionUrl: string | null) => {
    setActiveSectionUrl(sectionUrl);
    setCurrentPage(1);
    const target = sectionUrl || urlInput;
    handleExtract(target, 1);
  };

  const handleNavigatePage = (newPage: number) => {
    if (newPage < 1 || isPaginating) return;
    const base = activeSectionUrl || result?.pageUrl || urlInput;
    handleExtract(base, newPage);
  };

  const handleCopy = (id: string, streamUrl: string) => {
    navigator.clipboard.writeText(streamUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredVideos = useMemo(() => {
    if (!result) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return result.videos;
    return result.videos.filter(v =>
      v.title.toLowerCase().includes(q) || v.format.toLowerCase().includes(q) || v.source.toLowerCase().includes(q)
    );
  }, [result, searchQuery]);

  const playerMediaItem: MediaItem | null = selectedVideo
    ? {
        id: selectedVideo.id,
        albumId: 'web-extracted',
        albumTitle: result?.pageTitle || 'Web Stream',
        folderPath: 'Ad-Free Player',
        fileHandle: selectedVideo.id,
        fileName: selectedVideo.title,
        mimeType: selectedVideo.mimeType || 'video/mp4',
        mediaType: 'VIDEO',
        size: 0,
        createdAt: new Date().toISOString(),
        thumbnailUrl: selectedVideo.posterUrl || result?.posterUrl,
        streamUrl: useProxy ? selectedVideo.proxyStreamUrl : selectedVideo.streamUrl,
        quality: selectedVideo.quality || (selectedVideo.streamUrl.includes('1080') ? '1080p FHD' : selectedVideo.streamUrl.includes('720') ? '720p HD' : undefined),
        isFavorite: false,
      }
    : null;

  return (
    <PageContainer>
      {/* ─── Ambient Cursor Glow ────────────────────────────────── */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed z-0 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.03]"
        style={{
          background: 'radial-gradient(circle, rgba(99,102,241,1) 0%, transparent 70%)',
          transition: 'left 0.15s ease-out, top 0.15s ease-out',
        }}
      />

      {/* ─── Page Header ────────────────────────────────────────── */}
      <div className="relative mb-10 sm:mb-14">
        {/* Eyebrow tag */}
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-semibold tracking-[0.15em] uppercase text-zinc-400">
            Zero-Storage · Ad-Free · Any Site
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none mb-3">
              Web Stream{' '}
              <span
                className="relative inline-block"
                style={{
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundImage: 'linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #38bdf8 100%)',
                  backgroundClip: 'text',
                }}
              >
                Extractor
              </span>
            </h1>
            <p className="text-sm text-zinc-500 max-w-lg leading-relaxed">
              Paste any website URL — we extract real video streams with full thumbnails.
              Watch instantly with zero ads, zero popups, zero pre-downloading.
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setUseProxy(!useProxy)}
              title="Toggle CORS bypass proxy"
              className={`group relative px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all duration-300 overflow-hidden ${
                useProxy
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                  : 'bg-white/[0.06] border border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.09]'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{useProxy ? 'CORS Bypass: ON' : 'Direct'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main Input Panel ───────────────────────────────────── */}
      <div className="relative mb-8">
        {/* Glow border effect */}
        <div
          className={`absolute inset-0 rounded-3xl transition-all duration-500 pointer-events-none ${
            focusedInput
              ? 'shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_0_40px_rgba(99,102,241,0.12)]'
              : 'shadow-[0_0_0_1px_rgba(255,255,255,0.07)]'
          }`}
        />
        <div className="relative bg-zinc-950/80 backdrop-blur-xl rounded-3xl p-5 sm:p-6 border border-white/[0.06]">
          <form
            onSubmit={(e) => { e.preventDefault(); handleExtract(undefined, 1); }}
            className="space-y-4"
          >
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              {/* URL Input */}
              <div className="relative flex-1">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                  <Globe className="w-4 h-4" />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={urlInput}
                  onChange={(e) => handleUrlInputChange(e.target.value)}
                  onFocus={() => setFocusedInput(true)}
                  onBlur={() => setFocusedInput(false)}
                  placeholder="Paste any website URL — e.g. xnxx.health, desihub.sh, or direct stream link..."
                  disabled={isLoading}
                  className="w-full bg-transparent border border-white/[0.08] rounded-2xl pl-11 pr-24 py-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 transition-all font-mono tracking-tight"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {urlInput ? (
                    <button
                      type="button"
                      onClick={() => { setUrlInput(''); setResult(null); setErrorMessage(null); setActiveSectionUrl(null); setCurrentPage(1); }}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePasteClipboard}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-zinc-400 hover:text-white bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] transition-all flex items-center gap-1"
                    >
                      <Clipboard className="w-3 h-3" />
                      <span>Paste</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Extract Button */}
              <button
                type="submit"
                disabled={isLoading || !urlInput.trim()}
                className="group relative px-7 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2.5 transition-all duration-200 shadow-lg shadow-indigo-600/30 overflow-hidden flex-shrink-0"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative flex items-center gap-2">
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Scanning...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      <span>Extract & Play</span>
                    </>
                  )}
                </span>
              </button>
            </div>

            {/* Saved Site Chips */}
            {savedSites.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none pt-1">
                <div className="flex items-center gap-1 text-[10px] font-bold tracking-[0.12em] uppercase text-zinc-600 whitespace-nowrap pr-2 flex-shrink-0">
                  <Tv className="w-3 h-3 text-indigo-500" />
                  <span>Channels</span>
                </div>
                <div className="w-px h-3 bg-white/10 flex-shrink-0" />
                {savedSites.map((site) => (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setUrlInput(site.url);
                      setActiveSectionUrl(null);
                      setCurrentPage(1);
                      handleExtract(site.url, 1);
                    }}
                    className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-indigo-600/20 border border-white/[0.06] hover:border-indigo-500/40 text-zinc-400 hover:text-white text-xs font-semibold whitespace-nowrap transition-all duration-200"
                  >
                    <span>{site.nickname}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-black/40 text-indigo-400 group-hover:text-indigo-300">
                      {site.video_count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>
      </div>

      {/* ─── Error Notice ───────────────────────────────────────── */}
      {errorMessage && (
        <div className="mb-8 flex items-start gap-4 p-5 rounded-2xl bg-amber-950/30 border border-amber-500/20 backdrop-blur-sm">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex-shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-300 mb-0.5">Extraction Notice</p>
            <p className="text-xs text-zinc-400 leading-relaxed">{errorMessage}</p>
          </div>
          <button onClick={() => setErrorMessage(null)} className="ml-auto text-zinc-600 hover:text-zinc-400 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ─── Results Area ────────────────────────────────────────── */}
      <div ref={resultsRef}>
        {result && (
          <>
            {/* Result Header */}
            <div className="mb-6 p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <h2 className="text-lg font-bold text-white truncate">{result.pageTitle}</h2>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[11px] font-mono font-bold flex-shrink-0">
                      {result.videos.length} streams
                    </span>
                    {currentPage > 1 && (
                      <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 text-[11px] font-mono font-bold flex-shrink-0">
                        Page {currentPage}
                      </span>
                    )}
                  </div>
                  <a
                    href={result.pageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-zinc-600 hover:text-indigo-400 inline-flex items-center gap-1 font-mono transition-colors truncate max-w-md"
                  >
                    <span>{result.pageUrl}</span>
                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Search within results */}
                  {result.videos.length > 4 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter results..."
                        className="w-40 bg-white/[0.05] border border-white/[0.08] rounded-xl pl-8 pr-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40 transition-all"
                      />
                    </div>
                  )}
                  <button
                    onClick={() => handleExtract(activeSectionUrl || urlInput, currentPage)}
                    disabled={isLoading || isPaginating}
                    className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.08] text-xs font-semibold transition-all flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isPaginating ? 'animate-spin text-indigo-400' : ''}`} />
                    <span>Re-scan</span>
                  </button>
                </div>
              </div>

              {/* Section Tabs */}
              {result.sections && result.sections.length > 1 && (
                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-zinc-600 whitespace-nowrap pr-2 flex-shrink-0 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-indigo-500" />
                      <span>Sections</span>
                    </span>
                    <div className="w-px h-3 bg-white/10 flex-shrink-0" />

                    <button
                      onClick={() => handleSelectSection(null)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                        activeSectionUrl === null
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                          : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05]'
                      }`}
                    >
                      All
                    </button>

                    {result.sections
                      .filter((s) => s.id !== 'home')
                      .map((sec) => {
                        const isActive = activeSectionUrl === sec.url;
                        return (
                          <button
                            key={sec.id}
                            onClick={() => handleSelectSection(sec.url)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                              isActive
                                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                                : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05]'
                            }`}
                          >
                            {sec.name}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Loading skeletons */}
            {(isLoading || isPaginating) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 mb-12">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="aspect-[2/3] rounded-2xl bg-white/[0.04] border border-white/[0.05] animate-pulse" />
                ))}
              </div>
            )}

            {/* Video Grid */}
            {!isLoading && !isPaginating && filteredVideos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
                {filteredVideos.map((vid) => {
                  const poster = vid.posterUrl || result?.posterUrl;
                  const fmt = formatColor(vid.format);
                  const isHovered = hoveredId === vid.id;

                  return (
                    <div
                      key={vid.id}
                      onMouseEnter={() => setHoveredId(vid.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      className="group relative rounded-2xl overflow-hidden border border-white/[0.07] bg-zinc-950 cursor-pointer"
                      style={{
                        transform: isHovered ? 'translateY(-4px) scale(1.01)' : 'none',
                        boxShadow: isHovered ? '0 20px 40px rgba(0,0,0,0.6), 0 0 30px rgba(99,102,241,0.12)' : 'none',
                        transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s cubic-bezier(0.16,1,0.3,1)',
                        borderColor: isHovered ? 'rgba(99,102,241,0.3)' : undefined,
                      }}
                      onClick={() => setSelectedVideo(vid)}
                    >
                      {/* Poster */}
                      <div className="relative aspect-[2/3] overflow-hidden bg-zinc-900">
                        {poster ? (
                          <img
                            src={poster}
                            alt={vid.title}
                            loading="lazy"
                            className="w-full h-full object-cover object-top"
                            style={{
                              transform: isHovered ? 'scale(1.06)' : 'scale(1)',
                              transition: 'transform 0.5s cubic-bezier(0.16,1,0.3,1)',
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-indigo-950/80 via-zinc-900 to-zinc-950 flex items-center justify-center">
                            <Film className="w-8 h-8 text-indigo-500/30" />
                          </div>
                        )}

                        {/* Gradient vignette */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                        {/* Format & Quality badge */}
                        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1">
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase font-mono tracking-wider border ${fmt.bg} ${fmt.border} ${fmt.text}`}>
                            {vid.quality || (vid.streamUrl.includes('1080') ? '1080p FHD' : vid.streamUrl.includes('720') ? '720p HD' : vid.format.split(' ')[0])}
                          </span>
                        </div>

                        {/* Play button overlay */}
                        <div
                          className="absolute inset-0 flex items-center justify-center"
                          style={{
                            opacity: isHovered ? 1 : 0,
                            transition: 'opacity 0.2s ease',
                          }}
                        >
                          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center">
                            <Play className="w-6 h-6 fill-white text-white translate-x-0.5" />
                          </div>
                        </div>

                        {/* Bottom title on hover */}
                        <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
                          <h3
                            className="text-xs font-bold text-white leading-snug"
                            style={{
                              display: '-webkit-box',
                              WebkitLineClamp: isHovered ? 3 : 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {vid.title}
                          </h3>
                        </div>
                      </div>

                      {/* Action bar */}
                      <div
                        className="px-3 py-2.5 flex items-center gap-1.5 bg-zinc-950"
                        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                      >
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedVideo(vid); }}
                          className="flex-1 py-1.5 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition-all"
                        >
                          <Play className="w-3 h-3 fill-white" />
                          <span>Play</span>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCopy(vid.id, useProxy ? vid.proxyStreamUrl : vid.streamUrl); }}
                          className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] text-zinc-400 hover:text-white transition-all"
                        >
                          {copiedId === vid.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <a
                          href={`${vid.proxyStreamUrl}&download=true`}
                          download
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] text-zinc-400 hover:text-white transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty after filter */}
            {!isLoading && !isPaginating && result && filteredVideos.length === 0 && result.videos.length > 0 && (
              <div className="py-16 text-center">
                <p className="text-zinc-600 text-sm">No results match "{searchQuery}"</p>
                <button onClick={() => setSearchQuery('')} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300">
                  Clear filter
                </button>
              </div>
            )}

            {/* Pagination */}
            {!isLoading && !isPaginating && result && result.videos.length > 0 && (
              <div className="mt-6 mb-12 flex items-center justify-center gap-6">
                {currentPage > 1 && (
                  <button
                    onClick={() => handleNavigatePage(currentPage - 1)}
                    disabled={isPaginating}
                    className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] text-white text-sm font-semibold transition-all active:scale-95"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>
                )}

                <div className="flex items-center gap-3">
                  <span className="text-4xl font-black text-white font-mono tabular-nums">{currentPage}</span>
                  <div className="text-zinc-700 text-xs font-mono">page</div>
                </div>

                <button
                  onClick={() => handleNavigatePage(currentPage + 1)}
                  disabled={isPaginating}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-600/25 active:scale-95"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty / Initial State */}
        {!result && !isLoading && !errorMessage && (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="relative mb-8">
              <div className="w-20 h-20 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center mx-auto">
                <Film className="w-9 h-9 text-indigo-500/70" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Ready to Extract</h3>
            <p className="text-sm text-zinc-600 max-w-xs leading-relaxed">
              Paste any video website URL above and click "Extract &amp; Play" to instantly find all streamable videos.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {['Any website', 'HLS streams', 'MP4 files', 'Embedded players', 'Channel pages'].map((tag) => (
                <span key={tag} className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-zinc-500 text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Video Player Modal ──────────────────────────────────── */}
      {playerMediaItem && (
        <VideoPlayer
          media={playerMediaItem}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </PageContainer>
  );
}
