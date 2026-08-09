'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { SectionTitle } from '@/components/ui/SectionTitle';
import {
  User,
  Shield,
  HardDrive,
  Key,
  CheckCircle,
  Download,
  Upload,
  Database,
  Copy,
  Check,
  Link as LinkIcon,
  Plus,
  Trash2,
  ExternalLink,
  RefreshCw,
  Sparkles,
  FolderPlus,
} from 'lucide-react';

interface SavedLink {
  id: string;
  title: string;
  megaUrl: string;
  description?: string;
}

export default function SettingsPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [savedLinks, setSavedLinks] = useState<SavedLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form states for adding link in Settings
  const [newTitle, setNewTitle] = useState('');
  const [newMegaUrl, setNewMegaUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addSuccessMsg, setAddSuccessMsg] = useState('');

  // Bulk add modal/input state
  const [showBulkInput, setShowBulkInput] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const loadLinks = useCallback(async () => {
    try {
      setIsLoadingLinks(true);
      const res = await fetch('/api/albums');
      let currentServerLinks: SavedLink[] = [];

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.albums)) {
          currentServerLinks = data.albums.map((alb: any) => ({
            id: alb.id,
            title: alb.title,
            megaUrl: alb.megaUrl || alb.mega_link || '',
            description: alb.description,
          }));
        }
      }

      // Read browser local storage cache
      let localCache: SavedLink[] = [];
      try {
        const stored = localStorage.getItem('megavault_saved_links');
        if (stored) {
          localCache = JSON.parse(stored);
        }
      } catch (e) {
        console.error('Failed to parse localStorage saved links:', e);
      }

      // Merge server links and local storage cache cleanly
      const mergedMap = new Map<string, SavedLink>();
      for (const item of [...currentServerLinks, ...localCache]) {
        if (item.megaUrl && item.megaUrl.trim()) {
          mergedMap.set(item.megaUrl.trim(), item);
        }
      }

      const mergedList = Array.from(mergedMap.values());
      setSavedLinks(mergedList);

      // Keep browser local storage synced with merged list
      if (mergedList.length > 0) {
        localStorage.setItem('megavault_saved_links', JSON.stringify(mergedList));
      }
    } catch (err) {
      console.error('Error loading saved links in settings:', err);
    } finally {
      setIsLoadingLinks(false);
    }
  }, []);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newMegaUrl || isAdding) return;

    try {
      setIsAdding(true);
      setAddSuccessMsg('');

      const res = await fetch('/api/albums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          megaUrl: newMegaUrl.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setNewTitle('');
        setNewMegaUrl('');
        setAddSuccessMsg('Folder link saved successfully!');
        setTimeout(() => setAddSuccessMsg(''), 3000);
        await loadLinks();
      } else {
        alert(data.error || 'Failed to add folder link');
      }
    } catch (err) {
      alert('Error adding folder link');
    } finally {
      setIsAdding(false);
    }
  };

  const handleBulkAdd = async () => {
    if (!bulkText.trim()) return;

    try {
      setIsAdding(true);
      // Parse multi-line links (e.g. lines with URLs or Title | URL)
      const lines = bulkText.split('\n').filter((l) => l.trim().length > 0);
      const itemsToImport: { title: string; megaUrl: string }[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('mega.nz/folder/')) {
          let title = `Indexed Folder ${i + 1}`;
          let megaUrl = line;
          if (line.includes('|')) {
            const parts = line.split('|');
            title = parts[0].trim();
            megaUrl = parts[1].trim();
          }
          itemsToImport.push({ title, megaUrl });
        }
      }

      if (itemsToImport.length === 0) {
        alert('No valid MEGA folder links found. Make sure links contain "mega.nz/folder/"');
        return;
      }

      const res = await fetch('/api/albums/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemsToImport),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBulkText('');
        setShowBulkInput(false);
        setAddSuccessMsg(`Successfully imported ${data.restoredCount} links!`);
        setTimeout(() => setAddSuccessMsg(''), 3000);
        await loadLinks();
      } else {
        alert(data.error || 'Failed to import bulk links');
      }
    } catch (err) {
      alert('Error bulk adding links');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteLink = async (id: string, megaUrl: string) => {
    if (!confirm('Are you sure you want to remove this folder link?')) return;

    try {
      if (id && !id.startsWith('temp-')) {
        await fetch(`/api/albums/${id}`, { method: 'DELETE' });
      }
      const updated = savedLinks.filter((item) => item.id !== id && item.megaUrl !== megaUrl);
      setSavedLinks(updated);
      localStorage.setItem('megavault_saved_links', JSON.stringify(updated));
    } catch (err) {
      alert('Error removing link');
    }
  };

  const handleSyncToDatabase = async () => {
    if (savedLinks.length === 0) return;
    try {
      setIsSyncing(true);
      const res = await fetch('/api/albums/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedLinks),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('megavault_saved_links', JSON.stringify(savedLinks));
        alert(`Successfully synced ${data.restoredCount || savedLinks.length} folder links to database!`);
      } else {
        alert(data.error || 'Failed to sync links');
      }
    } catch (err) {
      alert('Error syncing links');
    } finally {
      setIsSyncing(false);
    }
  };

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
        subtitle="Manage your saved folder links, local database sync, cloud storage, and backup settings"
      />

      <div className="max-w-4xl space-y-8">
        {/* Section 1: Saved Folder Links Manager & Quick Add */}
        <div className="glass-panel p-6 rounded-3xl border border-zinc-800/80 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <LinkIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Saved Folder Links Vault</h3>
                <p className="text-xs text-zinc-400">
                  Links added here are automatically saved to browser storage so folders never reset to 0
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleSyncToDatabase}
                disabled={isSyncing || savedLinks.length === 0}
                className="px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync to Database'}</span>
              </button>

              <button
                onClick={() => setShowBulkInput(!showBulkInput)}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <FolderPlus className="w-3.5 h-3.5 text-purple-400" />
                <span>{showBulkInput ? 'Single Link' : 'Bulk Add'}</span>
              </button>
            </div>
          </div>

          {/* Quick Success Message */}
          {addSuccessMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{addSuccessMsg}</span>
            </div>
          )}

          {/* Form: Single Add Link */}
          {!showBulkInput ? (
            <form onSubmit={handleAddLink} className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">Add New Folder Link</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Folder Name / Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Vacation Memories 2026"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">MEGA Folder URL</label>
                  <input
                    type="url"
                    placeholder="https://mega.nz/folder/..."
                    value={newMegaUrl}
                    onChange={(e) => setNewMegaUrl(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isAdding || !newTitle || !newMegaUrl}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAdding ? 'Saving Link...' : 'Save Folder Link'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Form: Bulk Add Links */
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Bulk Add Folder Links</h4>
              <p className="text-[11px] text-zinc-400">
                Paste multiple MEGA folder links (one per line). Format: <code>Title | https://mega.nz/folder/...</code> or just the URL.
              </p>
              <textarea
                rows={4}
                placeholder={`Family Photos | https://mega.nz/folder/EXAMPLE1#KEY1\nhttps://mega.nz/folder/EXAMPLE2#KEY2`}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-purple-500 transition-colors"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowBulkInput(false)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkAdd}
                  disabled={isAdding || !bulkText.trim()}
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isAdding ? 'Processing...' : 'Import Bulk Links'}</span>
                </button>
              </div>
            </div>
          )}

          {/* List of Saved Links */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Saved Folder Links ({savedLinks.length})
              </h4>
              <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                Browser Local Database Auto-Synced
              </span>
            </div>

            {isLoadingLinks ? (
              <div className="p-8 text-center text-xs text-zinc-500">Loading saved folder links...</div>
            ) : savedLinks.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60 text-xs text-zinc-400">
                No folder links saved yet. Add your first MEGA folder link above!
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/80 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 overflow-hidden">
                {savedLinks.map((item) => (
                  <div
                    key={item.id || item.megaUrl}
                    className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="space-y-0.5 max-w-xl truncate">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-white truncate">{item.title}</span>
                      </div>
                      <span className="text-[11px] text-zinc-400 font-mono block truncate">{item.megaUrl}</span>
                    </div>

                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <button
                        onClick={() => handleCopy(item.megaUrl, item.megaUrl)}
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                        title="Copy Link"
                      >
                        {copiedKey === item.megaUrl ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <a
                        href={item.megaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                        title="Open in MEGA"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => handleDeleteLink(item.id, item.megaUrl)}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Remove Link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Backup & Restore Card */}
        <div className="glass-panel p-6 rounded-3xl border border-zinc-800/80">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Database className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Album Links JSON File Backup & Restore</h3>
              <p className="text-xs text-zinc-400">Export a backup `.json` file to transfer your links to any device</p>
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

        {/* Section 3: Render Cloud Database Setup Card */}
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

        {/* Section 4: Profile Card */}
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

        {/* Section 5: MEGA Connection */}
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

