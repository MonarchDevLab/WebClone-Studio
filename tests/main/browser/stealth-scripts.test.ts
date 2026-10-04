import { describe, it, expect } from 'vitest';
import { generateStealthScript } from '../../../src/main/browser/stealth-scripts';

describe('StealthScripts Generator', () => {
  it('should generate a comprehensive anti-bot evasion script string', () => {
    const script = generateStealthScript();

    expect(typeof script).toBe('string');
    expect(script.length).toBeGreaterThan(500);

    // 1. Webdriver evasion
    expect(script).toContain('navigator');
    expect(script).toContain('webdriver');

    // 2. Chrome runtime & app emulation
    expect(script).toContain('window.chrome');
    expect(script).toContain('runtime');

    // 3. Permissions API
    expect(script).toContain('permissions.query');

    // 4. WebGL Vendor & Renderer spoofing
    expect(script).toContain('WebGLRenderingContext');
    expect(script).toContain('37445'); // UNMASKED_VENDOR_WEBGL
    expect(script).toContain('37446'); // UNMASKED_RENDERER_WEBGL

    // 5. Screen & Window dimensions consistency (offscreen/headless detection)
    expect(script).toContain('outerWidth');
    expect(script).toContain('outerHeight');

    // 6. AudioContext & Canvas fingerprint defenses
    expect(script).toContain('AudioContext');
    expect(script).toContain('HTMLCanvasElement');
  });

  it('should be valid JavaScript that can be parsed without syntax error', () => {
    const script = generateStealthScript();
    // Function constructor syntax check
    expect(() => {
      new Function(script);
    }).not.toThrow();
  });
});
