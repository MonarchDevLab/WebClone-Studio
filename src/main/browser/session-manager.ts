import { session as electronSession } from 'electron';
import crypto from 'node:crypto';
import { getRootDomain } from '../../shared/validators';

export interface PartitionCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
}

/**
 * Manages isolated Electron Chromium sessions per target root domain.
 * Prevents authentication cookies from leaking across unrelated domains and
 * enforces permission denial + explicit opt-in TLS verification policy.
 */
export class SessionManager {
  private static configuredPartitions = new Set<string>();
  private static ignoreSslByPartition = new Map<string, boolean>();

  /**
   * Computes a deterministic Chromium partition name for the target URL's root domain.
   */
  public static getPartitionForUrl(targetUrl: string): string {
    try {
      const hostname = new URL(targetUrl).hostname.toLowerCase();
      const rootDomain = getRootDomain(hostname);
      const hash = crypto.createHash('sha256').update(rootDomain).digest('hex').slice(0, 12);
      return `persist:webclone_${hash}`;
    } catch {
      return 'persist:webclone_default';
    }
  }

  /**
   * Configures security policies for an Electron session partition if running in Electron.
   */
  public static configurePartition(
    partition: string,
    options?: { ignoreSslErrors?: boolean }
  ): Electron.Session | null {
    if (!electronSession || typeof electronSession.fromPartition !== 'function') {
      return null;
    }

    if (options?.ignoreSslErrors !== undefined) {
      this.ignoreSslByPartition.set(partition, Boolean(options.ignoreSslErrors));
    }

    const ses = electronSession.fromPartition(partition);
    if (!this.configuredPartitions.has(partition)) {
      this.configuredPartitions.add(partition);

      ses.setPermissionRequestHandler((_wc, _permission, callback) => {
        callback(false);
      });

      if (typeof ses.setPermissionCheckHandler === 'function') {
        ses.setPermissionCheckHandler(() => false);
      }

      if (typeof ses.setCertificateVerifyProc === 'function') {
        ses.setCertificateVerifyProc((_request, callback) => {
          const allowInsecure = this.ignoreSslByPartition.get(partition) === true;
          // 0 = accept explicitly when user opted in; -3 = use Chromium default verification
          callback(allowInsecure ? 0 : -3);
        });
      }
    }

    return ses;
  }

  /**
   * Reads stored cookies for targetUrl from its isolated session partition.
   */
  public static async getCookiesForUrl(
    targetUrl: string,
    partition: string = this.getPartitionForUrl(targetUrl)
  ): Promise<PartitionCookie[]> {
    const ses = this.configurePartition(partition);
    if (!ses) return [];
    try {
      const fallbackHost = new URL(targetUrl).hostname;
      const list = await ses.cookies.get({ url: targetUrl });
      return list.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain || fallbackHost,
        path: c.path || '/',
      }));
    } catch {
      return [];
    }
  }
}
