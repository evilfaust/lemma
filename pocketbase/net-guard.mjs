// Защита серверных загрузок по ссылке (аудит 25.10.2026).
//
// /fetch-image и /parse-sdamgia качают адрес, присланный браузером. Без проверки
// это открытый прокси внутрь VPS (SSRF): http://127.0.0.1:8095/…, соседние
// сервисы, адреса облака. Здесь — чистые правила (без сети, под тестом
// ege-tasks/src/__tests__/netGuard.test.js) и обёртка fetch, которая проверяет
// адрес до запроса и на каждом редиректе.
// 🚨 На VPS класть рядом с pdf-service.js (/opt/pocketbase/pdf-service/).

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Адрес из частной/служебной сети — туда сервер ходить не должен. */
export function isPrivateAddress(ip) {
  const v = isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0)
      || (a === 198 && (b === 18 || b === 19));
  }
  if (v === 6) {
    const x = ip.toLowerCase();
    if (x === '::' || x === '::1') return true;
    const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^f[cd]/.test(x) || /^fe[89ab]/.test(x) || /^ff/.test(x);
  }
  return true; // не адрес вовсе — не пускаем
}

/** Хост — sdamgia.ru или его поддомен (а не «…?sdamgia.ru» в чужой ссылке). */
export function isSdamgiaUrl(url) {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const h = u.hostname.toLowerCase();
    return h === 'sdamgia.ru' || h.endsWith('.sdamgia.ru');
  } catch {
    return false;
  }
}

/** Проверка ссылки: http(s), стандартный порт, публичный адрес. Бросает Error. */
export async function assertPublicUrl(url, { resolve = lookup } = {}) {
  let u;
  try { u = new URL(url); } catch { throw new Error('Некорректный URL'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Поддерживаются только http/https URL');
  if (u.port && !['80', '443'].includes(u.port)) throw new Error('Нестандартный порт запрещён');
  if (u.username || u.password) throw new Error('Ссылки с логином запрещены');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = isIP(host) ? [{ address: host }] : await resolve(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) {
    throw new Error('Адрес во внутренней сети запрещён');
  }
  return u;
}

/**
 * fetch только на публичные адреса: каждый редирект проверяется заново,
 * тело читается не больше maxBytes. Возвращает { response, buffer, url }.
 */
export async function safeFetch(url, { headers = {}, maxBytes = 20 * 1024 * 1024, maxRedirects = 3, resolve } = {}) {
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicUrl(current, { resolve });
    const response = await fetch(current, { headers, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      current = new URL(response.headers.get('location'), current).toString();
      continue;
    }
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > maxBytes) throw new Error('Файл слишком большой');
    const chunks = [];
    let size = 0;
    if (response.body) {
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > maxBytes) throw new Error('Файл слишком большой');
        chunks.push(chunk);
      }
    }
    return { response, buffer: Buffer.concat(chunks), url: current };
  }
  throw new Error('Слишком много перенаправлений');
}
