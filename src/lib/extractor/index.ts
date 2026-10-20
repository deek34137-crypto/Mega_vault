export interface ExtractedVideoItem {
  id: string;
  title: string;
  streamUrl: string;
  proxyStreamUrl: string;
  posterUrl?: string;
  mimeType: string;
  format: string;
  source: 'direct' | 'html5' | 'opengraph' | 'jsonld' | 'script' | 'link' | 'channel-card' | 'iframe';
}

export interface ExtractedSection {
  id: string;
  name: string;
  url: string;
}

export interface ExtractionResult {
  pageTitle: string;
  pageUrl: string;
  posterUrl?: string;
  count: number;
  videos: ExtractedVideoItem[];
  sections?: ExtractedSection[];
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

export function unwrapNextImage(src: string, baseUrl: string): string | undefined {
  try {
    if (!src) return undefined;
    if (src.includes('/_next/image')) {
      const parsed = new URL(src, baseUrl);
      const urlParam = parsed.searchParams.get('url');
      if (urlParam) return decodeURIComponent(urlParam);
    }
    return resolveUrl(src, baseUrl) || undefined;
  } catch {
    return resolveUrl(src, baseUrl) || undefined;
  }
}

export function cleanTitleText(str: string): string {
  if (!str) return 'Video';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;|&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

interface ResolvedStreamResult {
  stream: string;
  poster?: string;
  title?: string;
  source: ExtractedVideoItem['source'];
}

// Deep resolver for a single video page or iframe
export async function resolvePageStream(pageUrl: string, referer?: string): Promise<ResolvedStreamResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    if (referer) headers['Referer'] = referer;

    let res: Response;
    try {
      res = await fetch(pageUrl, {
        signal: controller.signal,
        headers,
        redirect: 'follow',
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) return null;
    const finalUrl = res.url || pageUrl;
    const finalParsed = new URL(finalUrl);
    if (isPrivateOrLocalHost(finalParsed.hostname)) return null;

    const html = (await res.text()).slice(0, 3 * 1024 * 1024);

    // 1. html5player setters (XNXX, XHamster, etc.)
    const highMatch = html.match(/html5player\.setVideoUrlHigh\(['"]([^'"]+)['"]\)/i);
    const hlsMatch = html.match(/html5player\.setVideoHLS\(['"]([^'"]+)['"]\)/i);
    const lowMatch = html.match(/html5player\.setVideoUrlLow\(['"]([^'"]+)['"]\)/i);
    const thumbMatch = html.match(/html5player\.setThumbUrl(?:169)?\(['"]([^'"]+)['"]\)/i);
    const titleMatch = html.match(/html5player\.setVideoTitle\(['"]([^'"]+)['"]\)/i);

    if (highMatch || hlsMatch || lowMatch) {
      const rawStream = highMatch?.[1] || hlsMatch?.[1] || lowMatch?.[1];
      const stream = resolveUrl(rawStream!, finalUrl);
      if (stream) {
        const poster = thumbMatch ? resolveUrl(thumbMatch[1], finalUrl) || undefined : undefined;
        const title = titleMatch ? cleanTitleText(titleMatch[1]) : undefined;
        return { stream, poster, title, source: 'script' };
      }
    }

    // 2. Base64 & Child Embed Iframes (Desihub downloaddirect, Mastiraja clean-tube-player, etc.)
    const iframeMatches = [...html.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi)];
    for (const m of iframeMatches) {
      const iframeSrc = m[1];
      if (
        iframeSrc.includes('q=') ||
        iframeSrc.includes('player') ||
        iframeSrc.includes('embed') ||
        iframeSrc.includes('video')
      ) {
        // 2a. Check for base64 encoded query parameter
        try {
          const u = new URL(iframeSrc, finalUrl);
          const q = u.searchParams.get('q');
          if (q) {
            const decoded = Buffer.from(q, 'base64').toString('utf8');
            const sourceMatch = decoded.match(/src=["']([^"']+\.(?:mp4|m3u8)[^"']*)["']/i);
            const posterMatch = decoded.match(/poster=["']([^"']+)["']/i);
            if (sourceMatch) {
              const stream = resolveUrl(sourceMatch[1], finalUrl);
              if (stream) {
                const poster = posterMatch ? resolveUrl(posterMatch[1], finalUrl) || undefined : undefined;
                return { stream, poster, source: 'iframe' };
              }
            }
          }
        } catch {}

        // 2b. Fetch external embed iframe (e.g. downloaddirect.xyz/embed/<uuid>)
        try {
          const embedUrl = resolveUrl(iframeSrc, finalUrl);
          if (embedUrl) {
            const embedParsed = new URL(embedUrl);
            if (!isPrivateOrLocalHost(embedParsed.hostname)) {
              const ifRes = await fetch(embedUrl, {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                  Referer: finalUrl,
                },
              });
              if (ifRes.ok) {
                const ifHtml = await ifRes.text();
                const srcMatch =
                  ifHtml.match(/<source[^>]+src=["']([^"']+)["']/i) ||
                  ifHtml.match(/<video[^>]+src=["']([^"']+)["']/i) ||
                  ifHtml.match(/(https?:\/\/[^\s"'<>\\]+?\.(?:mp4|m3u8)(?:\?[^\s"'<>\\]*)?)/i);
                const ifPoster = ifHtml.match(/poster=["']([^"']+)["']/i);
                if (srcMatch) {
                  const stream = resolveUrl(srcMatch[1], embedUrl);
                  if (stream) {
                    const poster = ifPoster ? resolveUrl(ifPoster[1], embedUrl) || undefined : undefined;
                    return { stream, poster, source: 'iframe' };
                  }
                }
              }
            }
          }
        } catch {}
      }
    }

    // 3. HTML5 <video> & <source> tags on the page
    const vMatch = html.match(/<video[^>]+src=["']([^"']+)["']/i) || html.match(/<source[^>]+src=["']([^"']+)["']/i);
    const posterAttr = html.match(/<video[^>]+poster=["']([^"']+)["']/i);
    if (vMatch) {
      const stream = resolveUrl(vMatch[1], finalUrl);
      if (stream) {
        const poster = posterAttr ? resolveUrl(posterAttr[1], finalUrl) || undefined : undefined;
        return { stream, poster, source: 'html5' };
      }
    }

    // 4. Player config scripts (JWPlayer / Plyr / VideoJS)
    const jwMatch = html.match(/['"]?file['"]?\s*:\s*['"]([^'"]+\.(?:mp4|m3u8|webm)[^'"]*)['"]/i) ||
                    html.match(/['"]?src['"]?\s*:\s*['"]([^'"]+\.(?:mp4|m3u8|webm)[^'"]*)['"]/i);
    if (jwMatch) {
      const stream = resolveUrl(jwMatch[1], finalUrl);
      if (stream) return { stream, source: 'script' };
    }

    // 5. Direct script stream URLs
    const scriptStream = html.match(/(https?:\/\/[^\s"'<>\\]+?\.(?:mp4|m3u8)(?:\?[^\s"'<>\\]*)?)/i);
    if (scriptStream && !scriptStream[1].includes('.js') && !scriptStream[1].includes('.css')) {
      const stream = resolveUrl(scriptStream[1], finalUrl);
      if (stream) return { stream, source: 'script' };
    }

    return null;
  } catch {
    return null;
  }
}

interface ListingCard {
  url: string;
  title: string;
  poster?: string;
}

// Extract listing cards from channel/index page
export function extractListingCards(html: string, baseUrl: string): ListingCard[] {
  const cards: ListingCard[] = [];
  const seenUrls = new Set<string>();

  // Pattern 1: XNXX class thumb-link / video links
  const xnxxHrefRegex = /<a[^>]+class=["'][^"']*thumb-link[^"']*["'][^>]+href=["'](\/video-[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let xm: RegExpExecArray | null;
  while ((xm = xnxxHrefRegex.exec(html)) !== null) {
    const postUrl = resolveUrl(xm[1], baseUrl);
    if (postUrl && !seenUrls.has(postUrl)) {
      seenUrls.add(postUrl);
      const inner = xm[2];
      const imgMatch = inner.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i);
      const altMatch = inner.match(/alt=["']([^"']+)["']/i);
      cards.push({
        url: postUrl,
        title: altMatch ? cleanTitleText(altMatch[1]) : 'Video',
        poster: imgMatch ? resolveUrl(imgMatch[1].replace(/\\\//g, '/'), baseUrl) || undefined : undefined,
      });
    }
  }

  // Pattern 2: Desihub & generic post links / Next.js cards
  const desihubRegex = /<a[^>]+href=["'](\/post\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let dm: RegExpExecArray | null;
  while ((dm = desihubRegex.exec(html)) !== null) {
    const postUrl = resolveUrl(dm[1], baseUrl);
    if (postUrl && !seenUrls.has(postUrl)) {
      seenUrls.add(postUrl);
      const inner = dm[2];
      const imgMatch = inner.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i);
      const poster = imgMatch ? unwrapNextImage(imgMatch[1], baseUrl) : undefined;
      const titleAttr = inner.match(/title=["']([^"']+)["']/i) || dm[0].match(/title=["']([^"']+)["']/i);
      let textTitle = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const rawTitle = titleAttr ? titleAttr[1] : (textTitle.length > 5 ? textTitle : 'Video');
      cards.push({
        url: postUrl,
        title: cleanTitleText(rawTitle),
        poster,
      });
    }
  }

  // Pattern 3: WordPress articles / tube video cards (Mastiraja, etc.)
  const wpRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let wpm: RegExpExecArray | null;
  while ((wpm = wpRegex.exec(html)) !== null) {
    const art = wpm[1];
    const linkMatch = art.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (linkMatch) {
      const postUrl = resolveUrl(linkMatch[1], baseUrl);
      if (postUrl && !seenUrls.has(postUrl) && !postUrl.includes('/category/') && !postUrl.includes('/tag/')) {
        seenUrls.add(postUrl);
        const imgMatch = art.match(/<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["']/i);
        const poster = imgMatch ? unwrapNextImage(imgMatch[1], baseUrl) : undefined;
        const titleMatch = art.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i) || art.match(/title=["']([^"']+)["']/i);
        const rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Video';
        cards.push({
          url: postUrl,
          title: cleanTitleText(rawTitle),
          poster,
        });
      }
    }
  }

  // Pattern 4: Generic card heuristic if no cards found yet
  if (cards.length === 0) {
    const genericLinkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let gm: RegExpExecArray | null;
    while ((gm = genericLinkRegex.exec(html)) !== null) {
      const href = gm[1];
      const inner = gm[2];
      if (
        (href.includes('/video') || href.includes('/watch') || href.includes('/post') || href.includes('.html')) &&
        !href.includes('/tag/') &&
        !href.includes('/category/') &&
        !href.startsWith('#') &&
        !href.startsWith('javascript:')
      ) {
        const postUrl = resolveUrl(href, baseUrl);
        if (postUrl && !seenUrls.has(postUrl)) {
          seenUrls.add(postUrl);
          const imgMatch = inner.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/i);
          const poster = imgMatch ? unwrapNextImage(imgMatch[1], baseUrl) : undefined;
          const cleanText = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          cards.push({
            url: postUrl,
            title: cleanTitleText(cleanText.length > 5 ? cleanText : 'Video'),
            poster,
          });
        }
      }
    }
  }

  return cards;
}

export function cleanSectionName(name: string): string {
  return name
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;|&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\w\s&'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractSiteSections(html: string, baseUrl: string): ExtractedSection[] {
  const sections: ExtractedSection[] = [
    { id: 'home', name: 'Homepage (All)', url: baseUrl }
  ];
  const seenUrls = new Set<string>([baseUrl.replace(/\/+$/, '')]);

  const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const m of links) {
    const rawHref = m[1];
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

    if (
      !rawHref ||
      rawHref.startsWith('#') ||
      rawHref.startsWith('javascript:') ||
      rawHref.startsWith('tg:') ||
      rawHref.startsWith('mailto:')
    ) {
      continue;
    }

    try {
      const fullUrl = new URL(rawHref, baseUrl).href;
      const cleanUrl = fullUrl.replace(/\/+$/, '');
      if (seenUrls.has(cleanUrl)) continue;

      const path = new URL(fullUrl).pathname.toLowerCase();
      const search = new URL(fullUrl).search.toLowerCase();

      let isSection = false;
      let matchedName = text;

      // Special known sections
      if (path.includes('/explore')) {
        isSection = true;
        if (!matchedName || matchedName.length > 20) matchedName = 'Explore';
      } else if (path.includes('/feed')) {
        isSection = true;
        if (!matchedName || matchedName.length > 20) matchedName = 'Feed';
      } else if (path.includes('/popular') || search.includes('filter=popular')) {
        isSection = true;
        if (!matchedName || matchedName.length > 20) matchedName = 'Popular';
      } else if (path.includes('/trending')) {
        isSection = true;
        if (!matchedName || matchedName.length > 20) matchedName = 'Trending';
      } else if (path.includes('/hits')) {
        isSection = true;
        if (!matchedName || matchedName.length > 20) matchedName = 'Hits';
      } else if (path.includes('/best')) {
        isSection = true;
        if (!matchedName || matchedName.length > 20) matchedName = 'Best Of';
      } else if (path.includes('/todays-selection')) {
        isSection = true;
        if (!matchedName || matchedName.length > 20) matchedName = "Today's Selection";
      } else if (path.includes('/category/') || path.includes('/categories/')) {
        isSection = true;
        if (!matchedName || matchedName.length > 25) {
          const catSlug = path.split('/category/')[1]?.split('/')[0] || 'Category';
          matchedName = catSlug.replace(/[-_]/g, ' ');
        }
      } else if (
        text.toLowerCase() === 'explore' ||
        text.toLowerCase() === 'feed' ||
        text.toLowerCase() === 'popular' ||
        text.toLowerCase() === 'trending' ||
        text.toLowerCase() === 'best' ||
        text.toLowerCase() === 'hits'
      ) {
        isSection = true;
      }

      if (isSection && matchedName && matchedName.length <= 30 && !path.includes('/post/') && !path.includes('/video-')) {
        seenUrls.add(cleanUrl);
        const cleanedTitle = cleanSectionName(matchedName);
        const id = 'sec_' + Buffer.from(cleanUrl).toString('base64url').slice(0, 10);
        sections.push({
          id,
          name: cleanedTitle,
          url: fullUrl,
        });
      }
    } catch {}
  }

  return sections.slice(0, 15);
}

export function buildPagedUrl(baseUrl: string, page: number): string {
  const clean = baseUrl.trim();
  if (page <= 1) return clean;

  const parsed = new URL(clean);
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  // Desihub specific
  if (host.includes('desihub')) {
    if (path.includes('/explore/')) {
      return new URL(path.replace(/\/explore\/\d+/, `/explore/${page}`) + parsed.search, parsed.origin).href;
    }
    return new URL(`/explore/${page}`, parsed.origin).href;
  }

  // XNXX specific
  if (host.includes('xnxx')) {
    const cleanPath = path.replace(/\/+$/, '');
    if (cleanPath.match(/\/\d+$/)) {
      return new URL(cleanPath.replace(/\/\d+$/, `/${page - 1}`) + parsed.search, parsed.origin).href;
    }
    return new URL(`${cleanPath}/${page - 1}` + parsed.search, parsed.origin).href;
  }

  // WordPress / standard pagination (/page/2/)
  if (path.includes('/page/')) {
    const newPath = path.replace(/\/page\/\d+\/?/, `/page/${page}/`);
    return new URL(newPath + parsed.search, parsed.origin).href;
  }

  // Path ending in number (e.g. /category/12)
  if (path.match(/\/\d+\/?$/) && !path.includes('/post/') && !path.includes('/video-')) {
    const newPath = path.replace(/\/\d+\/?$/, `/${page}/`);
    return new URL(newPath + parsed.search, parsed.origin).href;
  }

  // URL has query param page or p
  if (parsed.searchParams.has('page') || parsed.searchParams.has('p')) {
    const nextParsed = new URL(clean);
    if (nextParsed.searchParams.has('page')) nextParsed.searchParams.set('page', String(page));
    if (nextParsed.searchParams.has('p')) nextParsed.searchParams.set('p', String(page));
    return nextParsed.href;
  }

  // Default WordPress style /page/N/
  const cleanPath = path.replace(/\/+$/, '');
  return new URL(`${cleanPath}/page/${page}/` + parsed.search, parsed.origin).href;
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
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
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
  let html = rawHtml.slice(0, 3 * 1024 * 1024);

  // Extract Page Title
  let pageTitle = '';
  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  const standardTitleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (ogTitleMatch && ogTitleMatch[1]) {
    pageTitle = cleanTitleText(ogTitleMatch[1]);
  } else if (standardTitleMatch && standardTitleMatch[1]) {
    pageTitle = cleanTitleText(standardTitleMatch[1]);
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
    source: ExtractedVideoItem['source'],
    customReferer?: string
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
    const refererToUse = customReferer || finalUrl;
    const proxyStreamUrl = `/api/tools/proxy-stream?url=${encodeURIComponent(streamUrl)}&referer=${encodeURIComponent(refererToUse)}`;

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

  // --- Step 1: Check if the current page itself contains a direct single video player ---
  const singleStream = await resolvePageStream(finalUrl);
  if (singleStream && singleStream.stream) {
    addVideo(
      singleStream.stream,
      singleStream.poster || mainPoster,
      singleStream.title || pageTitle,
      singleStream.source
    );
  }

  // --- Step 2: HTML5 <video> & <source> tags on root page ---
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

  // --- Step 3: OpenGraph & Twitter tags ---
  const ogVideoRegex = /<meta[^>]+(?:property|name)=["'](?:og:video|og:video:url|og:video:secure_url|twitter:player:stream)["'][^>]+content=["']([^"']+)["']/gi;
  let ogMatch: RegExpExecArray | null;
  while ((ogMatch = ogVideoRegex.exec(html)) !== null) {
    if (ogMatch[1]) {
      addVideo(ogMatch[1], mainPoster, pageTitle, 'opengraph');
    }
  }

  // --- Step 4: JSON-LD VideoObject ---
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
            addVideo(contentUrl, thumb, cleanTitleText(title), 'jsonld');
          }
        }

        if (Array.isArray(obj['@graph'])) obj['@graph'].forEach(checkObject);
        if (Array.isArray(obj.itemListElement)) obj.itemListElement.forEach((item: any) => checkObject(item.item || item));
      };

      if (Array.isArray(parsed)) parsed.forEach(checkObject);
      else checkObject(parsed);
    } catch {}
  }

  // --- Step 5: Listing Cards Resolution (If root is a channel/listing page like desihub.sh, mastiraja.io, xnxx.health) ---
  if (extractedVideos.length === 0) {
    let cards = extractListingCards(html, finalUrl);

    // If 0 cards and page is a portal/directory like xnxx.health, auto-follow top feed link
    if (cards.length === 0) {
      const feedLinks = ['/hits', '/best', '/todays-selection', '/trending', '/videos', '/all-videos'];
      for (const feed of feedLinks) {
        if (html.includes(feed)) {
          const feedUrl = resolveUrl(feed, finalUrl);
          if (feedUrl) {
            try {
              const feedRes = await fetch(feedUrl, {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                },
              });
              if (feedRes.ok) {
                const feedHtml = await feedRes.text();
                cards = extractListingCards(feedHtml, feedRes.url || feedUrl);
                if (cards.length > 0) break;
              }
            } catch {}
          }
        }
      }
    }

    if (cards.length > 0) {
      // Resolve up to 16 cards concurrently in batches of 4
      const topCards = cards.slice(0, 16);
      const batchSize = 4;

      for (let i = 0; i < topCards.length; i += batchSize) {
        const batch = topCards.slice(i, i + batchSize);
        const resolvedBatch = await Promise.all(
          batch.map(async (card) => {
            const resStream = await resolvePageStream(card.url, finalUrl);
            if (resStream && resStream.stream) {
              return {
                title: resStream.title || card.title,
                streamUrl: resStream.stream,
                posterUrl: resStream.poster || card.poster || mainPoster,
                source: resStream.source,
                cardUrl: card.url,
              };
            }
            return null;
          })
        );

        for (const item of resolvedBatch) {
          if (item) {
            addVideo(item.streamUrl, item.posterUrl, item.title, 'channel-card', item.cardUrl);
          }
        }
      }
    }
  }

  // Update main poster if none set
  if (!mainPoster && extractedVideos.length > 0 && extractedVideos[0].posterUrl) {
    mainPoster = extractedVideos[0].posterUrl;
  }

  // Extract site navigation sections & categories
  const sections = extractSiteSections(html, finalUrl);

  return {
    pageTitle,
    pageUrl: finalUrl,
    posterUrl: mainPoster,
    count: extractedVideos.length,
    videos: extractedVideos,
    sections,
  };
}
