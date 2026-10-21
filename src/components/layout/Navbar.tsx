'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { HardDrive, Home, Star, Settings, LogOut, Search, Menu, X, Radio, Globe, Tv } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { PrimaryLogoSvg } from '@/components/brand/LogoVariants';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [favCount, setFavCount] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [isTvUi, setIsTvUi] = useState<boolean>(false);

  useEffect(() => {
    try {
      const savedTv = localStorage.getItem('megavault_tv_mode');
      const isTvDevice =
        typeof window !== 'undefined' &&
        /SmartTV|Tizen|SAMSUNG|SamsungBrowser|Web0S|AppleTV|GoogleTV|Android.*TV|HbbTV/i.test(
          navigator.userAgent
        );

      if (savedTv === 'true' || (savedTv === null && isTvDevice)) {
        setIsTvUi(true);
        document.documentElement.classList.add('tv-ui');
        document.body.classList.add('tv-ui');
      }
    } catch {}
  }, []);

  const toggleTvUi = () => {
    const next = !isTvUi;
    setIsTvUi(next);
    try {
      localStorage.setItem('megavault_tv_mode', next ? 'true' : 'false');
      if (next) {
        document.documentElement.classList.add('tv-ui');
        document.body.classList.add('tv-ui');
      } else {
        document.documentElement.classList.remove('tv-ui');
        document.body.classList.remove('tv-ui');
      }
    } catch {}
  };

  useEffect(() => {
    if (pathname === '/login') return;

    fetch('/api/favorites')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.count === 'number') {
          setFavCount(data.count);
        }
      })
      .catch(() => {});
  }, [pathname]);

  // Hide Navbar on Login page
  if (pathname === '/login') return null;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/login', { method: 'DELETE' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const navLinks = [
    { label: 'Gallery', href: '/', icon: Home },
    { label: 'Saved Sites', href: '/sites', icon: Globe },
    { label: 'Favorites', href: '/favorites', icon: Star, badge: favCount > 0 ? favCount : undefined },
    { label: 'Stream Extractor', href: '/extractor', icon: Radio },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 glass-nav border-b border-white/10 bg-zinc-950/80 backdrop-blur-2xl transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand Header */}
          <Link href="/" className="flex items-center group transition-transform duration-300 hover:scale-105">
            <PrimaryLogoSvg theme="dark" size={38} />
          </Link>

          {/* Clean Desktop Navigation Items */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 bg-zinc-900/60 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center space-x-2 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 relative',
                    isActive
                      ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-md shadow-blue-500/10'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-blue-400' : 'text-zinc-400')} />
                  <span>{link.label}</span>
                  {link.badge !== undefined && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold font-mono rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-sm animate-pulse">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Controls & Logout */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>MEGA Vault Ready</span>
            </div>

            {/* Samsung TV / 10-foot UI Mode Toggle */}
            <button
              onClick={toggleTvUi}
              title={isTvUi ? "Exit TV 10-Foot UI" : "Enable Samsung TV 10-Foot Mode (Large Fonts & Focus Borders)"}
              className={cn(
                "px-2.5 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all duration-200",
                isTvUi
                  ? "bg-indigo-600/30 text-indigo-300 border-indigo-500/50 shadow-md shadow-indigo-500/20 ring-1 ring-indigo-400/40"
                  : "bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-800"
              )}
            >
              <Tv className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">{isTvUi ? "TV Mode" : "TV Mode"}</span>
            </button>

            <button
              onClick={handleLogout}
              title="Lock Vault & Logout"
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-rose-950/60 border border-zinc-800 hover:border-rose-700/50 text-zinc-400 hover:text-rose-200 transition-all duration-200"
            >
              <LogOut className="w-4 h-4" />
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl p-4 space-y-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all',
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                )}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </div>
                {link.badge !== undefined && (
                  <span className="px-2 py-0.5 text-xs font-bold font-mono rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
};

