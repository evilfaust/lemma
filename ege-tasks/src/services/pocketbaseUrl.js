const trimTrailingSlash = (url) => url.replace(/\/+$/, '');
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '0.0.0.0']);

const isLoopbackHost = (host) => LOOPBACK_HOSTS.has((host || '').toLowerCase());

const getBrowserBasedUrl = () => {
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    return `${protocol}//${window.location.hostname}:8090`;
  }
  return null;
};

export const getPocketBaseBaseUrl = () => {
  const envUrl = import.meta.env.VITE_PB_URL;
  if (envUrl) {
    const normalizedEnv = trimTrailingSlash(envUrl);
    const browserUrl = getBrowserBasedUrl();

    if (browserUrl) {
      try {
        const envHost = new URL(normalizedEnv).hostname;
        const browserHost = window.location.hostname;

        // Если фронт открыт по LAN/IP, loopback в env ломает доступ к backend.
        if (!isLoopbackHost(browserHost) && isLoopbackHost(envHost)) {
          return browserUrl;
        }
      } catch {
        // Невалидный env URL: пробуем browser-based fallback.
        return browserUrl;
      }
    }

    return normalizedEnv;
  }

  const browserUrl = getBrowserBasedUrl();
  if (browserUrl) {
    return browserUrl;
  }

  return 'http://127.0.0.1:8090';
};

export const PB_BASE_URL = getPocketBaseBaseUrl();
