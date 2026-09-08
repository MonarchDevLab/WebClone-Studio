import { SiteMapper } from './site-mapper';
import { SiteMapNode, SizeEstimate, AnalyzeResult } from '../../shared/types';
import got from 'got';
import * as cheerio from 'cheerio';

export class SizeEstimator {
  private mapper = new SiteMapper();

  /**
   * Sayfa ve varlık sayısını gerçek analiz verisi veya sitemap ağacına dayanarak tahmin eder.
   */
  async estimate(url: string, depth: number = 1, knownAnalyzeResult?: AnalyzeResult | null): Promise<SizeEstimate> {
    try {
      // 1. Durum: Az önce tamamlanan analizin verisi mevcutsa (En hızlı ve en doğru kaynak)
      if (knownAnalyzeResult && knownAnalyzeResult.siteMap) {
        let pageCount = 0;
        let knownAssets = 0;

        const countNodes = (node: SiteMapNode, currentDepth: number) => {
          if (currentDepth <= depth) {
            pageCount++;
            knownAssets += node.assetCount || 12;
            (node.children || []).forEach(child => countNodes(child, currentDepth + 1));
          }
        };

        countNodes(knownAnalyzeResult.siteMap, 0);

        const estimatedPages = Math.max(1, pageCount);
        // Modern bir web sayfasında ortalama 15-35 statik varlık (CSS, JS, resim, font) bulunur
        const estimatedAssets = Math.max(knownAssets, estimatedPages * 18);
        const avgAssetSizeBytes = 120 * 1024; // ~120 KB ortalama varlık boyutu
        const estimatedSizeBytes = (estimatedPages * 35 * 1024) + (estimatedAssets * avgAssetSizeBytes);

        return {
          estimatedPages,
          estimatedAssets,
          estimatedSizeBytes: Math.max(estimatedSizeBytes, 2 * 1024 * 1024),
        };
      }

      // 2. Durum: Analiz sonucu yoksa SiteMapper ile hızlı sitemap/link haritalama
      const rootNode = await this.mapper.map(url, depth, 60);

      let totalSizeBytes = 0;
      let pageCount = 0;
      let assetCount = 0;

      const traverse = (node: SiteMapNode) => {
        if (node.statusCode === 200 || node.statusCode === 0) {
          totalSizeBytes += node.size || 30000;
          pageCount++;
          assetCount += node.assetCount || 15;
        }
        (node.children || []).forEach(traverse);
      };

      traverse(rootNode);

      const estimatedPages = Math.max(1, pageCount);
      const estimatedAssets = Math.max(assetCount, estimatedPages * 16);
      const estimatedSize = totalSizeBytes + (estimatedAssets * 110 * 1024);

      return {
        estimatedPages,
        estimatedAssets,
        estimatedSizeBytes: Math.max(estimatedSize, 1024 * 1024),
      };
    } catch {
      // 3. Durum: Ağ engeli durumunda tek sayfa hızlı GET ile gerçek DOM tabanlı dinamik tahmin
      try {
        const res = await got.get(url, { timeout: { request: 3500 }, throwHttpErrors: false });
        const $ = cheerio.load(res.body);
        const domAssets = $('img, script[src], link[rel="stylesheet"]').length;
        const multiplier = depth === 1 ? 4 : depth === 2 ? 15 : 40;
        const estimatedPages = multiplier;
        const estimatedAssets = estimatedPages * domAssets;
        const estimatedSizeBytes = estimatedPages * 25000 + estimatedAssets * 100 * 1024;

        return {
          estimatedPages,
          estimatedAssets,
          estimatedSizeBytes: Math.max(estimatedSizeBytes, 1024 * 1024),
        };
      } catch {
        const fallbackPages = depth === 1 ? 5 : depth === 2 ? 18 : 45;
        return {
          estimatedPages: fallbackPages,
          estimatedAssets: fallbackPages * 18,
          estimatedSizeBytes: fallbackPages * 18 * 90 * 1024,
        };
      }
    }
  }
}
