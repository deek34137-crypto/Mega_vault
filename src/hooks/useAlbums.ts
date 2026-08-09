'use client';

import { useState, useEffect, useCallback } from 'react';
import { Album } from '@/types';

interface UseAlbumsReturn {
  albums: Album[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
  deleteAlbum: (id: string) => Promise<boolean>;
  createAlbum: (payload: {
    title: string;
    description?: string;
    megaUrl: string;
  }) => Promise<{ success: boolean; error?: string }>;
}

export function useAlbums(): UseAlbumsReturn {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/albums');
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (!res.ok) throw new Error('Failed to load albums');
      const data = await res.json();
      setAlbums(data.albums ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deleteAlbum = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/albums/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAlbums((prev) => prev.filter((a) => a.id !== id));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const createAlbum = useCallback(
    async (payload: {
      title: string;
      description?: string;
      megaUrl: string;
    }): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/albums', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: payload.title,
            description: payload.description,
            megaUrl: payload.megaUrl,
          }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error ?? 'Failed to create album' };
        await load(); // Reload to get fresh list with media counts
        return { success: true };
      } catch {
        return { success: false, error: 'Network error' };
      }
    },
    [load]
  );

  return { albums, isLoading, error, reload: load, deleteAlbum, createAlbum };
}
