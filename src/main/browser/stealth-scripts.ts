/**
/**
 * Ultra-Stealth CDP Enjeksiyon Betikleri
 * Cloudflare Turnstile, DataDome, Akamai ve Kasada gibi modern anti-bot
 * ve tarayıcı parmak izi korumalarını Electron Chromium motorunda maskelemek için kullanılır.
 */

export function generateStealthScript(): string {
  return `(function() {
  'use strict';

  // 1. Webdriver Evasion
  try {
    const originalNavigator = window.navigator;
    delete Object.getPrototypeOf(originalNavigator).webdriver;
    Object.defineProperty(originalNavigator, 'webdriver', {
      get: () => undefined,
      configurable: true,
      enumerable: true
    });
  } catch (e) {}

  // 2. window.chrome Emülasyonu
  try {
    if (!window.chrome) {
      window.chrome = {};
    }
    window.chrome.app = {
      isInstalled: false,
      InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
      RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' }
    };
    window.chrome.runtime = {
      OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
      OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
      PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
      PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
      PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' }
    };
    window.chrome.csi = function() {
      return { startE: Date.now() - 500, onloadT: Date.now(), pageT: 500, tran: 15 };
    };
    window.chrome.loadTimes = function() {
      return {
        requestTime: Date.now() / 1000 - 0.5,
        startLoadTime: Date.now() / 1000 - 0.4,
        commitLoadTime: Date.now() / 1000 - 0.2,
        finishDocumentLoadTime: Date.now() / 1000 - 0.1,
        finishLoadTime: Date.now() / 1000,
        firstPaintTime: Date.now() / 1000 - 0.15,
        firstPaintAfterLoadTime: 0,
        navigationType: 'Other',
        wasFetchedViaSpdy: true,
        wasNpnNegotiated: true,
        npnNegotiatedProtocol: 'h2',
        wasAlternateProtocolAvailable: false,
        connectionInfo: 'h2'
      };
    };
  } catch (e) {}

  // 3. Permissions API (Notification State)
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = function(parameters) {
        if (parameters && parameters.name === 'notifications') {
          return Promise.resolve({
            state: 'prompt',
            name: 'notifications',
            onchange: null
          });
        }
        return originalQuery.apply(this, arguments);
      };
    }
  } catch (e) {}

  // 4. WebGL Vendor & Renderer Spoofing
  try {
    const overrideWebGl = function(proto) {
      if (!proto || !proto.getParameter) return;
      const originalGetParameter = proto.getParameter;
      proto.getParameter = function(parameter) {
        // UNMASKED_VENDOR_WEBGL
        if (parameter === 37445) {
          return 'Google Inc. (NVIDIA)';
        }
        // UNMASKED_RENDERER_WEBGL
        if (parameter === 37446) {
          return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
        }
        return originalGetParameter.apply(this, arguments);
      };
    };
    if (window.WebGLRenderingContext) {
      overrideWebGl(WebGLRenderingContext.prototype);
    }
    if (window.WebGL2RenderingContext) {
      overrideWebGl(WebGL2RenderingContext.prototype);
    }
  } catch (e) {}

  // 5. Screen & Window Dimensions (Offscreen/Headless 0x0 Tespiti Önleme)
  try {
    const win = window;
    if (win.outerWidth === 0 || win.outerWidth === undefined) {
      Object.defineProperty(win, 'outerWidth', {
        get: () => (win.innerWidth || 1440) + 16,
        configurable: true
      });
    }
    if (win.outerHeight === 0 || win.outerHeight === undefined) {
      Object.defineProperty(win, 'outerHeight', {
        get: () => (win.innerHeight || 900) + 88,
        configurable: true
      });
    }
    if (win.screen) {
      Object.defineProperty(win.screen, 'availWidth', {
        get: () => win.screen.width || 1920,
        configurable: true
      });
      Object.defineProperty(win.screen, 'availHeight', {
        get: () => (win.screen.height || 1080) - 40,
        configurable: true
      });
      Object.defineProperty(win.screen, 'colorDepth', {
        get: () => 24,
        configurable: true
      });
      Object.defineProperty(win.screen, 'pixelDepth', {
        get: () => 24,
        configurable: true
      });
    }
  } catch (e) {}

  // 6. AudioContext & Canvas Parmak İzi Mikro-Gürültüsü
  try {
    if (window.HTMLCanvasElement) {
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function() {
        return originalToDataURL.apply(this, arguments);
      };

      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh) {
        const imgData = originalGetImageData.apply(this, arguments);
        // Çok küçük bir piksel gürültüsü enjekte ederek sabit bot hash'ini bozar
        if (imgData && imgData.data && imgData.data.length > 4) {
          imgData.data[0] = (imgData.data[0] ^ 1) ^ 1;
        }
        return imgData;
      };
    }

    if (window.AudioContext || window.webkitAudioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const originalGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function() {
        const channelData = originalGetChannelData.apply(this, arguments);
        if (channelData && channelData.length > 0) {
          channelData[0] = channelData[0] + 0.0000001 * (Math.random() - 0.5);
        }
        return channelData;
      };
    }
  } catch (e) {}

  // 7. Diller ve Eklentiler
  try {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['tr-TR', 'tr', 'en-US', 'en'],
      configurable: true
    });
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
        ];
        return plugins;
      },
      configurable: true
    });
  } catch (e) {}

})();`;
}
