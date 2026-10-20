import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSavedSiteById, saveSiteVideos } from '@/lib/db';
import { extractVideosFromUrl } from '@/lib/extractor';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await props.params;
  const site = await getSavedSiteById(id);
  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  try {
    // Re-extract videos from the site URL
    const extraction = await extractVideosFromUrl(site.url);

    const now = new Date().toISOString();
    const videoItems = extraction.videos.map((v) => ({
      id: v.id,
      title: v.title,
      stream_url: v.streamUrl,
      proxy_stream_url: v.proxyStreamUrl,
      poster_url: v.posterUrl || extraction.posterUrl || null,
      format: v.format,
      mime_type: v.mimeType,
      source: v.source,
      created_at: now,
    }));

    const newPoster = extraction.posterUrl || extraction.videos[0]?.posterUrl || site.poster_url || undefined;
    await saveSiteVideos(site.id, videoItems, newPoster);

    return NextResponse.json({
      success: true,
      message: `Re-scanned "${site.nickname}". Found ${extraction.videos.length} videos.`,
      videoCount: extraction.videos.length,
      videos: extraction.videos,
    });
  } catch (error: any) {
    console.error('[API /api/sites/[id]/refresh POST] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to refresh site streams' },
      { status: 500 }
    );
  }
}
