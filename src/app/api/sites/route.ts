import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import {
  getAllSavedSites,
  createSavedSite,
  saveSiteVideos,
  SavedSite,
} from '@/lib/db';
import { extractVideosFromUrl } from '@/lib/extractor';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sites = await getAllSavedSites();
    const totalVideos = sites.reduce((acc, s) => acc + (s.video_count || 0), 0);

    return NextResponse.json({
      success: true,
      sites,
      totalSites: sites.length,
      totalVideos,
    });
  } catch (error: any) {
    console.error('[API /api/sites GET] error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch saved sites' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const nickname = (body.nickname || '').trim();
    const url = (body.url || '').trim();

    if (!nickname) {
      return NextResponse.json({ error: 'Website Nickname is required' }, { status: 400 });
    }

    if (!url) {
      return NextResponse.json({ error: 'Website URL is required' }, { status: 400 });
    }

    // Scrape / extract videos from the website on-the-fly (Zero pre-downloading)
    const extraction = await extractVideosFromUrl(url);

    const siteId = `site_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date().toISOString();

    const site: SavedSite = {
      id: siteId,
      nickname,
      url: extraction.pageUrl,
      poster_url: extraction.posterUrl || extraction.videos[0]?.posterUrl || null,
      video_count: extraction.videos.length,
      sections: extraction.sections || [],
      created_at: now,
      updated_at: now,
    };

    // Save site metadata
    await createSavedSite(site);

    // Save videos metadata
    if (extraction.videos.length > 0) {
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

      await saveSiteVideos(siteId, videoItems, site.poster_url || undefined, extraction.sections);
    }

    return NextResponse.json({
      success: true,
      site,
      videosCount: extraction.videos.length,
      videos: extraction.videos,
    });
  } catch (error: any) {
    console.error('[API /api/sites POST] error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract and save website' },
      { status: 500 }
    );
  }
}
