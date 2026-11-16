/**
 * Browser fingerprint hardening script injected via CDP before document scripts execute.
 * Ensures genuine canvas/audio perturbation (no identity XOR no-ops), Function.prototype.toString
 * native cloaking, and modal dialog suppression in offscreen automation windows.
 */
export function generateStealthScript(seedInput?: number): string {
  const seed = Number.isInteger(seedInput) ? (seedInput as number) : 0x5f3759df;
  return `(function() {
  'use strict';

  const __wcNativeNames = new WeakMap();
  const originalFnToString = Function.prototype.toString;
  try {
    Function.prototype.toString = function toString() {
      if (__wcNativeNames.has(this)) {
        return __wcNativeNames.get(this);
      }
      return originalFnToString.apply(this, arguments);
    };
    __wcNativeNames.set(Function.prototype.toString, 'function toString() { [native code] }');
  } catch (e) {}

  function cloakNative(fn, name) {
    try {
      __wcNativeNames.set(fn, 'function ' + (name || fn.name || '') + '() { [native code] }');
    } catch (e) {}
    return fn;
  }

  // Deterministic tiny PRNG per session for consistent non-zero fingerprint jitter
  let __seed = ${seed} >>> 0;
  function nextNoiseBit() {
    __seed = (1664525 * __seed + 1013904223) >>> 0;
    return (__seed >>> 31) ? 1 : -1;
  }

  // 1. Prevent modal dialogs from freezing offscreen windows
  try {
    window.alert = cloakNative(function alert() {}, 'alert');
    window.confirm = cloakNative(function confirm() { return true; }, 'confirm');
    window.prompt = cloakNative(function prompt() { return null; }, 'prompt');
  } catch (e) {}

  // 2. Webdriver evasion
  try {
    const navProto = Object.getPrototypeOf(window.navigator);
    delete navProto.webdriver;
    Object.defineProperty(window.navigator, 'webdriver', {
      get: cloakNative(function webdriver() { return undefined; }, 'get webdriver'),
      configurable: true,
      enumerable: true
    });
  } catch (e) {}

  // 3. window.chrome runtime emulation
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
    window.chrome.csi = cloakNative(function csi() {
      return { startE: Date.now() - 500, onloadT: Date.now(), pageT: 500, tran: 15 };
    }, 'csi');
    window.chrome.loadTimes = cloakNative(function loadTimes() {
      const nowSec = Date.now() / 1000;
      return {
        requestTime: nowSec - 0.5,
        startLoadTime: nowSec - 0.4,
        commitLoadTime: nowSec - 0.2,
        finishDocumentLoadTime: nowSec - 0.1,
        finishLoadTime: nowSec,
        firstPaintTime: nowSec - 0.15,
        firstPaintAfterLoadTime: 0,
        navigationType: 'Other',
        wasFetchedViaSpdy: true,
        wasNpnNegotiated: true,
        npnNegotiatedProtocol: 'h2',
        wasAlternateProtocolAvailable: false,
        connectionInfo: 'h2'
      };
    }, 'loadTimes');
  } catch (e) {}

  // 4. Permissions API
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = cloakNative(function query(parameters) {
        if (parameters && parameters.name === 'notifications') {
          return Promise.resolve({
            state: 'prompt',
            name: 'notifications',
            onchange: null
          });
        }
        return originalQuery.apply(this, arguments);
      }, 'query');
    }
  } catch (e) {}

  // 5. WebGL Vendor & Renderer normalization
  try {
    const overrideWebGl = function(proto) {
      if (!proto || !proto.getParameter) return;
      const originalGetParameter = proto.getParameter;
      proto.getParameter = cloakNative(function getParameter(parameter) {
        if (parameter === 37445) {
          return 'Google Inc. (NVIDIA)';
        }
        if (parameter === 37446) {
          return 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
        }
        return originalGetParameter.apply(this, arguments);
      }, 'getParameter');
    };
    if (window.WebGLRenderingContext) overrideWebGl(WebGLRenderingContext.prototype);
    if (window.WebGL2RenderingContext) overrideWebGl(WebGL2RenderingContext.prototype);
  } catch (e) {}

  // 6. Screen & Window outer dimension normalization
  try {
    const win = window;
    if (win.outerWidth === 0 || win.outerWidth === undefined) {
      Object.defineProperty(win, 'outerWidth', {
        get: cloakNative(function outerWidth() { return (win.innerWidth || 1440) + 16; }, 'get outerWidth'),
        configurable: true
      });
    }
    if (win.outerHeight === 0 || win.outerHeight === undefined) {
      Object.defineProperty(win, 'outerHeight', {
        get: cloakNative(function outerHeight() { return (win.innerHeight || 900) + 88; }, 'get outerHeight'),
        configurable: true
      });
    }
    if (win.screen) {
      Object.defineProperty(win.screen, 'availWidth', {
        get: cloakNative(function availWidth() { return win.screen.width || 1920; }, 'get availWidth'),
        configurable: true
      });
      Object.defineProperty(win.screen, 'availHeight', {
        get: cloakNative(function availHeight() { return (win.screen.height || 1080) - 40; }, 'get availHeight'),
        configurable: true
      });
      Object.defineProperty(win.screen, 'colorDepth', {
        get: cloakNative(function colorDepth() { return 24; }, 'get colorDepth'),
        configurable: true
      });
      Object.defineProperty(win.screen, 'pixelDepth', {
        get: cloakNative(function pixelDepth() { return 24; }, 'get pixelDepth'),
        configurable: true
      });
    }
  } catch (e) {}

  // 7. Canvas & Audio fingerprint subtle pixel perturbation (non-identity, preserves visual fidelity)
  try {
    function perturbImageData(imgData) {
      if (!imgData || !imgData.data || imgData.data.length < 4) return;
      const step = Math.max(4, Math.floor(imgData.data.length / 32) & ~3);
      for (let i = 0; i < imgData.data.length; i += step) {
        const delta = nextNoiseBit();
        const nextVal = imgData.data[i] + delta;
        imgData.data[i] = nextVal < 0 ? 0 : nextVal > 255 ? 255 : nextVal;
      }
    }

    if (window.CanvasRenderingContext2D) {
      const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
      CanvasRenderingContext2D.prototype.getImageData = cloakNative(function getImageData() {
        const imgData = originalGetImageData.apply(this, arguments);
        perturbImageData(imgData);
        return imgData;
      }, 'getImageData');

      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = cloakNative(function toDataURL() {
        try {
          if (this.width > 0 && this.height > 0 && this.width <= 1024 && this.height <= 1024) {
            const clone = document.createElement('canvas');
            clone.width = this.width;
            clone.height = this.height;
            const ctx = clone.getContext('2d');
            if (ctx) {
              ctx.drawImage(this, 0, 0);
              const originalImg = originalGetImageData.call(ctx, 0, 0, Math.min(4, clone.width), Math.min(4, clone.height));
              perturbImageData(originalImg);
              ctx.putImageData(originalImg, 0, 0);
              return originalToDataURL.apply(clone, arguments);
            }
          }
        } catch (e) {}
        return originalToDataURL.apply(this, arguments);
      }, 'toDataURL');
    }

    if ((window.AudioContext || window.webkitAudioContext) && window.AudioBuffer) {
      const originalGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = cloakNative(function getChannelData() {
        const channelData = originalGetChannelData.apply(this, arguments);
        if (channelData && channelData.length > 0) {
          channelData[0] = channelData[0] + nextNoiseBit() * 1e-7;
        }
        return channelData;
      }, 'getChannelData');
    }
  } catch (e) {}

  // 8. Locale languages & plugins
  try {
    Object.defineProperty(navigator, 'languages', {
      get: cloakNative(function languages() { return ['tr-TR', 'tr', 'en-US', 'en']; }, 'get languages'),
      configurable: true
    });
    Object.defineProperty(navigator, 'plugins', {
      get: cloakNative(function plugins() {
        return [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
        ];
      }, 'get plugins'),
      configurable: true
    });
  } catch (e) {}

})();`;
}
