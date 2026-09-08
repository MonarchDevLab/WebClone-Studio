import { create } from 'zustand';
import { AnalyzeResult } from '@shared/types';

interface AnalyzeState {
  url: string;
  setUrl: (url: string) => void;
  
  isAnalyzing: boolean;
  analyzeResult: AnalyzeResult | null;
  error: string | null;
  
  startAnalysis: (url: string) => Promise<AnalyzeResult>;
  setResult: (result: AnalyzeResult) => void;
  reset: () => void;
}

export const useAnalyzeStore = create<AnalyzeState>((set) => ({
  url: '',
  setUrl: (url) => set({ url }),
  
  isAnalyzing: false,
  analyzeResult: null,
  error: null,
  
  startAnalysis: async (url) => {
    set({ isAnalyzing: true, error: null, url });

    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        const err = new Error('Yalnızca http:// ve https:// protokolleri desteklenmektedir.');
        set({ isAnalyzing: false, error: err.message });
        throw err;
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Geçersiz URL formatı.';
      set({ isAnalyzing: false, error: errMsg });
      throw new Error(errMsg);
    }

    if (window.electronAPI?.analyze) {
      try {
        const result: AnalyzeResult = await window.electronAPI.analyze(url);
        set({ analyzeResult: result, isAnalyzing: false });
        return result;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Analiz başarısız oldu.';
        set({ isAnalyzing: false, error: errMsg });
        throw err;
      }
    } else {
      // Mock Fallback (Tarayıcı / Test ortamı için)
      await new Promise(r => setTimeout(r, 1500));
      const mockResult: AnalyzeResult = {
        technologies: [
          { name: 'React', category: 'Framework', confidence: 100, version: '19.0.0', signals: ['window.React', 'DOM'] },
          { name: 'Next.js', category: 'Framework', confidence: 95, version: '15.1', signals: ['#__next', 'headers'] },
          { name: 'Tailwind CSS', category: 'CSS Framework', confidence: 90, signals: ['class patterns'] },
          { name: 'Cloudflare', category: 'CDN', confidence: 100, signals: ['cf-ray header'] },
        ],
        designTokens: {
          colors: [
            { hex: '#08090A', role: 'background', frequency: 120 },
            { hex: '#F4F4F5', role: 'foreground', frequency: 95 },
            { hex: '#6366F1', role: 'accent', frequency: 45 },
            { hex: '#10B981', role: 'border', frequency: 20 },
          ],
          typography: [
            { fontFamily: 'Inter', fontSize: '24px', fontWeight: 700, lineHeight: '32px', role: 'heading' },
            { fontFamily: 'Inter', fontSize: '14px', fontWeight: 400, lineHeight: '20px', role: 'body' },
          ],
          spacing: [4, 8, 12, 16, 24, 32],
        },
        siteMap: {
          url: url,
          statusCode: 200,
          depth: 0,
          children: [
            { url: `${url}/about`, statusCode: 200, depth: 1, children: [] },
            { url: `${url}/docs`, statusCode: 200, depth: 1, children: [] },
          ],
        },
        security: {
          https: true,
          hsts: true,
          csp: false,
          robotsTxt: true,
          sitemap: true,
          headers: { server: 'cloudflare' },
        },
        meta: {
          title: 'Örnek Web Sitesi',
          description: 'Modern teknoloji ve web geliştirme platformu',
          language: 'tr-TR',
          encoding: 'UTF-8',
        },
      };

      set({ analyzeResult: mockResult, isAnalyzing: false });
      return mockResult;
    }
  },
  
  setResult: (result) => set({ analyzeResult: result, isAnalyzing: false }),
  reset: () => set({ url: '', isAnalyzing: false, analyzeResult: null, error: null })
}));
