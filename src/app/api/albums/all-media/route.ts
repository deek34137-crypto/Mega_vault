import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { fetchAllVaultMedia } from '@/lib/mega';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get('type') || 'all';
    const searchQuery = (searchParams.get('search') || '').trim().toLowerCase();
    const sortBy = searchParams.get('sortBy') || 'newest';
    const pageParam = searchParams.get('page');
    const limitParam = searchParams.get('limit');
    const refresh = searchParams.get('refresh') === 'true';

    const vaultData = await fetchAllVaultMedia(refresh);
    let items = vaultData.items;

    // Filter by Media Type (Images vs Videos)
    if (typeParam === 'images') {
      items = items.filter((m) => m.mediaType === 'IMAGE');
    } else if (typeParam === 'videos') {
      items = items.filter((m) => m.mediaType === 'VIDEO');
    }

    // Filter by Search Query
    if (searchQuery) {
      items = items.filter((m) => {
        const nameMatch = m.fileName.toLowerCase().includes(searchQuery);
        const albumMatch = m.albumTitle ? m.albumTitle.toLowerCase().includes(searchQuery) : false;
        const folderMatch = m.folderPath ? m.folderPath.toLowerCase().includes(searchQuery) : false;
        return nameMatch || albumMatch || folderMatch;
      });
    }

    // Sort Items
    items = items.slice().sort((a, b) => {
      if (sortBy === 'name') {
        return a.fileName.localeCompare(b.fileName);
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'size') {
        return (b.size || 0) - (a.size || 0);
      }
      // Default: newest first
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    let paginationData = undefined;
    if (pageParam || limitParam) {
      const page = Math.max(1, parseInt(pageParam || '1', 10));
      const limit = Math.max(1, parseInt(limitParam || '24', 10));
      const totalItems = items.length;
      const totalPages = Math.ceil(totalItems / limit) || 1;
      const startIndex = (page - 1) * limit;
      items = items.slice(startIndex, startIndex + limit);

      paginationData = {
        totalItems,
        totalPages,
        currentPage: page,
        limit,
      };
    }

    return NextResponse.json({
      items,
      stats: vaultData.stats,
      ...(paginationData ? { pagination: paginationData } : {}),
    });
  } catch (error) {
    console.error('GET /api/albums/all-media error:', error);
    return NextResponse.json({ error: 'Failed to fetch vault media', items: [], stats: { totalCount: 0, imagesCount: 0, videosCount: 0, albumsCount: 0, foldersCount: 0 } }, { status: 500 });
  }
}
