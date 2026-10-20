export interface ExtractedVideoItem {
  id: string;
  title: string;
  streamUrl: string;
  proxyStreamUrl: string;
  posterUrl?: string;
  mimeType: string;
  format: string;
  source: 'direct' | 'html5' | 'opengraph' | 'jsonld' | 'script' | 'link';
}

export interface ExtractionResult {
  pageTitle: string;
  pageUrl: string;
  posterUrl?: string;
  count: number;
  videos: ExtractedVideoItem[];
}

export function isPrivateOrLocalHost(hostname: string): boolean {
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

export function resolveUrl(relativeOrAbsolute: string, baseUrl: string): string | null {
  try {
    const trimmed = relativeOrAbsolute.trim().replace(/^['"]|['"]$/g, '');
    if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('javascript:')) {
      return null;
    }
    if (trimmed.startsWith('//')) {
      const baseProto = new URL(baseUrl).protocol;
      return `${baseProto}${trimmed}`;
    }
    return new URL(trimmed, baseUrl).href;
  } catch {
    return null;
  }
}

export function getFormatAndMime(url: string): { format: string; mimeType: string } {
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  if (clean.endsWith('.mp4')) return { format: 'MP4', mimeType: 'video/mp4' };
  if (clean.endsWith('.webm')) return { format: 'WEBM', mimeType: 'video/webm' };
  if (clean.endsWith('.m3u8')) return { format: 'HLS (M3U8)', mimeType: 'application/x-mpegURL' };
  if (clean.endsWith('.mov')) return { format: 'MOV', mimeType: 'video/quicktime' };
  if (clean.endsWith('.mkv')) return { format: 'MKV', mimeType: 'video/x-matroska' };
  if (clean.endsWith('.ogg') || clean.endsWith('.ogv')) return { format: 'OGV', mimeType: 'video/ogg' };
  return { format: 'VIDEO', mimeType: 'video/mp4' };
}

export async function extractVideosFromUrl(targetUrl: string): Promise<ExtractionResult> {
  let cleanUrl = targetUrl.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  const parsedTarget = new URL(cleanUrl);
  if (isPrivateOrLocalHost(parsedTarget.hostname)) {
    throw new Error('Access to private or local network addresses is prohibited');
  }

  // 1. Direct stream link
  const isDirectVideo = /\.(mp4|webm|m3u8|mov|mkv|ogv)(\?|$)/i.test(parsedTarget.pathname + parsedTarget.search);
  if (isDirectVideo) {
    const fileName = parsedTarget.pathname.split('/').pop()?.split('?')[0] || 'Direct Stream';
    const { format, mimeType } = getFormatAndMime(cleanUrl);
    const videoId = Buffer.from(cleanUrl).toString('base64url').slice(0, 16);
    const proxyStreamUrl = `/api/tools/proxy-stream?url=${encodeURIComponent(cleanUrl)}&referer=${encodeURIComponent(cleanUrl)}`;

    return {
      pageTitle: decodeURIComponent(fileName),
      pageUrl: cleanUrl,
      posterUrl: undefined,
      count: 1,
      videos: [
        {
          id: videoId,
          title: decodeURIComponent(fileName),
          streamUrl: cleanUrl,
          proxyStreamUrl,
          mimeType,
          format,
          source: 'direct',
        },
      ],
    };
  }

  // 2. Fetch page HTML
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  let response: Response;
  try {
    response = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Website returned status: ${response.status} ${response.statusText}`);
  }

  const finalUrl = response.url || cleanUrl;
  const finalParsed = new URL(finalUrl);
  if (isPrivateOrLocalHost(finalParsed.hostname)) {
    throw new Error('Redirected to private network address');
  }

  const rawHtml = await response.text();
  const html = rawHtml.slice(0, 3 * 1024 * 1024);

  // Extract Page Title
  let pageTitle = '';
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const standardTitleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (ogTitleMatch && ogTitleMatch[1]) {
    pageTitle = ogTitleMatch[1].trim();
  } else if (standardTitleMatch && standardTitleMatch[1]) {
    pageTitle = standardTitleMatch[1].trim();
  }
  if (!pageTitle) {
    pageTitle = parsedTarget.hostname;
  }

  // Extract Page Poster / Image
  let mainPoster: string | undefined;
  const ogImageMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (ogImageMatch && ogImageMatch[1]) {
    const resolved = resolveUrl(ogImageMatch[1], finalUrl);
    if (resolved) mainPoster = resolved;
  }

  const extractedVideos: ExtractedVideoItem[] = [];
  const seenUrls = new Set<string>();

  const addVideo = (
    rawSrc: string,
    rawPoster: string | undefined,
    title: string,
    source: ExtractedVideoItem['source']
  ) => {
    const streamUrl = resolveUrl(rawSrc, finalUrl);
    if (!streamUrl) return;

    if (
      streamUrl.includes('google-analytics') ||
      streamUrl.includes('doubleclick') ||
      streamUrl.includes('facebook.com') ||
      streamUrl.includes('adservice')
    ) {
      return;
    }

    if (seenUrls.has(streamUrl)) return;
    seenUrls.add(streamUrl);

    const posterUrl = rawPoster ? resolveUrl(rawPoster, finalUrl) || mainPoster : mainPoster;
    const { format, mimeType } = getFormatAndMime(streamUrl);
    const id = Buffer.from(streamUrl).toString('base64url').slice(0, 16);
    const proxyStreamUrl = `/api/tools/proxy-stream?url=${encodeURIComponent(streamUrl)}&referer=${encodeURIComponent(finalUrl)}`;

    extractedVideos.push({
      id,
      title: title || `${pageTitle} - Video ${extractedVideos.length + 1}`,
      streamUrl,
      proxyStreamUrl,
      posterUrl,
      mimeType,
      format,
      source,
    });
  };

  // --- A. HTML5 <video> & <source> tags ---
  const videoTagRegex = /<video([^>]*)>([\s\S]*?)<\/video>/gi;
  let videoMatch: RegExpExecArray | null;

  while ((videoMatch = videoTagRegex.exec(html)) !== null) {
    const videoAttrs = videoMatch[1] || '';
    const videoBody = videoMatch[2] || '';
    const posterAttr = videoAttrs.match(/poster=["']([^"']+)["']/i)?.[1];
    const srcAttr = videoAttrs.match(/src=["']([^"']+)["']/i)?.[1];
    if (srcAttr) {
      addVideo(srcAttr, posterAttr, pageTitle, 'html5');
    }

    const sourceRegex = /<source[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let sourceMatch: RegExpExecArray | null;
    while ((sourceMatch = sourceRegex.exec(videoBody)) !== null) {
      if (sourceMatch[1]) {
        addVideo(sourceMatch[1], posterAttr, pageTitle, 'html5');
      }
    }
  }

  const standaloneVideoRegex = /<video[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let standaloneMatch: RegExpExecArray | null;
  while ((standaloneMatch = standaloneVideoRegex.exec(html)) !== null) {
    const posterAttr = standaloneMatch[0].match(/poster=["']([^"']+)["']/i)?.[1];
    if (standaloneMatch[1]) {
      addVideo(standaloneMatch[1], posterAttr, pageTitle, 'html5');
    }
  }

  // --- B. OpenGraph & Twitter tags ---
  const ogVideoRegex = /<meta[^>]+(?:property|name)=["'](?:og:video|og:video:url|og:video:secure_url|twitter:player:stream)["'][^>]+content=["']([^"']+)["']/gi;
  let ogMatch: RegExpExecArray | null;
  while ((ogMatch = ogVideoRegex.exec(html)) !== null) {
    if (ogMatch[1]) {
      addVideo(ogMatch[1], mainPoster, pageTitle, 'opengraph');
    }
  }

  // --- C. JSON-LD VideoObject ---
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonMatch: RegExpExecArray | null;
  while ((jsonMatch = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonContent = jsonMatch[1].trim();
      const parsed = JSON.parse(jsonContent);

      const checkObject = (obj: any) => {
        if (!obj || typeof obj !== 'object') return;
        const type = obj['@type'];
        if (type === 'VideoObject' || (Array.isArray(type) && type.includes('VideoObject'))) {
          const contentUrl = obj.contentUrl || obj.embedUrl;
          const thumb = Array.isArray(obj.thumbnailUrl)
            ? obj.thumbnailUrl[0]
            : obj.thumbnailUrl || obj.thumbnail;
          const title = obj.name || obj.headline || pageTitle;

          if (contentUrl && typeof contentUrl === 'string') {
            addVideo(contentUrl, thumb, title, 'jsonld');
          }
        }

        if (Array.isArray(obj['@graph'])) obj['@graph'].forEach(checkObject);
        if (Array.isArray(obj.itemListElement)) obj.itemListElement.forEach((item: any) => checkObject(item.item || item));
      };

      if (Array.isArray(parsed)) parsed.forEach(checkObject);
      else checkObject(parsed);
    } catch {}
  }

  // --- D. Inline script video streams ---
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  let sMatch: RegExpExecArray | null;
  while ((sMatch = scriptRegex.exec(html)) !== null) {
    const scriptCode = sMatch[1];
    if (!scriptCode || scriptCode.length > 500000) continue;

    const urlInScriptRegex = /(https?:\/\/[^\s"'<>\\]+?\.(?:mp4|m3u8|webm)(?:\?[^\s"'<>\\]*)?)/gi;
    let urlMatch: RegExpExecArray | null;
    while ((urlMatch = urlInScriptRegex.exec(scriptCode)) !== null) {
      const foundUrl = urlMatch[1];
      if (!foundUrl.includes('.js') && !foundUrl.includes('.css')) {
        addVideo(foundUrl, mainPoster, pageTitle, 'script');
      }
    }
  }

  // --- E. Anchor tags pointing to video files ---
  const anchorRegex = /<a[^>]+href=["']([^"']+\.(?:mp4|webm|m3u8|mov|mkv)(?:\?[^"']*)?)["'][^>]*>(.*?)<\/a>/gi;
  let aMatch: RegExpExecArray | null;
  while ((aMatch = anchorRegex.exec(html)) !== null) {
    const href = aMatch[1];
    const linkText = aMatch[2]?.replace(/<[^>]+>/g, '').trim();
    addVideo(href, mainPoster, linkText || pageTitle, 'link');
  }

  return {
    pageTitle,
    pageUrl: finalUrl,
    posterUrl: mainPoster,
    count: extractedVideos.length,
    videos: extractedVideos,
  };
}
