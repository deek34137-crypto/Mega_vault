import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function isPrivateOrLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();

  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return true;
  }

  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = host.match(ipv4Regex);
  if (match) {
    const [, b1, b2] = match.map(Number);
    if (b1 === 10) return true;
    if (b1 === 172 && b2 >= 16 && b2 <= 31) return true;
    if (b1 === 192 && b2 === 168) return true;
    if (b1 === 169 && b2 === 254) return true;
    if (b1 === 127) return true;
    if (b1 === 0) return true;
  }

  return false;
}

export async function GET(request: Request) {
  try {
    const authorized = await isAuthenticated();
    if (!authorized) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get('url');
    const referer = searchParams.get('referer');
    const isDownload = searchParams.get('download') === 'true';

    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing target URL' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    if (isPrivateOrLocalHost(parsedUrl.hostname)) {
      return NextResponse.json({ error: 'Forbidden host' }, { status: 403 });
    }

    // Forward range header from browser
    const rangeHeader = request.headers.get('range');
    const upstreamHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: '*/*',
      'Accept-Encoding': 'identity',
    };

    if (referer) {
      upstreamHeaders['Referer'] = referer;
    }

    if (rangeHeader) {
      upstreamHeaders['Range'] = rangeHeader;
    }

    const upstreamResponse = await fetch(targetUrl, {
      headers: upstreamHeaders,
      redirect: 'follow',
    });

    if (!upstreamResponse.ok && upstreamResponse.status !== 206) {
      return NextResponse.json(
        { error: `Upstream video host returned ${upstreamResponse.status}` },
        { status: upstreamResponse.status }
      );
    }

    // Construct response headers for partial streaming
    const responseHeaders = new Headers();
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'public, max-age=3600');

    const contentType = upstreamResponse.headers.get('content-type') || 'video/mp4';
    responseHeaders.set('Content-Type', contentType);

    const contentLength = upstreamResponse.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    const contentRange = upstreamResponse.headers.get('content-range');
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange);
    }

    if (isDownload) {
      const fileName = parsedUrl.pathname.split('/').pop() || 'video.mp4';
      responseHeaders.set('Content-Disposition', `attachment; filename="${fileName}"`);
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status, // 206 or 200
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error('[ProxyStream] Error:', err);
    return NextResponse.json({ error: err.message || 'Stream proxy failed' }, { status: 502 });
  }
}
