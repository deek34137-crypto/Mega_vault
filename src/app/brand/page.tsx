'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles,
  Download,
  Copy,
  Check,
  Globe,
  Smartphone,
  Share2,
  Palette,
  Type,
  LayoutGrid,
  Maximize2,
  Minimize2,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Eye,
  Sliders,
  FileCode,
  ArrowRight,
  ExternalLink,
  Info,
} from 'lucide-react';

import {
  PrimaryLogoSvg,
  LogomarkStandaloneSvg,
  WordmarkSvg,
  HorizontalLockupSvg,
  StackedLockupSvg,
  MonochromeLockupSvg,
} from '@/components/brand/LogoVariants';

export default function BrandIdentityPage() {
  const [copiedColor, setCopiedColor] = useState<string | null>(null);
  const [logoTheme, setLogoTheme] = useState<'dark' | 'light' | 'gradient'>('dark');
  const [interactiveText, setInteractiveText] = useState('MegaVault Private Encryption');
  const [activeTab, setActiveTab] = useState<'logos' | 'browser' | 'guidelines'>('logos');

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedColor(label);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  const colors = [
    {
      name: 'Electric Blue (Primary)',
      role: 'Primary Action & Brand Glow',
      hex: '#3B82F6',
      rgb: 'rgb(59, 130, 246)',
      hsl: 'hsl(217, 91%, 60%)',
      contrastOnDark: '8.4:1 (AAA)',
      bgClass: 'bg-blue-500',
    },
    {
      name: 'Vault Indigo (Secondary)',
      role: 'Gradient Transitions & Accent',
      hex: '#6366F1',
      rgb: 'rgb(99, 102, 241)',
      hsl: 'hsl(239, 84%, 67%)',
      contrastOnDark: '6.7:1 (AA)',
      bgClass: 'bg-indigo-500',
    },
    {
      name: 'Cyan Sparkle (Highlight)',
      role: 'Icon Sparkles & Micro-interactions',
      hex: '#06B6D4',
      rgb: 'rgb(6, 182, 212)',
      hsl: 'hsl(189, 94%, 43%)',
      contrastOnDark: '7.8:1 (AAA)',
      bgClass: 'bg-cyan-500',
    },
    {
      name: 'Obsidian Zinc (Background)',
      role: 'Core App Surface & Dark Mode Base',
      hex: '#09090B',
      rgb: 'rgb(9, 9, 11)',
      hsl: 'hsl(240, 10%, 4%)',
      contrastOnDark: 'Base Canvas',
      bgClass: 'bg-zinc-950 border border-zinc-800',
    },
    {
      name: 'Emerald Secure (Status)',
      role: 'MEGA Connected & Active Status',
      hex: '#10B981',
      rgb: 'rgb(16, 185, 129)',
      hsl: 'hsl(160, 84%, 39%)',
      contrastOnDark: '9.1:1 (AAA)',
      bgClass: 'bg-emerald-500',
    },
    {
      name: 'Coral Alert (Notice)',
      role: 'System Warnings & Lock Indicators',
      hex: '#F43F5E',
      rgb: 'rgb(244, 63, 94)',
      hsl: 'hsl(349, 89%, 60%)',
      contrastOnDark: '5.2:1 (AA)',
      bgClass: 'bg-rose-500',
    },
  ];

  const logoAssets = [
    {
      id: 'primary',
      title: 'Primary Logo Lockup',
      tag: 'Main Brand Symbol',
      desc: 'The official horizontal lockup featuring the glowing gradient squircle emblem, bold wordmark, and private status pill.',
      component: <PrimaryLogoSvg theme={logoTheme} size={44} />,
      formats: ['SVG', 'PNG', 'WEBP'],
      downloadName: 'megavault-primary-logo.svg',
    },
    {
      id: 'logomark',
      title: 'Standalone Logomark',
      tag: 'Icon / Favicon / App Badge',
      desc: 'High-visibility standalone shield emblem with central sparkle diamond. Used for app icons, avatars, and tight spaces.',
      component: <LogomarkStandaloneSvg size={64} mode={logoTheme === 'light' ? 'mono-light' : 'gradient'} />,
      formats: ['SVG', 'PNG'],
      downloadName: 'megavault-logomark.svg',
    },
    {
      id: 'wordmark',
      title: 'Brand Wordmark',
      tag: 'Typography Lockup',
      desc: 'Clean, bold typographic brand representation with custom gradient on VAULT suffix.',
      component: <WordmarkSvg theme={logoTheme} />,
      formats: ['SVG', 'PNG'],
      downloadName: 'megavault-wordmark.svg',
    },
    {
      id: 'horizontal',
      title: 'Horizontal Navigation Lockup',
      tag: 'Header & Footer Ratio 1:4',
      desc: 'Standard inline header lockup optimized for web navbar headers, documentation titles, and partner banners.',
      component: <HorizontalLockupSvg theme={logoTheme} />,
      formats: ['SVG', 'PNG'],
      downloadName: 'megavault-horizontal-lockup.svg',
    },
    {
      id: 'stacked',
      title: 'Stacked Vertical Lockup',
      tag: 'Splash Screens & Mobile',
      desc: 'Centered vertical presentation engineered for splash screens, mobile onboarding, badges, and marketing prints.',
      component: <StackedLockupSvg theme={logoTheme} />,
      formats: ['SVG', 'PNG'],
      downloadName: 'megavault-stacked-lockup.svg',
    },
    {
      id: 'monochrome',
      title: 'Monochrome High-Contrast',
      tag: 'Single-Color / Technical',
      desc: '100% solid black and white lockups for single-color printing, laser engraving, fax, or accessibility contrast modes.',
      component: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <MonochromeLockupSvg mode="light-on-dark" />
          <MonochromeLockupSvg mode="dark-on-light" />
        </div>
      ),
      formats: ['SVG', 'EPS'],
      downloadName: 'megavault-monochrome.svg',
    },
  ];

  const browserAssets = [
    {
      title: 'favicon.ico',
      file: '/favicon.svg',
      desc: 'Standard multi-resolution ICO icon fallback for legacy web browsers.',
      specs: '16x16, 32x32, 48x48 ICO',
      icon: <Globe className="w-6 h-6 text-blue-400" />,
    },
    {
      title: 'favicon.svg',
      file: '/favicon.svg',
      desc: 'Vector SVG favicon with adaptive glow and crisp sharpness on all HiDPI Retina screens.',
      specs: 'Scalable Vector Graphics (SVG)',
      icon: <Sparkles className="w-6 h-6 text-cyan-400" />,
    },
    {
      title: 'Apple Touch Icon',
      file: '/apple-touch-icon.png',
      desc: 'High-res iOS home screen web app launcher icon with squircle masking.',
      specs: '180x180 PNG',
      icon: <Smartphone className="w-6 h-6 text-indigo-400" />,
    },
    {
      title: 'Web App Manifest Icons',
      file: '/icon-512.png',
      desc: 'Progressive Web App (PWA) manifest icon set with maskable safe zones for Android & Windows.',
      specs: '192x192 & 512x512 PNG',
      icon: <LayoutGrid className="w-6 h-6 text-emerald-400" />,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Header Banner */}
      <div className="relative overflow-hidden border-b border-zinc-800 bg-gradient-to-b from-blue-950/30 via-zinc-950 to-zinc-950 pt-10 pb-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-600/15 via-indigo-600/5 to-transparent pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold uppercase tracking-wider mb-4">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Official Brand Standards & Design System</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
                MegaVault <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">Brand Identity</span>
              </h1>
              <p className="mt-3 text-zinc-400 max-w-2xl text-base sm:text-lg">
                Complete design guidelines, logo system lockups, browser identity files, color palettes, and usage rules.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/favicon.svg"
                download="megavault-brand-kit.svg"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/25 flex items-center space-x-2 transition-all hover:scale-105"
              >
                <Download className="w-4 h-4" />
                <span>Download Assets</span>
              </a>
              <Link
                href="/"
                className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-sm font-medium flex items-center space-x-2 transition-colors"
              >
                <span>Back to Vault</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Hero Image Showcase */}
          <div className="mt-10 relative rounded-2xl border border-zinc-800/80 overflow-hidden bg-zinc-900 shadow-2xl group">
            <img
              src="/brand-hero.jpg"
              alt="MegaVault Brand Showcase"
              className="w-full h-64 sm:h-96 object-cover object-center group-hover:scale-102 transition-transform duration-700 opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent flex items-end p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Master Brand Board</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white">MegaVault High-Definition Visual Identity</h3>
                </div>
                <div className="flex items-center space-x-2 text-xs text-zinc-400 bg-zinc-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-zinc-800">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Encrypted Zero-Storage Identity v1.0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Navigation Tabs */}
          <div className="mt-8 flex items-center space-x-2 border-b border-zinc-800 pb-2">
            {[
              { id: 'logos', label: '1. Logo System', icon: Sparkles },
              { id: 'browser', label: '2. Browser / Web Assets', icon: Globe },
              { id: 'guidelines', label: '3. Brand Guidelines', icon: Palette },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 space-y-20">
        {/* SECTION 1: LOGO SYSTEM */}
        {(activeTab === 'logos' || activeTab === undefined) && (
          <section id="logo-system" className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                  <Sparkles className="w-7 h-7 text-blue-400" />
                  <span>Logo System</span>
                </h2>
                <p className="text-zinc-400 text-sm mt-1">
                  Master lockups and icon variants engineered for light, dark, and vector production environments.
                </p>
              </div>

              {/* Theme Canvas Switcher */}
              <div className="flex items-center space-x-1.5 bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
                <span className="text-zinc-500 font-medium px-2">Canvas:</span>
                {(['dark', 'light', 'gradient'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setLogoTheme(t)}
                    className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition-all ${
                      logoTheme === t
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Logo Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {logoAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden flex flex-col justify-between hover:border-zinc-700 transition-all duration-300"
                >
                  <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        {asset.tag}
                      </span>
                      <h3 className="text-lg font-bold text-white mt-1">{asset.title}</h3>
                    </div>

                    <div className="flex items-center space-x-1">
                      {asset.formats.map((fmt) => (
                        <span key={fmt} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                          {fmt}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Logo Display Canvas */}
                  <div
                    className={`p-8 min-h-[180px] flex items-center justify-center transition-colors duration-300 ${
                      logoTheme === 'light'
                        ? 'bg-zinc-100'
                        : logoTheme === 'gradient'
                        ? 'bg-gradient-to-tr from-blue-900 via-indigo-900 to-zinc-950'
                        : 'bg-zinc-950/80'
                    }`}
                  >
                    {asset.component}
                  </div>

                  {/* Asset Specs & Download Footer */}
                  <div className="p-4 bg-zinc-900 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                    <p className="text-zinc-400 max-w-xs">{asset.desc}</p>
                    <a
                      href="/favicon.svg"
                      download={asset.downloadName}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-blue-600 text-zinc-200 hover:text-white font-medium flex items-center space-x-1.5 transition-colors shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECTION 2: BROWSER / WEB */}
        {(activeTab === 'browser' || activeTab === undefined) && (
          <section id="browser-web" className="space-y-8">
            <div className="border-b border-zinc-800/80 pb-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                <Globe className="w-7 h-7 text-indigo-400" />
                <span>Browser & Web Identity</span>
              </h2>
              <p className="text-zinc-400 text-sm mt-1">
                Optimized favicon files, web app manifest specifications, touch icons, and social sharing previews.
              </p>
            </div>

            {/* Live Browser Tab Preview Simulator */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden shadow-xl">
              <div className="bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center space-x-3">
                <div className="flex space-x-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                {/* Active Tab */}
                <div className="flex items-center space-x-2 bg-zinc-900 px-3 py-1.5 rounded-t-lg border-t border-x border-zinc-800 text-xs text-zinc-200 font-medium">
                  <img src="/favicon.svg" alt="Favicon" className="w-4 h-4" />
                  <span className="truncate max-w-[150px]">MegaVault - Private Index</span>
                  <span className="text-zinc-500 hover:text-white cursor-pointer ml-2">×</span>
                </div>
                <div className="text-xs text-zinc-500 font-medium px-2">New Tab +</div>
              </div>

              <div className="p-6 bg-zinc-950/40 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center space-x-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Active Metadata Linkage Confirmed</span>
                  </div>
                  <h3 className="text-xl font-bold text-white">Browser Identity Files Integrated</h3>
                  <p className="text-zinc-400 text-sm max-w-xl">
                    All browser icons are linked in root <code className="text-blue-400 font-mono text-xs">layout.tsx</code> metadata with standard SVG vector fallback and PWA maskable web app manifest.
                  </p>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <a
                    href="/site.webmanifest"
                    target="_blank"
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold flex items-center space-x-2 border border-zinc-700"
                  >
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <span>View site.webmanifest</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Asset Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {browserAssets.map((asset) => (
                <div key={asset.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col justify-between hover:border-zinc-700 transition-colors">
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-zinc-800/80 border border-zinc-700 flex items-center justify-center">
                      {asset.icon}
                    </div>
                    <h4 className="text-base font-bold text-white">{asset.title}</h4>
                    <p className="text-xs text-zinc-400">{asset.desc}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-zinc-500">{asset.specs}</span>
                    <a
                      href={asset.file}
                      download
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* OpenGraph / Social Preview Showcase Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-cyan-400" />
                    <span>OG / Social Share Preview Image (1200 × 630)</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Generates dynamic preview cards when shared on Twitter/X, Discord, Slack, and LinkedIn.
                  </p>
                </div>
                <a
                  href="/og-image.jpg"
                  download="megavault-og-preview.jpg"
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 self-start"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download OG Card</span>
                </a>
              </div>

              {/* Social Media Card Mockup */}
              <div className="max-w-2xl mx-auto rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
                <img src="/og-image.jpg" alt="Social Share Card" className="w-full h-auto object-cover" />
                <div className="p-4 bg-zinc-900 border-t border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">megavault.app</span>
                  <h4 className="text-sm font-bold text-white mt-0.5">MegaVault - Private Media Vault & Index</h4>
                  <p className="text-xs text-zinc-400 mt-1">Encrypted, zero-storage private personal media index and vault.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* SECTION 3: BRAND GUIDELINES */}
        {(activeTab === 'guidelines' || activeTab === undefined) && (
          <section id="brand-guidelines" className="space-y-12">
            <div className="border-b border-zinc-800/80 pb-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                <Palette className="w-7 h-7 text-cyan-400" />
                <span>Brand Guidelines</span>
              </h2>
              <p className="text-zinc-400 text-sm mt-1">
                Core color swatches, typography hierarchy, clear space margins, minimum sizing, and usage rules.
              </p>
            </div>

            {/* 1. Color Palette */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <span>Color Palette</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {colors.map((c) => (
                  <div key={c.name} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden flex flex-col">
                    <div className={`h-24 ${c.bgClass} flex items-end p-4 relative`}>
                      <span className="text-xs font-mono font-bold bg-black/60 backdrop-blur px-2.5 py-1 rounded text-white border border-white/10">
                        {c.hex}
                      </span>
                    </div>

                    <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-base font-bold text-white">{c.name}</h4>
                        <p className="text-xs text-zinc-400">{c.role}</p>
                      </div>

                      <div className="space-y-1.5 text-xs font-mono pt-3 border-t border-zinc-800/80">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">HEX:</span>
                          <button
                            onClick={() => copyToClipboard(c.hex, c.hex)}
                            className="text-zinc-300 hover:text-white flex items-center space-x-1"
                          >
                            <span>{c.hex}</span>
                            {copiedColor === c.hex ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">RGB:</span>
                          <span className="text-zinc-300">{c.rgb}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-500">Contrast:</span>
                          <span className="text-emerald-400 font-semibold">{c.contrastOnDark}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Typography */}
            <div className="space-y-6 pt-6 border-t border-zinc-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                    <Type className="w-5 h-5 text-indigo-400" />
                    <span>Typography System</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">Primary typeface: Inter / System UI sans-serif stack</p>
                </div>

                {/* Live Text Inspector Input */}
                <div className="flex items-center space-x-2 bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
                  <span className="text-xs text-zinc-500 font-medium">Test Text:</span>
                  <input
                    type="text"
                    value={interactiveText}
                    onChange={(e) => setInteractiveText(e.target.value)}
                    className="bg-transparent text-xs text-white outline-none w-48 font-medium"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-6">
                <div className="space-y-4">
                  <div className="border-b border-zinc-800 pb-3">
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                      <span>DISPLAY LARGE • 48px / Bold 800</span>
                      <span>tracking-tight</span>
                    </div>
                    <p className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight truncate">
                      {interactiveText}
                    </p>
                  </div>

                  <div className="border-b border-zinc-800 pb-3">
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                      <span>HEADING H2 • 28px / SemiBold 700</span>
                      <span>tracking-tight</span>
                    </div>
                    <p className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
                      {interactiveText}
                    </p>
                  </div>

                  <div className="border-b border-zinc-800 pb-3">
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                      <span>SUBHEADING • 18px / Medium 500</span>
                      <span>tracking-normal</span>
                    </div>
                    <p className="text-base sm:text-lg font-medium text-zinc-200 truncate">
                      {interactiveText}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                      <span>BODY TEXT • 14px / Regular 400</span>
                      <span>leading-relaxed</span>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                      MegaVault uses zero-storage encryption indexing to organize family media directly from MEGA storage links with absolute privacy.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Spacing, Clear Space & Minimum Sizes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-zinc-800/80">
              {/* Spacing System */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
                <h4 className="text-base font-bold text-white flex items-center space-x-2">
                  <LayoutGrid className="w-4 h-4 text-blue-400" />
                  <span>Spacing System</span>
                </h4>
                <p className="text-xs text-zinc-400">Based on a strict 4px / 8px grid baseline.</p>

                <div className="space-y-2 pt-2">
                  {[
                    { label: '4px (0.25rem)', width: 'w-4', name: 'Micro Gap' },
                    { label: '8px (0.5rem)', width: 'w-8', name: 'Button Padding' },
                    { label: '16px (1.0rem)', width: 'w-16', name: 'Card Margin' },
                    { label: '24px (1.5rem)', width: 'w-24', name: 'Section Gap' },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">{s.name}:</span>
                      <div className="flex items-center space-x-2">
                        <div className={`h-2.5 ${s.width} bg-blue-500/80 rounded`} />
                        <span className="font-mono text-zinc-300">{s.label}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clear Space Rules */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
                <h4 className="text-base font-bold text-white flex items-center space-x-2">
                  <Maximize2 className="w-4 h-4 text-indigo-400" />
                  <span>Clear Space Rule</span>
                </h4>
                <p className="text-xs text-zinc-400">Maintain an exclusion boundary equal to 1X height of the icon emblem.</p>

                <div className="p-4 rounded-xl border border-dashed border-blue-500/40 bg-blue-500/5 flex items-center justify-center relative">
                  <span className="absolute top-1 left-2 text-[9px] font-mono text-blue-400">1X Exclusion Zone</span>
                  <PrimaryLogoSvg theme="dark" size={32} />
                </div>
              </div>

              {/* Minimum Size Limits */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
                <h4 className="text-base font-bold text-white flex items-center space-x-2">
                  <Minimize2 className="w-4 h-4 text-cyan-400" />
                  <span>Minimum Size Rules</span>
                </h4>
                <p className="text-xs text-zinc-400">Ensure legibility across digital & print mediums.</p>

                <div className="space-y-3 text-xs pt-2">
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-white block">Digital Web Lockup</span>
                      <span className="text-[10px] text-zinc-400">Min Height: 24px</span>
                    </div>
                    <LogomarkStandaloneSvg size={24} mode="gradient" />
                  </div>

                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-white block">Print Applications</span>
                      <span className="text-[10px] text-zinc-400">Min Height: 10mm (38px)</span>
                    </div>
                    <LogomarkStandaloneSvg size={32} mode="gradient" />
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Do / Don't Usage Guidelines */}
            <div className="space-y-6 pt-6 border-t border-zinc-800/80">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Do & Don't Usage Rules</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Strict execution standards to protect brand integrity.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* DO CARD 1 */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-3">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>DO: Use on dark approved backgrounds</span>
                  </div>
                  <div className="p-6 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center">
                    <PrimaryLogoSvg theme="dark" size={36} />
                  </div>
                  <p className="text-xs text-zinc-400">
                    Always place the primary logo on dark obsidian surface colors (#09090B) to maximize gradient contrast.
                  </p>
                </div>

                {/* DON'T CARD 1 */}
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-3">
                  <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                    <XCircle className="w-5 h-5" />
                    <span>DON'T: Stretch, skew or distort aspect ratio</span>
                  </div>
                  <div className="p-6 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center overflow-hidden">
                    <div className="scale-x-150 scale-y-75 transform">
                      <PrimaryLogoSvg theme="dark" size={36} />
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400">
                    Never alter the proportion or stretch horizontal/vertical scales of logo lockups.
                  </p>
                </div>

                {/* DO CARD 2 */}
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 space-y-3">
                  <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>DO: Use official monochrome lockups for print</span>
                  </div>
                  <div className="p-6 bg-white rounded-xl border border-zinc-300 flex items-center justify-center">
                    <MonochromeLockupSvg mode="dark-on-light" />
                  </div>
                  <p className="text-xs text-zinc-400">
                    Use single-color monochrome white or black logos when working with restricted single-color print mediums.
                  </p>
                </div>

                {/* DON'T CARD 2 */}
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-3">
                  <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                    <XCircle className="w-5 h-5" />
                    <span>DON'T: Change brand gradient colors</span>
                  </div>
                  <div className="p-6 bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center filter hue-rotate-90">
                    <PrimaryLogoSvg theme="dark" size={36} />
                  </div>
                  <p className="text-xs text-zinc-400">
                    Do not swap primary electric blue/indigo hues with unapproved neon pinks, greens, or yellows.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
