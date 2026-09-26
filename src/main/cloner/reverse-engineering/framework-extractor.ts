import * as cheerio from 'cheerio';

export function extractFrameworkState(html: string): Record<string, any> {
  const $ = cheerio.load(html);
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

  // window.__INITIAL_STATE__ veya window.__PRELOADED_STATE__ tespiti
  $('script').each((_, el) => {
    const text = $(el).html() || '';
    if (text.includes('__INITIAL_STATE__') || text.includes('__PRELOADED_STATE__')) {
      const match = text.match(/(?:window\.)?(?:__INITIAL_STATE__|__PRELOADED_STATE__)\s*=\s*(\{[\s\S]*?\})(?:;|\n|$)/);
      if (match && match[1]) {
        try {
          state.initialState = JSON.parse(match[1]);
        } catch {}
      }
    }
  });

  return state;
}
