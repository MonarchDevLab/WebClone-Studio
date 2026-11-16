/**
 * Client-side Service Worker script served from `/_sw-replay.js` by PreviewServer.
 * Intercepts dynamic asset, image proxy, and JSON fetches in cloned pages and resolves them
 * through `_meta/url-map.json` (and `_meta/api-endpoints.json` fallback) for faithful offline replay.
 */
export function generateSwReplayScript(): string {
  return `/* WebClone Studio Offline Replay Service Worker */
const URL_MAP_PATH = '/_meta/url-map.json';
const API_MOCKS_PATH = '/_meta/api-endpoints.json';

let urlMapPromise = null;
let apiMocksPromise = null;

async function getUrlMap() {
  if (!urlMapPromise) {
    urlMapPromise = fetch(URL_MAP_PATH, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : {}))
      .then((raw) => {
        const index = new Map();
        if (raw && typeof raw === 'object') {
          for (const [origKey, localVal] of Object.entries(raw)) {
            if (typeof localVal !== 'string') continue;
            const normalizedLocal = localVal.startsWith('/') ? localVal : '/' + localVal;
            index.set(origKey, normalizedLocal);
            try {
              const u = new URL(origKey, self.location.origin);
              index.set(u.pathname + u.search, normalizedLocal);
              if (!index.has(u.pathname)) {
                index.set(u.pathname, normalizedLocal);
              }
            } catch {
              // ignore non-URL keys
            }
          }
        }
        return index;
      })
      .catch(() => new Map());
  }
  return urlMapPromise;
}

async function getApiMocks() {
  if (!apiMocksPromise) {
    apiMocksPromise = fetch(API_MOCKS_PATH, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null);
  }
  return apiMocksPromise;
}

function lookupLocalPath(index, requestUrl) {
  if (index.has(requestUrl)) return index.get(requestUrl);
  try {
    const parsed = new URL(requestUrl);
    const noHash = parsed.origin + parsed.pathname + parsed.search;
    if (index.has(noHash)) return index.get(noHash);
    const pathAndQuery = parsed.pathname + parsed.search;
    if (index.has(pathAndQuery)) return index.get(pathAndQuery);
    if (parsed.search) {
      const sorted = new URLSearchParams(parsed.search);
      sorted.sort();
      const canonical = parsed.pathname + '?' + sorted.toString();
      if (index.has(canonical)) return index.get(canonical);
    }
    if (index.has(parsed.pathname)) return index.get(parsed.pathname);
  } catch {
    // ignore malformed URL
  }
  return null;
}

function matchApiMock(db, method, requestUrl) {
  if (!db || typeof db !== 'object') return null;
  let pathname = requestUrl;
  try {
    const u = new URL(requestUrl);
    pathname = u.pathname || '/';
  } catch {
    // ignore
  }
  const pathKey = pathname.replace(/\\/+$/, '') || '/';
  const upperMethod = (method || 'GET').toUpperCase();
  const byPath = db[pathKey] || db[pathKey + '/'];
  if (byPath && byPath[upperMethod]) {
    return byPath[upperMethod];
  }
  return null;
}

self.addEventListener('install', (event) => {
  event.waitUntil(Promise.all([getUrlMap(), getApiMocks()]).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  let parsed;
  try {
    parsed = new URL(req.url);
  } catch {
    return;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return;
  if (
    parsed.origin === self.location.origin &&
    (parsed.pathname === '/_sw-replay.js' ||
      parsed.pathname === URL_MAP_PATH ||
      parsed.pathname === API_MOCKS_PATH)
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      const index = await getUrlMap();
      const mappedLocal = lookupLocalPath(index, req.url);
      if (mappedLocal && req.method === 'GET') {
        const localUrl = new URL(mappedLocal, self.location.origin);
        if (localUrl.pathname !== parsed.pathname || localUrl.origin !== self.location.origin) {
          const forwardHeaders = new Headers();
          const rangeHeader = req.headers.get('range');
          if (rangeHeader) forwardHeaders.set('range', rangeHeader);
          return fetch(new Request(localUrl.href, { method: 'GET', headers: forwardHeaders }));
        }
      }

      if (parsed.origin === self.location.origin) {
        return fetch(req);
      }

      // Cross-origin fallback: try recorded API mock before network failure
      const mockDb = await getApiMocks();
      const mockEntry = matchApiMock(mockDb, req.method, req.url);
      if (mockEntry) {
        const bodyStr =
          typeof mockEntry.data === 'string'
            ? mockEntry.data
            : JSON.stringify(mockEntry.data ?? null);
        return new Response(bodyStr, {
          status: mockEntry.status || 200,
          headers: {
            'Content-Type': mockEntry.contentType || 'application/json; charset=utf-8',
            'X-WebClone-Mock': 'sw-replay',
          },
        });
      }

      try {
        return await fetch(req);
      } catch {
        return new Response('', { status: 404, statusText: 'Offline Asset Not Captured' });
      }
    })()
  );
});
`;
}
