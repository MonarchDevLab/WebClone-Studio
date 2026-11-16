import * as cheerio from 'cheerio';

function extractNextRscPayloads(scriptText: string): Array<unknown> {
  const payloads: Array<unknown> = [];
  const marker = '__next_f.push(';
  let searchFrom = 0;

  while (searchFrom < scriptText.length) {
    const markerIdx = scriptText.indexOf(marker, searchFrom);
    if (markerIdx === -1) break;

    let cursor = markerIdx + marker.length;
    while (cursor < scriptText.length && /\s/.test(scriptText[cursor])) cursor++;

    if (scriptText[cursor] !== '[') {
      searchFrom = cursor + 1;
      continue;
    }

    let depth = 0;
    let quote: '"' | "'" | null = null;
    let escaped = false;
    let endIdx = -1;

    for (let i = cursor; i < scriptText.length; i++) {
      const ch = scriptText[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        continue;
      }
      if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          endIdx = i + 1;
          break;
        }
      }
    }

    if (endIdx === -1) break;

    const jsonSlice = scriptText.slice(cursor, endIdx);
    try {
      const parsed = JSON.parse(jsonSlice);
      payloads.push(parsed);
    } catch {
      payloads.push(jsonSlice);
    }

    searchFrom = endIdx;
  }

  return payloads;
}

/**
 * Extracts hydration and RSC Flight state payloads from SSR/SSG HTML documents.
 * Optionally reuses a pre-loaded Cheerio instance to avoid parsing large documents twice.
 */
export function extractFrameworkState(
  html: string,
  existing$?: cheerio.CheerioAPI
): Record<string, any> {
  const $ = existing$ || cheerio.load(html);
  const state: Record<string, any> = {};

  const nextData = $('#__NEXT_DATA__').html();
  if (nextData) {
    try {
      state.nextData = JSON.parse(nextData);
    } catch {
      // Ignore malformed JSON gracefully
    }
  }

  const nuxtData = $('#__NUXT_DATA__').html() || $('#__NUXT__').html();
  if (nuxtData) {
    try {
      state.nuxtData = JSON.parse(nuxtData);
    } catch {
      // Ignore malformed JSON gracefully
    }
  }

  const rscPayloads: Array<unknown> = [];

  $('script').each((_, el) => {
    const text = $(el).html() || '';
    if (text.includes('__INITIAL_STATE__') || text.includes('__PRELOADED_STATE__')) {
      const match = text.match(
        /(?:window\.)?(?:__INITIAL_STATE__|__PRELOADED_STATE__)\s*=\s*(\{[\s\S]*?\})(?:;|\n|$)/
      );
      if (match && match[1]) {
        try {
          state.initialState = JSON.parse(match[1]);
        } catch {}
      }
    }

    if (text.includes('__next_f.push(')) {
      const extracted = extractNextRscPayloads(text);
      if (extracted.length > 0) {
        rscPayloads.push(...extracted);
      }
    }
  });

  if (rscPayloads.length > 0) {
    state.nextRscPayloads = rscPayloads;
  }

  return state;
}
