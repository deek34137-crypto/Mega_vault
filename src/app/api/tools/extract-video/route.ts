import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { extractVideosFromUrl } from '@/lib/extractor';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

export async function POST(request: Request) {
  try {
    const authorized = await isAuthenticated();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const targetUrl: string = (body.url || '').trim();

    if (!targetUrl) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const result = await extractVideosFromUrl(targetUrl);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error('[ExtractVideos] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to extract video streams from website' },
      { status: 500 }
    );
  }
}
