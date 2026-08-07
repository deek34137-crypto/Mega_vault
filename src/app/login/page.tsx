'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Lock, ArrowRight, ShieldCheck, Key } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || 'Invalid site password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 p-[1px] shadow-xl shadow-blue-500/20 mx-auto mb-4">
            <div className="w-full h-full bg-zinc-950 rounded-[15px] flex items-center justify-center">
              <Sparkles className="w-7 h-7 text-blue-400" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">{APP_NAME}</h1>
          <p className="text-xs text-zinc-400 mt-1 font-medium">Private Family & Personal Media Index</p>
        </div>

        {/* Login Card */}
        <div className="glass-panel p-8 rounded-3xl border border-zinc-800 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center space-x-2 text-xs font-semibold text-blue-400 mb-6 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-full w-fit mx-auto">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Password Protected Vault</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">
                Enter Site Access Password
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoFocus
                  required
                  className="w-full bg-zinc-900/90 border border-zinc-700/70 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg shadow-blue-600/25"
            >
              <span>{isLoading ? 'Unlocking Vault...' : 'Enter MegaVault'}</span>
              {!isLoading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
