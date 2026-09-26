/**
 * Sayfa dolaşımı ve Chromium render sırasında gerçekleşen dinamik
 * XHR/Fetch/GraphQL isteklerini yakalar ve çevrimdışı mock veritabanına dönüştürür.
 */

export interface CapturedApiEndpoint {
  url: string;
  pathname: string;
  method: string;
  status: number;
  contentType: string;
  requestBody?: any;
  responseData: any;
  timestamp: number;
}

export interface MockEndpointEntry {
  status: number;
  contentType: string;
  data: any;
  updatedAt: number;
}

export type MockDatabase = Record<string, Record<string, MockEndpointEntry>>;

export class ApiTrafficInterceptor {
  private endpoints: Map<string, CapturedApiEndpoint> = new Map();

  public record(endpoint: CapturedApiEndpoint): void {
    const key = `${endpoint.method.toUpperCase()}:${endpoint.pathname}`;
    this.endpoints.set(key, endpoint);
  }

  public getEndpoints(): CapturedApiEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  public exportMockDatabase(): MockDatabase {
    const db: MockDatabase = {};

    for (const endpoint of this.endpoints.values()) {
      let path = endpoint.pathname;
      if (!path.startsWith('/')) {
        path = `/${path}`;
      }
      path = path.replace(/\/+$/, '') || '/';

      if (!db[path]) {
        db[path] = {};
      }

      const method = endpoint.method.toUpperCase();
      db[path][method] = {
        status: endpoint.status || 200,
        contentType: endpoint.contentType || 'application/json',
        data: endpoint.responseData,
        updatedAt: endpoint.timestamp,
      };
    }

    return db;
  }
}

export function findMockResponse(
  db: MockDatabase,
  requestPath: string,
  requestMethod: string
): MockEndpointEntry | null {
  if (!db || typeof db !== 'object') return null;

  const normalizedPath = (requestPath.startsWith('/') ? requestPath : `/${requestPath}`)
    .replace(/\/+$/, '') || '/';
  const method = (requestMethod || 'GET').toUpperCase();

  // 1. Birebir eşleşme
  if (db[normalizedPath] && db[normalizedPath][method]) {
    return db[normalizedPath][method];
  }

  // 2. Trailing slash varyasyonu
  const altPath = normalizedPath.endsWith('/') ? normalizedPath.slice(0, -1) : `${normalizedPath}/`;
  if (db[altPath] && db[altPath][method]) {
    return db[altPath][method];
  }

  // 3. Case-insensitive eşleşme
  const lowerPath = normalizedPath.toLowerCase();
  for (const [key, methods] of Object.entries(db)) {
    if (key.toLowerCase() === lowerPath && methods[method]) {
      return methods[method];
    }
  }

  return null;
}
