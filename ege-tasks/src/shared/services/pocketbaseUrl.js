const DEFAULT_PB_URL = 'https://task-ege.oipav.ru';
const trimTrailingSlash = (url) => String(url || '').replace(/\/+$/, '');

export const getPocketBaseBaseUrl = () => {
  const envUrl = trimTrailingSlash(import.meta.env.VITE_PB_URL);
  if (!envUrl) return DEFAULT_PB_URL;

  try {
    const parsed = new URL(envUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return envUrl;
    }
  } catch {
    // no-op: invalid URL will fallback to default
  }

  console.warn('[pocketbase] Invalid VITE_PB_URL, fallback to VPS URL');
  return DEFAULT_PB_URL;
};

export const PB_BASE_URL = getPocketBaseBaseUrl();
