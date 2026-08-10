'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

export const PrimaryLogoSvg: React.FC<{ theme?: 'dark' | 'light' | 'gradient'; size?: number }> = ({
  theme = 'dark',
  size = 44,
}) => {
  const isLight = theme === 'light';
  const textColor = isLight ? '#09090b' : '#ffffff';

  return (
    <div className="flex items-center space-x-3.5 select-none">
      {/* Icon Emblem */}
      <div
        className={`relative flex items-center justify-center rounded-2xl p-[2px] transition-transform duration-300 hover:scale-105 ${
          theme === 'gradient'
            ? 'bg-white shadow-xl'
            : 'bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 shadow-lg shadow-blue-500/20'
        }`}
        style={{ width: size, height: size }}
      >
        <div
          className={`w-full h-full rounded-[14px] flex items-center justify-center ${
            theme === 'gradient'
              ? 'bg-gradient-to-br from-blue-600 to-indigo-700'
              : isLight
              ? 'bg-white'
              : 'bg-zinc-950'
          }`}
        >
          <Sparkles
            className={`w-1/2 h-1/2 ${
              theme === 'gradient' ? 'text-white' : isLight ? 'text-blue-600' : 'text-cyan-400'
            }`}
          />
        </div>
      </div>

      {/* Brand Text */}
      <div className="flex flex-col">
        <div className="flex items-center space-x-2">
          <span className="font-extrabold tracking-tight" style={{ fontSize: size * 0.48, color: textColor }}>
            MEGA<span className="text-blue-500">VAULT</span>
          </span>
          <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
            PRIVATE
          </span>
        </div>
        <span className="text-xs font-medium tracking-wide text-zinc-400 -mt-1">
          Personal Encrypted Index
        </span>
      </div>
    </div>
  );
};

export const LogomarkStandaloneSvg: React.FC<{ size?: number; mode?: 'gradient' | 'mono-dark' | 'mono-light' }> = ({
  size = 64,
  mode = 'gradient',
}) => {
  return (
    <div className="flex flex-col items-center space-y-2 select-none">
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="50%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>

        {/* Outer Squircle */}
        <rect
          x="5"
          y="5"
          width="90"
          height="90"
          rx="24"
          fill={mode === 'mono-dark' ? '#09090b' : mode === 'mono-light' ? '#ffffff' : '#09090b'}
          stroke={mode === 'mono-dark' ? '#ffffff' : mode === 'mono-light' ? '#09090b' : 'url(#lmGrad)'}
          strokeWidth="4"
        />

        {/* Shield Silhouette */}
        <path
          d="M50 20 L75 32 V54 C75 68 64 78 50 84 C36 78 25 68 25 54 V32 Z"
          fill={mode === 'mono-light' ? '#09090b' : mode === 'mono-dark' ? '#ffffff' : 'url(#lmGrad)'}
          opacity={mode === 'gradient' ? '0.85' : '1'}
        />

        {/* Sparkle Inner */}
        <path
          d="M50 36 L54 46 L64 50 L54 54 L50 64 L46 54 L36 50 L46 46 Z"
          fill={mode === 'mono-light' ? '#ffffff' : '#09090b'}
        />
      </svg>
      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Icon Symbol Only</span>
    </div>
  );
};

export const WordmarkSvg: React.FC<{ theme?: 'dark' | 'light' | 'gradient' }> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';
  return (
    <div className="flex flex-col items-center justify-center p-4 select-none">
      <div className="flex items-baseline space-x-2 tracking-tight">
        <span className={`text-4xl font-extrabold ${isLight ? 'text-zinc-900' : 'text-white'}`}>
          MEGA
        </span>
        <span className="text-4xl font-black bg-gradient-to-r from-blue-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
          VAULT
        </span>
      </div>
      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
        Typography Wordmark Only (No Icon Emblem)
      </span>
    </div>
  );
};

export const HorizontalLockupSvg: React.FC<{ theme?: 'dark' | 'light' | 'gradient' }> = ({ theme = 'dark' }) => {
  return (
    <div
      className={`px-6 py-4 rounded-2xl border flex items-center space-x-4 ${
        theme === 'light'
          ? 'bg-white border-zinc-200 text-zinc-900'
          : theme === 'gradient'
          ? 'bg-zinc-900/90 border-blue-500/30 text-white'
          : 'bg-zinc-950 border-zinc-800 text-white'
      }`}
    >
      <LogomarkStandaloneSvg size={40} mode="gradient" />
      <div className="h-8 w-[1px] bg-zinc-700/40" />
      <div className="flex items-baseline space-x-1.5">
        <span className={`text-2xl font-extrabold ${theme === 'light' ? 'text-zinc-900' : 'text-white'}`}>MEGA</span>
        <span className="text-2xl font-black text-blue-500">VAULT</span>
      </div>
    </div>
  );
};

export const StackedLockupSvg: React.FC<{ theme?: 'dark' | 'light' | 'gradient' }> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';
  return (
    <div
      className={`p-6 rounded-2xl border flex flex-col items-center justify-center space-y-3 text-center ${
        isLight
          ? 'bg-white border-zinc-200'
          : theme === 'gradient'
          ? 'bg-zinc-900/90 border-blue-500/30'
          : 'bg-zinc-950 border-zinc-800'
      }`}
    >
      <LogomarkStandaloneSvg size={56} mode="gradient" />
      <div className="flex flex-col items-center">
        <span className={`text-2xl font-extrabold tracking-tight ${isLight ? 'text-zinc-900' : 'text-white'}`}>
          MEGA<span className="text-blue-500">VAULT</span>
        </span>
        <span className="text-[11px] text-zinc-400 font-medium tracking-wider uppercase mt-0.5">
          Zero-Storage Media Index
        </span>
      </div>
    </div>
  );
};

export const MonochromeLockupSvg: React.FC<{ mode: 'dark-on-light' | 'light-on-dark' }> = ({ mode }) => {
  const isLightMode = mode === 'dark-on-light';
  return (
    <div
      className={`p-6 rounded-2xl border flex items-center space-x-4 ${
        isLightMode
          ? 'bg-white border-zinc-300 text-zinc-950'
          : 'bg-zinc-950 border-zinc-800 text-white'
      }`}
    >
      <LogomarkStandaloneSvg size={40} mode={isLightMode ? 'mono-light' : 'mono-dark'} />
      <div className="flex flex-col">
        <span className={`text-xl font-bold tracking-tight ${isLightMode ? 'text-zinc-950' : 'text-white'}`}>
          MEGAVAULT
        </span>
        <span
          className={`text-[9px] font-semibold tracking-widest uppercase ${
            isLightMode ? 'text-zinc-600' : 'text-zinc-400'
          }`}
        >
          MONOCHROME SPEC
        </span>
      </div>
    </div>
  );
};
