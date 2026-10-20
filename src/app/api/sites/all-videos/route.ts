import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getAllSavedSiteVideos } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || undefined;
  const siteId = searchParams.get('siteId') || undefined;

  try {
    const videos = await getAllSavedSiteVideos(search, siteId);

    return NextResponse.json({
      success: true,
      count: videos.length,
      videos,
    });
  } catch (error: any) {
    console.error('[API /api/sites/all-videos GET] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search saved videos' },
      { status: 500 }
    );
  }
}
