import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { getSavedSiteById } from '@/lib/db';
import { extractVideosFromUrl, buildPagedUrl } from '@/lib/extractor';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await props.params;
  const site = await getSavedSiteById(id);
  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const rawPage = parseInt(searchParams.get('page') || '1', 10);
  const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
  const sectionUrl = searchParams.get('sectionUrl')?.trim() || site.url;

  try {
    const targetUrl = buildPagedUrl(sectionUrl, page);
    const extraction = await extractVideosFromUrl(targetUrl);

    return NextResponse.json({
      success: true,
      siteId: site.id,
      page,
      sectionUrl,
      targetUrl,
      hasNext: extraction.videos.length > 0,
      count: extraction.videos.length,
      videos: extraction.videos,
      sections: extraction.sections || site.sections || [],
    });
  } catch (error: any) {
    console.error(`[API /api/sites/${id}/browse GET] error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to browse section page' },
      { status: 500 }
    );
  }
}

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
    const body = await request.json().catch(() => ({}));
    const rawPage = parseInt(body.page || '1', 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const sectionUrl = (body.sectionUrl || '').trim() || site.url;

    const targetUrl = buildPagedUrl(sectionUrl, page);
    const extraction = await extractVideosFromUrl(targetUrl);

    return NextResponse.json({
      success: true,
      siteId: site.id,
      page,
      sectionUrl,
      targetUrl,
      hasNext: extraction.videos.length > 0,
      count: extraction.videos.length,
      videos: extraction.videos,
      sections: extraction.sections || site.sections || [],
    });
  } catch (error: any) {
    console.error(`[API /api/sites/${id}/browse POST] error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to browse section page' },
      { status: 500 }
    );
  }
}
