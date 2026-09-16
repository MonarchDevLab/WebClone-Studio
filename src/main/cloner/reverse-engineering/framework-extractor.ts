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

  return state;
}
