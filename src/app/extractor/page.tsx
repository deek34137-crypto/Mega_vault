'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { VideoPlayer } from '@/components/viewer/VideoPlayer';
import { MediaItem } from '@/types';
import {
  Link as LinkIcon,
  Play,
  Film,
  Sparkles,
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
  Radio,
  Tv,
} from 'lucide-react';

interface ExtractedVideo {
  id: string;
  title: string;
  streamUrl: string;
  proxyStreamUrl: string;
  posterUrl?: string;
  mimeType: string;
  format: string;
  source: 'direct' | 'html5' | 'opengraph' | 'jsonld' | 'script' | 'link';
}

interface ExtractionResult {
  pageTitle: string;
  pageUrl: string;
  posterUrl?: string;
  count: number;
  videos: ExtractedVideo[];
}

export default function ExtractorPage() {
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [useProxy, setUseProxy] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Player state
  const [selectedVideo, setSelectedVideo] = useState<ExtractedVideo | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleExtract = async (overrideUrl?: string) => {
    const target = (overrideUrl || urlInput).trim();
    if (!target) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/tools/extract-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error || 'Failed to extract video streams from this page');
        setResult(null);
      } else if (data.videos.length === 0) {
        setErrorMessage(
          'No direct video streams (<video>, <source>, MP4, WebM, M3U8) were found on this page. The site may require authentication or dynamic browser execution.'
        );
        setResult(data);
      } else {
        setResult(data);
        setErrorMessage(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error occurred while scraping');
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrlInput(text);
        handleExtract(text);
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  const handleCopy = (id: string, streamUrl: string) => {
    navigator.clipboard.writeText(streamUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Convert ExtractedVideo into MediaItem so VideoPlayer can play it
  const playerMediaItem: MediaItem | null = selectedVideo
    ? {
        id: selectedVideo.id,
        albumId: 'web-extracted',
        albumTitle: result?.pageTitle || 'Web Stream',
        folderPath: 'Ad-Free Player',
        fileHandle: 'web',
        fileName: selectedVideo.title,
        mimeType: selectedVideo.mimeType || 'video/mp4',
        mediaType: 'VIDEO',
        size: 0,
        createdAt: new Date().toISOString(),
        thumbnailUrl: selectedVideo.posterUrl || result?.posterUrl,
        streamUrl: useProxy ? selectedVideo.proxyStreamUrl : selectedVideo.streamUrl,
      }
    : null;

  return (
    <PageContainer>
      {/* Header Banner */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Zero-Storage • 100% Ad & Popup Free</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>Web Video Stream Extractor</span>
              <Sparkles className="w-5 h-5 text-blue-400" />
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-2xl">
              Paste any webpage link from your sites. MegaVault extracts raw video streams and poster thumbnails so you can watch them directly inside our built-in player with zero ads, redirects, or intrusive popups.
            </p>
          </div>

          {/* Proxy Stream Switch */}
          <div className="flex items-center gap-2 p-2 rounded-2xl glass-panel border border-zinc-800 bg-zinc-950/80">
            <button
              onClick={() => setUseProxy(!useProxy)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                useProxy
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-zinc-400 hover:text-white bg-zinc-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{useProxy ? 'Bypass CORS/Hotlink: ON' : 'Direct Stream: ON'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Input Form */}
      <div className="glass-panel p-4 sm:p-6 rounded-3xl border border-zinc-800/80 bg-zinc-950/70 mb-8 shadow-2xl relative overflow-hidden">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleExtract();
          }}
          className="space-y-4"
        >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <LinkIcon className="w-5 h-5 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste website link or direct video URL (e.g. https://your-site.com/watch?v=...)"
                disabled={isLoading}
                className="w-full bg-zinc-900/90 border border-zinc-700/80 rounded-2xl pl-12 pr-24 py-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
              />

              {/* Action buttons inside input */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
                {urlInput ? (
                  <button
                    type="button"
                    onClick={() => {
                      setUrlInput('');
                      setResult(null);
                      setErrorMessage(null);
                    }}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePasteClipboard}
                    title="Paste from clipboard"
                    className="px-2 py-1 rounded-lg text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors flex items-center gap-1"
                  >
                    <Clipboard className="w-3 h-3" />
                    <span>Paste</span>
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !urlInput.trim()}
              className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/30 flex-shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Extracting...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-white" />
                  <span>Extract & Play</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Info & Test Demos */}
          <div className="flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-2 pt-1">
            <span className="flex items-center gap-1.5 text-zinc-500">
              <Tv className="w-3.5 h-3.5 text-blue-400" />
              <span>Supports HTML5 video tags, OpenGraph video, JSON-LD VideoObjects, and direct streams.</span>
            </span>

            {/* Quick Demo Links */}
            <div className="flex items-center space-x-2">
              <span className="text-zinc-500">Try sample:</span>
              <button
                type="button"
                onClick={() => {
                  const demoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
                  setUrlInput(demoUrl);
                  handleExtract(demoUrl);
                }}
                className="text-blue-400 hover:text-blue-300 underline font-mono text-[11px]"
              >
                BigBuckBunny MP4
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  const demoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';
                  setUrlInput(demoUrl);
                  handleExtract(demoUrl);
                }}
                className="text-purple-400 hover:text-purple-300 underline font-mono text-[11px]"
              >
                ElephantsDream MP4
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-8 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs sm:text-sm font-medium flex items-start gap-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-200">Extraction Notice</p>
            <p className="text-zinc-300 text-xs leading-relaxed">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Results Header */}
      {result && (
        <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl glass-panel border border-zinc-800 bg-zinc-950/60">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white truncate max-w-xl">
                {result.pageTitle}
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
                {result.videos.length} {result.videos.length === 1 ? 'Stream' : 'Streams'} Found
              </span>
            </div>
            <a
              href={result.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 hover:text-blue-400 inline-flex items-center gap-1 font-mono mt-0.5 truncate max-w-md"
            >
              <span>{result.pageUrl}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          </div>

          <button
            onClick={() => handleExtract()}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5 flex-shrink-0"
          >
            <Radio className="w-3.5 h-3.5 text-blue-400" />
            <span>Re-scan Page</span>
          </button>
        </div>
      )}

      {/* Extracted Video Cards Grid */}
      {result && result.videos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 mb-12">
          {result.videos.map((vid) => {
            const isPlayingThis = selectedVideo?.id === vid.id;
            const poster = vid.posterUrl || result.posterUrl;

            return (
              <div
                key={vid.id}
                className="glass-panel rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-950 flex flex-col group hover:border-blue-500/50 hover:shadow-xl transition-all duration-200"
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
                    <div className="w-full h-full bg-gradient-to-br from-blue-950 via-zinc-900 to-zinc-950 flex items-center justify-center">
                      <Film className="w-10 h-10 text-blue-500/40" />
                    </div>
                  )}

                  {/* Format & Source Badges */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10">
                    <span className="px-2 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] font-extrabold text-blue-300 border border-white/10 uppercase font-mono">
                      {vid.format}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-black/70 text-[9px] font-mono text-zinc-400 uppercase">
                      {vid.source}
                    </span>
                  </div>

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center group-hover:scale-110 group-hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/50 border border-white/20">
                      <Play className="w-5 h-5 fill-white translate-x-0.5" />
                    </div>
                  </div>
                </div>

                {/* Video Info & Controls */}
                <div className="p-3.5 flex flex-col justify-between flex-1 space-y-3">
                  <div>
                    <h3 className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors" title={vid.title}>
                      {vid.title}
                    </h3>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setSelectedVideo(vid)}
                      className="flex-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Play Ad-Free</span>
                    </button>

                    <button
                      onClick={() => handleCopy(vid.id, useProxy ? vid.proxyStreamUrl : vid.streamUrl)}
                      title="Copy video stream link"
                      className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
                    >
                      {copiedId === vid.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>

                    <a
                      href={`${vid.proxyStreamUrl}&download=true`}
                      download
                      title="Download direct video"
                      className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State / How it works Guide */}
      {!result && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 my-10">
          <div className="p-5 rounded-2xl glass-panel border border-zinc-800/80 bg-zinc-950/60 flex flex-col space-y-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <LinkIcon className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white">1. Paste Any Page Link</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Paste URLs from your sites or video hosts into the input box above. No setup or configuration needed.
            </p>
          </div>

          <div className="p-5 rounded-2xl glass-panel border border-zinc-800/80 bg-zinc-950/60 flex flex-col space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white">2. Automatic Stream Extraction</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              We parse HTML5 video tags, OpenGraph video cards, and embedded sources, completely stripping all ads and popups.
            </p>
          </div>

          <div className="p-5 rounded-2xl glass-panel border border-zinc-800/80 bg-zinc-950/60 flex flex-col space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white">3. Zero-Storage Ad-Free Play</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Videos play inside our native player with speed controls, scrubbing, and full-screen. Nothing is stored in the database.
            </p>
          </div>
        </div>
      )}

      {/* Built-in Ad-Free Video Player Modal */}
      {playerMediaItem && (
        <VideoPlayer
          media={playerMediaItem}
          onClose={() => setSelectedVideo(null)}
        />
      )}
    </PageContainer>
  );
}
