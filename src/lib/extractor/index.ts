export interface ExtractedVideoItem {
  id: string;
  title: string;
  streamUrl: string;
  proxyStreamUrl: string;
  posterUrl?: string;
  quality?: string;
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

export interface ListingCard {
  url: string;
  title: string;
  poster?: string;
}

export interface ResolvedStreamResult {
  stream: string;
  poster?: string;
  title?: string;
  source: ExtractedVideoItem['source'];
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

export function cleanSectionName(name: string): string {
  return name
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;|&#039;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\w\s&'-]/g, '')
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

/**
 * Lightweight safe Dean Edwards p.a.c.k.e.r unpacker
 */
export function unpackPackedJs(packedCode: string): string | null {
  try {
    const packerRegex = /eval\(function\(p,a,c,k,e,[rd]\)\{.*?return p\}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/;
    const match = packedCode.match(packerRegex);
    if (!match) return null;

    let [, p, aStr, cStr, kStr] = match;
    const a = parseInt(aStr, 10);
    let c = parseInt(cStr, 10);
    const k = kStr.split('|');

    const encode = (val: number): string => {
      const prefix = val < a ? '' : encode(Math.floor(val / a));
      const rem = val % a;
      return prefix + (rem > 35 ? String.fromCharCode(rem + 29) : rem.toString(36));
    };

    while (c--) {
      if (k[c]) {
        const word = encode(c);
        p = p.replace(new RegExp('\\b' + word + '\\b', 'g'), k[c]);
      }
    }
    return p;
  } catch {
    return null;
  }
}

/**
 * Deep resolver for a single video page or iframe
 */
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

    // 2. Base64 & Child Embed Iframes (Desihub downloaddirect, Mastiraja clean-tube-player, Streamtape, StreamSB, etc.)
    const iframeMatches = [...html.matchAll(/<iframe[^>]+(?:src|data-src)=["']([^"']+)["']/gi)];
    for (const m of iframeMatches) {
      const iframeSrc = m[1];
      if (
        iframeSrc.includes('q=') ||
        iframeSrc.includes('player') ||
        iframeSrc.includes('embed') ||
        iframeSrc.includes('video') ||
        iframeSrc.includes('streamtape') ||
        iframeSrc.includes('streamsb') ||
        iframeSrc.includes('sbembed') ||
        iframeSrc.includes('dood') ||
        iframeSrc.includes('mixdrop') ||
        iframeSrc.includes('supervideo')
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

        // 2b. Fetch external embed iframe
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

                // Check HTML5 video/source inside iframe
                const srcMatch =
                  ifHtml.match(/<source[^>]+src=["']([^"']+)["']/i) ||
                  ifHtml.match(/<video[^>]+src=["']([^"']+)["']/i) ||
                  ifHtml.match(/sources\s*:\s*\[[\s\S]*?file\s*:\s*['"]([^'"]+\.(?:mp4|m3u8|webm)[^'"]*)['"]/i) ||
                  ifHtml.match(/['"]?file['"]?\s*:\s*['"]([^'"]+\.(?:mp4|m3u8|webm)[^'"]*)['"]/i) ||
                  ifHtml.match(/(?:var|let|const|window\.[a-zA-Z0-9_$]+|[a-zA-Z0-9_$]+)\s*=\s*['"](https?:\/\/[^'"\s<>]+\.(?:mp4|m3u8|webm)(?:\?[^'"\s<>]*)?)['"]/i) ||
                  ifHtml.match(/(https?:\/\/[^\s"'<>\\]+?\.(?:mp4|m3u8)(?:\?[^\s"'<>\\]*)?)/i);

                const ifPoster = ifHtml.match(/poster=["']([^"']+)["']/i) || ifHtml.match(/image\s*:\s*['"]([^'"]+)['"]/i);

                if (srcMatch) {
                  const stream = resolveUrl(srcMatch[1], embedUrl);
                  if (stream && !stream.includes('.js') && !stream.includes('.css')) {
                    const poster = ifPoster ? resolveUrl(ifPoster[1], embedUrl) || undefined : undefined;
                    return { stream, poster, source: 'iframe' };
                  }
                }

                // Check packed script inside iframe
                const packedIf = ifHtml.match(/eval\(function\(p,a,c,k,e,[rd]\)\{[\s\S]*?\.split\('\|'\)\)\)/i);
                if (packedIf) {
                  const unpacked = unpackPackedJs(packedIf[0]);
                  if (unpacked) {
                    const unpackedSrc =
                      unpacked.match(/sources\s*:\s*\[[\s\S]*?file\s*:\s*['"]([^'"]+\.(?:mp4|m3u8|webm)[^'"]*)['"]/i) ||
                      unpacked.match(/['"]?file['"]?\s*:\s*['"]([^'"]+\.(?:mp4|m3u8|webm)[^'"]*)['"]/i) ||
                      unpacked.match(/(https?:\/\/[^\s"'<>\\]+?\.(?:mp4|m3u8)(?:\?[^\s"'<>\\]*)?)/i);
                    if (unpackedSrc) {
                      const stream = resolveUrl(unpackedSrc[1], embedUrl);
                      if (stream) return { stream, source: 'iframe' };
                    }
                  }
                }

                // Check Streamtape inside iframe
                const robotMatch =
                  ifHtml.match(/id=["'](?:robotlink|videolink)["'][^>]*>([^<]+)<\//i) ||
                  ifHtml.match(/document\.getElementById\(['"](?:robotlink|videolink)['"]\)\.innerHTML\s*=\s*['"]([^'"]+)['"]\s*(?:\+\s*['"]([^'"]+)['"])?/i);
                if (robotMatch) {
                  let partial = robotMatch[1];
                  if (robotMatch[2]) partial += robotMatch[2];
                  if (partial.startsWith('//')) partial = 'https:' + partial;
                  const stream = resolveUrl(partial, embedUrl);
                  if (stream) return { stream, source: 'iframe' };
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

    // 4. JWPlayer & Plyr patterns: file:, sources: [{file:...}]
    const jwSourcesMatch =
      html.match(/sources\s*:\s*\[[\s\S]*?file\s*:\s*['"]([^'"]+\.(?:mp4|m3u8|webm)[^'"]*)['"]/i) ||
      html.match(/sources\s*:\s*\[\s*\{[^}]*?file\s*:\s*['"]([^'"]+)['"]/i) ||
      html.match(/sources\s*:\s*\[\s*\{[^}]*?src\s*:\s*['"]([^'"]+)['"]/i);
    const jwPosterMatch = html.match(/image\s*:\s*['"]([^'"]+)['"]/i);

    if (jwSourcesMatch) {
      const stream = resolveUrl(jwSourcesMatch[1], finalUrl);
      if (stream) {
        const poster = jwPosterMatch ? resolveUrl(jwPosterMatch[1], finalUrl) || undefined : undefined;
        return { stream, poster, source: 'script' };
      }
    }

    const jwFileMatch =
      html.match(/['"]?file['"]?\s*:\s*['"]([^'"]+\.(?:mp4|m3u8|webm)[^'"]*)['"]/i) ||
      html.match(/['"]?src['"]?\s*:\s*['"]([^'"]+\.(?:mp4|m3u8|webm)[^'"]*)['"]/i);
    if (jwFileMatch) {
      const stream = resolveUrl(jwFileMatch[1], finalUrl);
      if (stream) {
        const poster = jwPosterMatch ? resolveUrl(jwPosterMatch[1], finalUrl) || undefined : undefined;
        return { stream, poster, source: 'script' };
      }
    }

    // 5. Streamtape / StreamSB style player scripts on page
    const streamtapeMatch =
      html.match(/document\.getElementById\(['"](?:robotlink|videolink|ideostream)['"]\)\.innerHTML\s*=\s*['"]([^'"]+)['"]\s*(?:\+\s*['"]([^'"]+)['"])?/i) ||
      html.match(/id=["'](?:robotlink|videolink)["'][^>]*>([^<]+)<\//i);
    if (streamtapeMatch) {
      let partial = streamtapeMatch[1];
      if (streamtapeMatch[2]) partial += streamtapeMatch[2];
      if (partial.startsWith('//')) partial = 'https:' + partial;
      const stream = resolveUrl(partial, finalUrl);
      if (stream) return { stream, source: 'script' };
    }

    // 6. Any JS variable containing .mp4 or .m3u8 (e.g. var videoUrl = 'https://...')
    const jsVarMatch = html.match(
      /(?:var|let|const|window\.[a-zA-Z0-9_$]+|[a-zA-Z0-9_$]+)\s*=\s*['"](https?:\/\/[^'"\s<>]+\.(?:mp4|m3u8|webm)(?:\?[^'"\s<>]*)?)['"]/i
    );
    if (jsVarMatch) {
      const stream = resolveUrl(jsVarMatch[1], finalUrl);
      if (stream && !stream.includes('.js') && !stream.includes('.css')) {
        return { stream, source: 'script' };
      }
    }

    // JSON embedded object variables
    const jsonKeyMatch = html.match(
      /['"](?:contentUrl|videoUrl|video_url|streamUrl|stream_url|sourceUrl|source_url|fileUrl|file_url|hls_url|videoSrc)['"]\s*:\s*['"](https?:\/\/[^'"\s<>]+\.(?:mp4|m3u8|webm)(?:\?[^'"\s<>]*)?)['"]/i
    );
    if (jsonKeyMatch) {
      const stream = resolveUrl(jsonKeyMatch[1], finalUrl);
      if (stream) return { stream, source: 'script' };
    }

    // 7. Packed script unpacking (eval(function(p,a,c,k,e,d)...))
    const packedMatches = [...html.matchAll(/eval\(function\(p,a,c,k,e,[rd]\)\{[\s\S]*?\.split\('\|'\)\)\)/gi)];
    for (const pm of packedMatches) {
      const unpacked = unpackPackedJs(pm[0]);
      if (unpacked) {
        const unpackedSrc =
          unpacked.match(/sources\s*:\s*\[[\s\S]*?file\s*:\s*['"]([^'"]+\.(?:mp4|m3u8|webm)[^'"]*)['"]/i) ||
          unpacked.match(/['"]?file['"]?\s*:\s*['"]([^'"]+\.(?:mp4|m3u8|webm)[^'"]*)['"]/i) ||
          unpacked.match(/['"]?src['"]?\s*:\s*['"]([^'"]+\.(?:mp4|m3u8|webm)[^'"]*)['"]/i) ||
          unpacked.match(/(?:var|let|const|window\.[a-zA-Z0-9_$]+|[a-zA-Z0-9_$]+)\s*=\s*['"](https?:\/\/[^'"\s<>]+\.(?:mp4|m3u8|webm)(?:\?[^'"\s<>]*)?)['"]/i) ||
          unpacked.match(/(https?:\/\/[^\s"'<>\\]+?\.(?:mp4|m3u8)(?:\?[^\s"'<>\\]*)?)/i);
        if (unpackedSrc) {
          const stream = resolveUrl(unpackedSrc[1], finalUrl);
          if (stream && !stream.includes('.js') && !stream.includes('.css')) {
            return { stream, source: 'script' };
          }
        }
      }
    }

    // 8. Direct script stream URLs
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

/**
 * Universal Listing Cards Extractor
 * Extracts up to 40 video listing cards from channel, category, or index pages
 */
export function extractListingCards(html: string, baseUrl: string): ListingCard[] {
  const cards: ListingCard[] = [];
  const seenUrls = new Set<string>();

  let baseParsed: URL;
  try {
    baseParsed = new URL(baseUrl);
  } catch {
    return cards;
  }
  const baseHost = baseParsed.hostname.toLowerCase().replace(/^www\./, '');

  const isSameDomain = (urlStr: string): boolean => {
    try {
      const u = new URL(urlStr);
      const h = u.hostname.toLowerCase().replace(/^www\./, '');
      return h === baseHost || h.endsWith('.' + baseHost);
    } catch {
      return false;
    }
  };

  const isLikelyPostOrVideo = (href: string): boolean => {
    const lower = href.toLowerCase();
    if (
      lower.includes('/category/') ||
      lower.includes('/categories/') ||
      lower.includes('/tag/') ||
      lower.includes('/tags/') ||
      lower.includes('/genre/') ||
      lower.includes('/genres/') ||
      lower.includes('/channels/') ||
      lower.includes('/user/') ||
      lower.includes('/author/') ||
      lower.startsWith('#') ||
      lower.startsWith('javascript:')
    ) {
      return false;
    }
    return (
      lower.includes('/video') ||
      lower.includes('/watch') ||
      lower.includes('/post') ||
      lower.includes('/movie') ||
      lower.includes('/episode') ||
      lower.includes('/clip') ||
      lower.endsWith('.html') ||
      lower.includes('.html?')
    );
  };

  const extractPoster = (snippet: string): string | undefined => {
    const imgMatches = [
      ...snippet.matchAll(/<img[^>]+(?:data-src|data-lazy|data-original|data-lazy-src|data-src-retina|src)=["']([^"']+)["']/gi),
    ];
    for (const m of imgMatches) {
      let raw = m[1].replace(/\\\//g, '/').trim();
      if (raw.includes(',')) raw = raw.split(',')[0].trim().split(/\s+/)[0];
      if (
        !raw.startsWith('data:') &&
        !raw.startsWith('blob:') &&
        !raw.endsWith('.svg') &&
        !raw.includes('/avatar/') &&
        !raw.includes('/icon') &&
        !raw.includes('favicon')
      ) {
        const unwrapped = unwrapNextImage(raw, baseUrl);
        if (unwrapped) return unwrapped;
      }
    }
    const posterMatch = snippet.match(/poster=["']([^"']+)["']/i);
    if (posterMatch) {
      return resolveUrl(posterMatch[1], baseUrl) || undefined;
    }
    return undefined;
  };

  const extractTitle = (snippet: string, innerText?: string): string => {
    // 1. Heading tags
    const hMatch = snippet.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);
    if (hMatch) {
      const t = cleanTitleText(hMatch[1]);
      if (t.length > 2 && t !== 'Video') return t;
    }
    // 2. Title attribute
    const titleAttr = snippet.match(/title=["']([^"']+)["']/i);
    if (titleAttr) {
      const t = cleanTitleText(titleAttr[1]);
      if (t.length > 2 && t !== 'Video') return t;
    }
    // 3. Alt attribute
    const altAttr = snippet.match(/alt=["']([^"']+)["']/i);
    if (altAttr) {
      const t = cleanTitleText(altAttr[1]);
      if (t.length > 2 && t !== 'Video') return t;
    }
    // 4. Inner link text
    if (innerText) {
      const t = cleanTitleText(innerText);
      if (t.length > 3 && t !== 'Video') return t;
    }
    // 5. Clean text inside snippet
    const stripped = snippet.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (stripped.length > 4 && stripped.length < 120) {
      return cleanTitleText(stripped);
    }
    return 'Video';
  };

  const addCard = (cardUrl: string, title: string, poster?: string) => {
    if (cards.length >= 40) return;
    const resolved = resolveUrl(cardUrl, baseUrl);
    if (!resolved) return;
    const clean = resolved.replace(/\/+$/, '');
    if (seenUrls.has(clean)) return;
    if (!isSameDomain(clean)) return;

    seenUrls.add(clean);
    cards.push({
      url: resolved,
      title: title || 'Video',
      poster,
    });
  };

  // --- Priority 1: Containers (<article>, div class=*card*, div class=*item*, div class=*thumb*, li class=*video*) ---
  const containerRegex = /<(?:article|div|li)[^>]+class=["'][^"']*(?:card|item|thumb|video)[^"']*["'][^>]*>([\s\S]*?)<\/(?:article|div|li)>/gi;
  let cm: RegExpExecArray | null;
  while ((cm = containerRegex.exec(html)) !== null) {
    if (cards.length >= 40) break;
    const containerSnippet = cm[1];
    const linkMatches = [...containerSnippet.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    let bestLink = linkMatches.find((m) => isLikelyPostOrVideo(m[1]));
    if (!bestLink && linkMatches.length > 0) {
      bestLink = linkMatches.find((m) => /<img/i.test(m[2])) || linkMatches[0];
    }
    if (bestLink) {
      const href = bestLink[1];
      const poster = extractPoster(containerSnippet);
      const title = extractTitle(containerSnippet, bestLink[2]);
      addCard(href, title, poster);
    }
  }

  // Also check <article> tags without class restrictions
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let am: RegExpExecArray | null;
  while ((am = articleRegex.exec(html)) !== null) {
    if (cards.length >= 40) break;
    const artSnippet = am[1];
    const linkMatches = [...artSnippet.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    const bestLink = linkMatches.find((m) => isLikelyPostOrVideo(m[1])) || linkMatches[0];
    if (bestLink) {
      const href = bestLink[1];
      const poster = extractPoster(artSnippet);
      const title = extractTitle(artSnippet, bestLink[2]);
      addCard(href, title, poster);
    }
  }

  // --- Priority 2: <a> tags with href containing /video, /watch, /post, /movie, /episode, /clip, .html that contain an <img> child ---
  const linkWithImgRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let lm: RegExpExecArray | null;
  while ((lm = linkWithImgRegex.exec(html)) !== null) {
    if (cards.length >= 40) break;
    const href = lm[1];
    const inner = lm[2];
    if (/<img/i.test(inner) && isLikelyPostOrVideo(href)) {
      const poster = extractPoster(inner);
      const title = extractTitle(lm[0], inner);
      addCard(href, title, poster);
    }
  }

  // --- Priority 3: Any <a> with same-domain href that wraps an <img> element ---
  const anyLinkWithImgRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let alm: RegExpExecArray | null;
  while ((alm = anyLinkWithImgRegex.exec(html)) !== null) {
    if (cards.length >= 40) break;
    const href = alm[1];
    const inner = alm[2];
    if (/<img/i.test(inner)) {
      if (
        !href.startsWith('#') &&
        !href.startsWith('javascript:') &&
        !href.includes('/category/') &&
        !href.includes('/tag/')
      ) {
        const poster = extractPoster(inner);
        const title = extractTitle(alm[0], inner);
        addCard(href, title, poster);
      }
    }
  }

  return cards.slice(0, 40);
}

/**
 * Universal Section Extraction
 * Detects website navigation/menu links generically (up to 30 sections)
 */
export function extractSiteSections(html: string, baseUrl: string): ExtractedSection[] {
  const sections: ExtractedSection[] = [
    { id: 'home', name: 'Homepage (All)', url: baseUrl },
  ];
  const seenUrls = new Set<string>([baseUrl.replace(/\/+$/, '')]);
  const seenNames = new Set<string>(['homepage (all)', 'home']);

  let baseParsed: URL;
  try {
    baseParsed = new URL(baseUrl);
  } catch {
    return sections;
  }
  const baseHost = baseParsed.hostname.toLowerCase().replace(/^www\./, '');

  const isValidCandidate = (href: string) => {
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('javascript:') ||
      href.startsWith('mailto:') ||
      href.startsWith('tg:') ||
      href.startsWith('tel:')
    ) {
      return null;
    }
    try {
      const full = new URL(href, baseUrl);
      const host = full.hostname.toLowerCase().replace(/^www\./, '');
      if (host !== baseHost && !host.endsWith('.' + baseHost)) {
        return null;
      }
      const p = full.pathname.toLowerCase();
      // Must NOT contain post-level patterns
      if (
        p.includes('/post/') ||
        p.includes('/video-') ||
        p.includes('/watch/') ||
        p.includes('/article/') ||
        p.endsWith('.mp4') ||
        p.endsWith('.m3u8') ||
        p.endsWith('.jpg') ||
        p.endsWith('.png') ||
        p.endsWith('.webp') ||
        p.endsWith('.css') ||
        p.endsWith('.js')
      ) {
        return null;
      }
      return full;
    } catch {
      return null;
    }
  };

  const SECTION_KEYWORDS = [
    '/category/',
    '/categories/',
    '/genre/',
    '/genres/',
    '/tags/',
    '/tag/',
    '/explore',
    '/trending',
    '/popular',
    '/new',
    '/latest',
    '/best',
    '/hits',
    '/feed',
    '/browse',
    '/series',
    '/collections',
    '/playlists',
    '/all',
    '/top',
    '/channels',
    '/channels/',
    '/movies',
    '/videos',
  ];

  const NAV_WORDS = new Set([
    'home',
    'videos',
    'video',
    'movies',
    'movie',
    'series',
    'latest',
    'top',
    'new',
    'hot',
    'trending',
    'popular',
    'best',
    'hits',
    'explore',
    'browse',
    'feed',
    'channels',
    'categories',
    'category',
    'genres',
    'genre',
    'playlists',
    'collections',
    'all',
    'featured',
    'recent',
    'most viewed',
    'recommended',
    'top rated',
    'hall of fame',
    'tags',
    'all videos',
  ]);

  const IGNORE_WORDS = new Set([
    'privacy',
    'terms',
    'privacy policy',
    'terms of service',
    'dmca',
    'contact',
    'contact us',
    'about',
    'about us',
    'login',
    'log in',
    'sign in',
    'signup',
    'sign up',
    'register',
    'faq',
    'support',
    'help',
    'copyright',
    'disclaimer',
    'upload',
    'rss',
    'sitemap',
    '2257',
    'feedback',
    'cookie policy',
  ]);

  const tryAddSection = (rawHref: string, rawText: string, requirePattern = false): boolean => {
    if (sections.length >= 30) return false;

    const fullUrlObj = isValidCandidate(rawHref);
    if (!fullUrlObj) return false;

    const fullUrl = fullUrlObj.href;
    const cleanUrl = fullUrl.replace(/\/+$/, '');
    if (seenUrls.has(cleanUrl)) return false;

    let label = cleanSectionName(rawText);
    const path = fullUrlObj.pathname.toLowerCase();
    const search = fullUrlObj.search.toLowerCase();

    if (!label || label.length < 2) {
      const segments = path.split('/').filter(Boolean);
      const lastSeg = segments[segments.length - 1];
      if (lastSeg && !lastSeg.match(/^\d+$/)) {
        label = cleanSectionName(lastSeg.replace(/[-_]/g, ' '));
      }
    }

    if (!label || label.length < 2 || label.length > 30) return false;

    const lowerLabel = label.toLowerCase();
    if (IGNORE_WORDS.has(lowerLabel)) return false;
    if (seenNames.has(lowerLabel)) return false;

    if (requirePattern) {
      const matchesPattern = SECTION_KEYWORDS.some((kw) => path.includes(kw) || search.includes(kw.replace(/^\//, '')));
      const isNavWord = NAV_WORDS.has(lowerLabel);
      if (!matchesPattern && !isNavWord) return false;
    }

    const formattedLabel = label.charAt(0).toUpperCase() + label.slice(1);

    seenUrls.add(cleanUrl);
    seenNames.add(lowerLabel);
    const id = 'sec_' + Buffer.from(cleanUrl).toString('base64url').slice(0, 10);
    sections.push({
      id,
      name: formattedLabel,
      url: fullUrl,
    });
    return true;
  };

  // Phase 1: Parse <nav>, <header>, elements with class containing 'nav', 'menu', 'header', 'sidebar' first (priority zone)
  const priorityZonePatterns = [
    /<nav[^>]*>([\s\S]*?)<\/nav>/gi,
    /<header[^>]*>([\s\S]*?)<\/header>/gi,
    /<(?:div|aside|ul|ol|section)[^>]+class=["'][^"']*(?:nav|menu|header|sidebar)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|aside|ul|ol|section)>/gi,
  ];

  for (const zoneRegex of priorityZonePatterns) {
    let zoneMatch: RegExpExecArray | null;
    while ((zoneMatch = zoneRegex.exec(html)) !== null) {
      const zoneHtml = zoneMatch[1];
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let lm: RegExpExecArray | null;
      while ((lm = linkRegex.exec(zoneHtml)) !== null) {
        const href = lm[1];
        const innerText = lm[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const titleAttr = lm[0].match(/title=["']([^"']+)["']/i)?.[1] || '';
        const textToUse = innerText || titleAttr;
        tryAddSection(href, textToUse, false);
        if (sections.length >= 30) return sections;
      }
    }
  }

  // Phase 2: Fall back to ALL links in page (filtering by category/section patterns or nav words)
  const allLinksRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let am: RegExpExecArray | null;
  while ((am = allLinksRegex.exec(html)) !== null) {
    const href = am[1];
    const innerText = am[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const titleAttr = am[0].match(/title=["']([^"']+)["']/i)?.[1] || '';
    const textToUse = innerText || titleAttr;
    tryAddSection(href, textToUse, true);
    if (sections.length >= 30) return sections;
  }

  return sections;
}

/**
 * Universal Pagination URL Builder
 * Generates paged URLs for any website
 */
export function buildPagedUrl(baseUrl: string, page: number): string {
  const clean = baseUrl.trim();
  if (!clean) return clean;

  const targetPage = Math.max(1, page);

  try {
    const parsed = new URL(clean);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;

    // 1. If URL has ?page=N -> update page param
    if (parsed.searchParams.has('page')) {
      const nextParsed = new URL(clean);
      nextParsed.searchParams.set('page', String(targetPage));
      return nextParsed.href;
    }

    // 2. If URL has ?p=N -> update p param
    if (parsed.searchParams.has('p')) {
      const nextParsed = new URL(clean);
      nextParsed.searchParams.set('p', String(targetPage));
      return nextParsed.href;
    }

    // 3. Desihub /explore/N
    if (host.includes('desihub')) {
      if (path.includes('/explore/')) {
        const newPath = path.replace(/\/explore\/\d+/, `/explore/${targetPage}`);
        return new URL(newPath + parsed.search, parsed.origin).href;
      }
      return new URL(`/explore/${targetPage}` + parsed.search, parsed.origin).href;
    }

    // 4. XNXX (0-indexed page number at end of path)
    if (host.includes('xnxx')) {
      const xnxxPage = targetPage - 1;
      const cleanPath = path.replace(/\/+$/, '');
      if (cleanPath.match(/\/\d+$/)) {
        return new URL(cleanPath.replace(/\/\d+$/, `/${xnxxPage}`) + parsed.search, parsed.origin).href;
      }
      return new URL(`${cleanPath}/${xnxxPage}` + parsed.search, parsed.origin).href;
    }

    // 5. If path contains /page/N/ -> replace N
    if (path.match(/\/page\/\d+/i)) {
      const newPath = path.replace(/\/page\/\d+\/?/i, `/page/${targetPage}/`);
      return new URL(newPath + parsed.search, parsed.origin).href;
    }

    // 6. If path ends with /N (number, not video/post/watch/article) -> replace N
    const isPostOrVideo = /\/(?:post|video|watch|article|clip|item)[-_/]/i.test(path);
    if (!isPostOrVideo && path.match(/\/\d+\/?$/)) {
      const newPath = path.replace(/\/\d+\/?$/, `/${targetPage}/`);
      return new URL(newPath + parsed.search, parsed.origin).href;
    }

    // If page is 1 and no existing pagination in URL, return original clean URL
    if (targetPage === 1) {
      return clean;
    }

    // 7. Default: append /page/N/ to clean path
    const cleanPath = path.replace(/\/+$/, '');
    return new URL(`${cleanPath}/page/${targetPage}/` + parsed.search, parsed.origin).href;
  } catch {
    return clean;
  }
}

/**
 * Universal Video & Stream Extractor from Web Page
 */
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
  const html = rawHtml.slice(0, 3 * 1024 * 1024);

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
    const quality =
      streamUrl.includes('1080') ? '1080p FHD' :
      streamUrl.includes('720') ? '720p HD' :
      streamUrl.includes('480') ? '480p SD' :
      streamUrl.includes('hls') || streamUrl.endsWith('.m3u8') ? 'Auto HLS' : undefined;

    extractedVideos.push({
      id,
      title: title || `${pageTitle} - Video ${extractedVideos.length + 1}`,
      streamUrl,
      proxyStreamUrl,
      posterUrl,
      quality,
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

  // --- Step 5: Listing Cards Resolution (up to 40 cards, parallel batches of 6) ---
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
      // Resolve up to 40 cards concurrently in parallel batches of 6
      const topCards = cards.slice(0, 40);
      const batchSize = 6;

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

  // Extract site navigation sections & categories (up to 30)
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
