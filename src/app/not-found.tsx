'use client';

import React from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { Home, AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <PageContainer className="flex items-center justify-center min-h-[70vh]">
      <div className="glass-panel p-12 rounded-3xl text-center max-w-lg border border-zinc-800 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-extrabold text-white mb-2">404</h1>
        <h2 className="text-xl font-bold text-zinc-200 mb-2">Page Not Found</h2>
        <p className="text-sm text-zinc-400 mb-8">
          The requested album, media item, or page does not exist or has been removed.
        </p>
        <Link
          href="/"
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/20"
        >
          <Home className="w-4 h-4" />
          <span>Return Home</span>
        </Link>
      </div>
    </PageContainer>
  );
}
