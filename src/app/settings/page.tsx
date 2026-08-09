'use client';

import React, { useState } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { User, Shield, Moon, HardDrive, Key, LayoutGrid, CheckCircle, Download, Upload, Database, Copy, Check } from 'lucide-react';

export default function SettingsPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleExportBackup = async () => {
    try {
      const res = await fetch('/api/albums/backup');
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `megavault-albums-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert('Failed to export backup');
      }
    } catch (err) {
      alert('Error exporting backup');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const text = await file.text();
      const payload = JSON.parse(text);

      const res = await fetch('/api/albums/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message || 'Backup restored successfully!');
        window.location.reload();
      } else {
        alert(data.error || 'Failed to restore backup');
      }
    } catch (err) {
      alert('Invalid backup JSON file');
    } finally {
      setIsImporting(false);
    }
  };

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <PageContainer>
      <SectionTitle
        title="Settings"
        subtitle="Manage your profile, theme, MEGA storage, and Cloud Database settings"
      />

      <div className="max-w-4xl space-y-8">
        {/* Backup & Restore Card */}
        <div className="glass-panel p-6 rounded-3xl border border-zinc-800/80">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Album Links Backup & Restore</h3>
              <p className="text-xs text-zinc-400">Download or restore all indexed MEGA links with 1 click</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white">Export or Restore Backup File</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Save a `.json` file of your albums to keep your links safe anywhere.
              </p>
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <button
                onClick={handleExportBackup}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>Export Backup</span>
              </button>

              <label className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all border border-zinc-700">
                <Upload className="w-4 h-4" />
                <span>{isImporting ? 'Restoring...' : 'Restore JSON'}</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  disabled={isImporting}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Render Cloud Database Setup Card */}
        <div className="glass-panel p-6 rounded-3xl border border-zinc-800/80">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Key className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Render Environment Variables (Cloud DB)</h3>
              <p className="text-xs text-zinc-400">Copy these 2 keys into Render Dashboard to keep albums permanent</p>
            </div>
          </div>

          <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
            Render containers use temporary storage. Add these 2 Environment Variables in your <strong className="text-white">Render Web Service Dashboard &gt; Environment</strong> to connect to your cloud database so albums never reset:
          </p>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between font-mono text-xs">
              <div className="truncate mr-2">
                <span className="text-purple-400 font-bold">TURSO_DATABASE_URL</span>
                <span className="text-zinc-500 font-normal block truncate">libsql://megavault-deek34147.aws-ap-south-1.turso.io</span>
              </div>
              <button
                onClick={() => handleCopy('url', 'libsql://megavault-deek34147.aws-ap-south-1.turso.io')}
                className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-sans flex items-center gap-1 flex-shrink-0"
              >
                {copiedKey === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'url' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between font-mono text-xs">
              <div className="truncate mr-2">
                <span className="text-purple-400 font-bold">TURSO_AUTH_TOKEN</span>
                <span className="text-zinc-500 font-normal block truncate">eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...</span>
              </div>
              <button
                onClick={() =>
                  handleCopy(
                    'token',
                    'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODYxMjM5MDIsImlkIjoiMDE5ZmRkNDYtOTAwMS03OWRjLTg2YzgtNzBhMTY2NWM4YjczIiwia2lkIjoiWUdydUh3M1d1RFVvRTJNWVJXTWhsb3VTbjFIS0IyT21KM2x0cm1tSDUzVSIsInJpZCI6IjRhMGM5Zjk4LTI4NGUtNGE5MC04MTA3LWQzOWIyZmFhNWYwYSJ9.zynclq7U6gEyz4GeSgId7zE0ng7vT2fTkfj3NK-u2wIxCoXFhwmod8EJEyxx21RTh2n8mACImCAK0Aoj_dv6Aw'
                  )
                }
                className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-sans flex items-center gap-1 flex-shrink-0"
              >
                {copiedKey === 'token' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedKey === 'token' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

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
