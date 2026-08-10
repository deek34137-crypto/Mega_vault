'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function BrandIdentityPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/settings#brand-identity');
  }, [router]);

  return (
    <div className="min-h-[60vh] bg-zinc-950 text-zinc-100 flex items-center justify-center p-8">
      <div className="text-center space-y-4 max-w-sm p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
        <p className="text-sm text-zinc-300 font-medium">Redirecting to Settings → Brand Identity...</p>
        <Link
          href="/settings#brand-identity"
          className="inline-block px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
        >
          Go to Brand Settings
        </Link>
      </div>
    </div>
  );
}
