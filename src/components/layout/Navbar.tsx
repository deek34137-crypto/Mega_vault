'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { HardDrive, Home, Star, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { PrimaryLogoSvg } from '@/components/brand/LogoVariants';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [favCount, setFavCount] = useState<number>(0);

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
    { label: 'Favorites', href: '/favorites', icon: Star, badge: favCount > 0 ? favCount : undefined },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 glass-nav transition-all duration-200 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand Header */}
          <Link href="/" className="flex items-center group transition-transform duration-200 hover:opacity-90">
            <PrimaryLogoSvg theme="dark" size={38} />
          </Link>

          {/* Clean Navigation Items */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 relative',
                    isActive
                      ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  )}
                >
                  <Icon className={cn('w-4 h-4', isActive ? 'text-blue-400' : 'text-zinc-400')} />
                  <span>{link.label}</span>
                  {link.badge !== undefined && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold font-mono rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Controls & Logout */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>MEGA Connected</span>
            </div>

            <button
              onClick={handleLogout}
              title="Lock Vault & Logout"
              className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
