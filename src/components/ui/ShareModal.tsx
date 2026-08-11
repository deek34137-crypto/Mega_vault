'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Copy, Check, Lock, Clock, Link as LinkIcon, Sparkles } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  albumId: string;
  albumTitle: string;
  subfolderPath?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  albumId,
  albumTitle,
  subfolderPath = '',
}) => {
  const [pin, setPin] = useState('');
  const [expiresInHours, setExpiresInHours] = useState<number | ''>(24);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsGenerating(true);
      setErrorMsg(null);

      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumId,
          subfolderPath: subfolderPath || undefined,
          pin: pin.trim() || undefined,
          expiresInHours: expiresInHours === '' ? undefined : expiresInHours,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const fullUrl = `${window.location.origin}${data.shareUrl}`;
        setGeneratedUrl(fullUrl);
      } else {
        setErrorMsg(data.error || 'Failed to create share link');
      }
    } catch (err) {
      setErrorMsg('Network error while creating share link');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md p-6 rounded-3xl bg-zinc-950/90 border border-white/10 shadow-2xl overflow-hidden glass-panel"
        >
          {/* Top Decorative Glow */}
          <div className="absolute -top-16 -right-16 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Modal Title */}
          <div className="flex items-center space-x-3 mb-5">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                <span>Share Gallery</span>
                <Sparkles className="w-4 h-4 text-blue-400" />
              </h3>
              <p className="text-xs text-zinc-400 truncate max-w-[260px]">
                {albumTitle} {subfolderPath ? `› ${subfolderPath}` : ''}
              </p>
            </div>
          </div>

          {!generatedUrl ? (
            <form onSubmit={handleGenerateLink} className="space-y-4">
              {/* PIN Code Optional Input */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Optional Access PIN</span>
                </label>
                <input
                  type="text"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="e.g. 1234 (Leave blank for open link)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-blue-500/50 transition-all font-mono"
                />
              </div>

              {/* Expiration Option */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Link Expiration</span>
                </label>
                <select
                  value={expiresInHours}
                  onChange={(e) =>
                    setExpiresInHours(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-white text-xs focus:outline-none focus:border-blue-500/50 transition-all"
                >
                  <option value={1}>1 Hour</option>
                  <option value={24}>24 Hours (1 Day)</option>
                  <option value={168}>7 Days (1 Week)</option>
                  <option value={720}>30 Days (1 Month)</option>
                  <option value="">Never Expires</option>
                </select>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {errorMsg}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                <LinkIcon className="w-4 h-4" />
                <span>{isGenerating ? 'Generating Link...' : 'Create Share Link'}</span>
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-2">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Public Share Link
                </span>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedUrl}
                    className="w-full bg-black/60 border border-zinc-800 px-3 py-2 rounded-xl text-xs text-blue-300 font-mono focus:outline-none"
                  />
                  <button
                    onClick={handleCopy}
                    className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all flex-shrink-0"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                <p>• Anyone with this link can view photos and videos in this gallery.</p>
                {pin && <p>• Requires PIN: <span className="font-mono text-white font-bold">{pin}</span></p>}
                {expiresInHours ? (
                  <p>• Expires in {expiresInHours} hours.</p>
                ) : (
                  <p>• Link does not expire.</p>
                )}
              </div>

              <button
                onClick={() => {
                  setGeneratedUrl(null);
                  onClose();
                }}
                className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition-all"
              >
                Done
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
