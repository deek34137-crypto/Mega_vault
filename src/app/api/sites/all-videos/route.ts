import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getAllSavedSiteVideos, getAllSavedSites, appendSiteVideos } from '@/lib/db';
import { buildSiteSearchUrl, extractVideosFromUrl } from '@/lib/extractor';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search')?.trim() || undefined;
  const siteId = searchParams.get('siteId')?.trim() || undefined;
  const online = searchParams.get('online') === 'true';

  try {
    let videos = await getAllSavedSiteVideos(search, siteId);

    // If online search is requested across channels (or if DB search returned 0 with a search keyword)
    if (search && (online || videos.length === 0)) {
      const sites = await getAllSavedSites();
      const searchableSites = siteId
        ? sites.filter((s) => s.id === siteId)
        : sites.filter((s) =>
            s.url.includes('henvids') ||
            s.url.includes('hentaibros') ||
            s.url.includes('hentaverse') ||
            s.url.includes('rule34video') ||
            s.url.includes('oppai.stream') ||
            s.url.includes('desihub')
          ).slice(0, 5);

      const onlinePromises = searchableSites.map(async (site) => {
        try {
          const searchUrl = buildSiteSearchUrl(site.url, search);
          const extraction = await extractVideosFromUrl(searchUrl);
          if (extraction.videos && extraction.videos.length > 0) {
            const dbVideos = extraction.videos.map((v) => ({
              id: v.id,
              title: v.title,
              stream_url: v.streamUrl,
              proxy_stream_url: v.proxyStreamUrl,
              poster_url: v.posterUrl,
              format: v.format,
              mime_type: v.mimeType,
              source: v.source,
              created_at: new Date().toISOString(),
            }));
            await appendSiteVideos(site.id, dbVideos);
            return dbVideos.map((dv) => ({
              ...dv,
              site_id: site.id,
              site_nickname: site.nickname,
            }));
          }
        } catch (e) {
          console.error(`[Online search failed for ${site.nickname}]:`, e);
        }
        return [];
      });

      const onlineResults = await Promise.allSettled(onlinePromises);
      const newDiscoveredVideos: any[] = [];
      for (const res of onlineResults) {
        if (res.status === 'fulfilled' && res.value) {
          newDiscoveredVideos.push(...res.value);
        }
      }

      if (newDiscoveredVideos.length > 0) {
        const existingIds = new Set(videos.map((v) => v.id));
        for (const nv of newDiscoveredVideos) {
          if (!existingIds.has(nv.id)) {
            existingIds.add(nv.id);
            videos.unshift(nv);
          }
        }
      }
    }

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
