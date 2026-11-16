import dns from 'node:dns';
import net from 'node:net';
import { validateHttpUrlShape } from '../../shared/validators';

export type DnsLookupFn = (
  hostname: string,
  options: { all: true }
) => Promise<Array<{ address: string; family: number }>>;

export interface UrlSafetyOptions {
  allowLocalhostTargets?: boolean;
  dnsLookup?: DnsLookupFn;
}

export interface IpCheckResult {
  blocked: boolean;
  reason?: string;
  isLoopback?: boolean;
}

function parseIpv4(ip: string): [number, number, number, number] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return [nums[0], nums[1], nums[2], nums[3]];
}

function normalizeIpv6MappedIpv4(rawIp: string): string {
  const ip = rawIp.trim().toLowerCase().split('%')[0];
  if (ip.startsWith('::ffff:')) {
    const tail = ip.slice(7);
    if (net.isIPv4(tail)) {
      return tail;
    }
    // Handle hex-encoded IPv4-mapped IPv6 such as ::ffff:7f00:0001
    const hexParts = tail.split(':');
    if (hexParts.length === 2) {
      const hi = parseInt(hexParts[0], 16);
      const lo = parseInt(hexParts[1], 16);
      if (Number.isInteger(hi) && Number.isInteger(lo)) {
        return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      }
    }
  }
  return ip;
}

/**
 * Checks whether an IPv4 or IPv6 literal falls into blocked metadata, loopback, or private ranges.
 */
export function isBlockedIpAddress(
  rawIp: string,
  allowLocalhostTargets: boolean = false
): IpCheckResult {
  const normalized = normalizeIpv6MappedIpv4(rawIp);

  const v4 = parseIpv4(normalized);
  if (v4) {
    const [a, b] = v4;

    // Cloud metadata & link-local (169.254.0.0/16), unspecified (0.0.0.0/8), CGNAT (100.64.0.0/10), multicast/reserved (>=224)
    if (a === 169 && b === 254) {
      return { blocked: true, reason: 'Link-local / cloud metadata range (169.254.0.0/16) is always blocked.' };
    }
    if (a === 0) {
      return { blocked: true, reason: 'Unspecified IPv4 range (0.0.0.0/8) is blocked.' };
    }
    if (a === 100 && b >= 64 && b <= 127) {
      return { blocked: true, reason: 'Shared CGNAT range (100.64.0.0/10) is blocked.' };
    }
    if (a >= 224) {
      return { blocked: true, reason: 'Multicast/reserved IPv4 range is blocked.' };
    }

    // Loopback (127.0.0.0/8)
    if (a === 127) {
      return allowLocalhostTargets
        ? { blocked: false, isLoopback: true }
        : { blocked: true, isLoopback: true, reason: 'Loopback target (127.0.0.0/8) is blocked by SSRF policy.' };
    }

    // RFC1918 private LAN (10/8, 172.16/12, 192.168/16)
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      return { blocked: true, reason: 'Private network RFC1918 IPv4 range is blocked by SSRF policy.' };
    }

    return { blocked: false };
  }

  // IPv6 checks
  const v6 = normalized;
  if (v6 === '::') {
    return { blocked: true, reason: 'Unspecified IPv6 address (::) is blocked.' };
  }
  if (v6.startsWith('fe80:') || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb')) {
    return { blocked: true, reason: 'Link-local IPv6 address (fe80::/10) is blocked.' };
  }
  if (v6.startsWith('ff')) {
    return { blocked: true, reason: 'Multicast IPv6 address (ff00::/8) is blocked.' };
  }
  if (v6 === '::1') {
    return allowLocalhostTargets
      ? { blocked: false, isLoopback: true }
      : { blocked: true, isLoopback: true, reason: 'Loopback IPv6 (::1) is blocked by SSRF policy.' };
  }
  // Unique Local Addresses fc00::/7 (fc.. or fd..)
  if (v6.startsWith('fc') || v6.startsWith('fd')) {
    return { blocked: true, reason: 'Unique local IPv6 range (fc00::/7) is blocked by SSRF policy.' };
  }

  return { blocked: false };
}

/**
 * Validates scheme, strips credentials, resolves DNS, and prevents SSRF against internal/metadata hosts.
 */
export async function assertSafeRemoteUrl(
  rawUrl: string,
  options: UrlSafetyOptions = {}
): Promise<URL> {
  const parsed = validateHttpUrlShape(rawUrl);
  const allowLocalhost = Boolean(options.allowLocalhostTargets);
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    if (!allowLocalhost) {
      throw new Error(`ERR_SSRF_BLOCKED: Localhost target "${hostname}" is blocked.`);
    }
    return parsed;
  }

  if (net.isIP(hostname) !== 0) {
    const check = isBlockedIpAddress(hostname, allowLocalhost);
    if (check.blocked) {
      throw new Error(`ERR_SSRF_BLOCKED: ${check.reason || hostname}`);
    }
    return parsed;
  }

  const lookupFn: DnsLookupFn =
    options.dnsLookup ||
    ((host, opts) => dns.promises.lookup(host, opts));

  let resolved: Array<{ address: string; family: number }>;
  try {
    resolved = await lookupFn(hostname, { all: true });
  } catch (err: any) {
    throw new Error(`ERR_INVALID_URL: DNS resolution failed for "${hostname}": ${err?.message || err}`);
  }

  if (!Array.isArray(resolved) || resolved.length === 0) {
    throw new Error(`ERR_INVALID_URL: No DNS records resolved for "${hostname}".`);
  }

  for (const record of resolved) {
    const check = isBlockedIpAddress(record.address, allowLocalhost);
    if (check.blocked) {
      throw new Error(
        `ERR_SSRF_BLOCKED: Host "${hostname}" resolved to blocked address ${record.address} (${check.reason})`
      );
    }
  }

  return parsed;
}
