'use client';

import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { User, Shield, Moon, HardDrive, Key, LayoutGrid, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  return (
    <PageContainer>
      <SectionTitle
        title="Settings"
        subtitle="Manage your profile, theme, and MEGA storage settings"
      />

      <div className="max-w-4xl space-y-8">
        {/* Profile Card */}
        <div className="glass-panel p-6 rounded-3xl border border-zinc-800/80">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Account Profile</h3>
              <p className="text-xs text-zinc-400">Personal owner credentials & permissions</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Display Name</label>
              <input
                type="text"
                defaultValue="Vault Admin"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-200 focus:outline-none"
                readOnly
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Email Address</label>
              <input
                type="email"
                defaultValue="owner@megavault.local"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-200 focus:outline-none"
                readOnly
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Role</label>
              <div className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-blue-400 font-semibold">
                <Shield className="w-4 h-4" />
                <span>OWNER (Full Administrative Control)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Appearance & Layout */}
        <div className="glass-panel p-6 rounded-3xl border border-zinc-800/80">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Moon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Appearance & Gallery Layout</h3>
              <p className="text-xs text-zinc-400">Customize dark theme & gallery grid defaults</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <div>
                <span className="text-sm font-semibold text-white block">Dark Mode</span>
                <span className="text-xs text-zinc-400">Default high-contrast dark theme enabled</span>
              </div>
              <div className="w-10 h-6 rounded-full bg-blue-600 p-1 flex items-center justify-end">
                <div className="w-4 h-4 rounded-full bg-white shadow" />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800">
              <div>
                <span className="text-sm font-semibold text-white block">Default Gallery Grid</span>
                <span className="text-xs text-zinc-400">Responsive masonry grid layout</span>
              </div>
              <span className="text-xs font-semibold text-blue-400 px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
                Masonry Enabled
              </span>
            </div>
          </div>
        </div>

        {/* MEGA Connection */}
        <div className="glass-panel p-6 rounded-3xl border border-zinc-800/80">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <HardDrive className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">MEGA Integration</h3>
              <p className="text-xs text-zinc-400">Zero-storage decrypted metadata streaming status</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-sm font-bold text-emerald-300 block">MEGA Engine Active</span>
                <span className="text-xs text-zinc-400">Ready to parse folder links & decrypt stream buffers</span>
              </div>
            </div>
            <span className="text-xs font-mono text-zinc-400 bg-zinc-900 px-2.5 py-1 rounded-md border border-zinc-800">
              Protocol API v2
            </span>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
