// Эфир стереочертежа: чистая логика комнаты (без сети).
//
// Комната = запись stereo_rooms: { code, scene, camera, pulse, notice, live }.
// Учитель пишет в неё, ученик читает. Здесь — код ссылки, разбор того, что
// изменилось между двумя версиями записи (что вспыхнуть, куда повернуть,
// что показать), и плавный поворот камеры.

import { clampCamera } from './camera';

export const STUDENT_ORIGIN = 'https://student.oipav.ru';

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

/** «10А» → «10a», «11 Б профиль» → «11b-profil». Пусто → «room». */
export function roomCodeFromName(name) {
  const lat = String(name || '')
    .toLowerCase()
    .replace(/[а-яё]/g, (c) => TRANSLIT[c] ?? '')
    .replace(/(\d)\s+([a-z])(?![a-z])/g, '$1$2') // «10 а» → «10a», но «11 профиль» — через дефис
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '');
  return lat || 'room';
}

/** Код, набранный руками, — к виду, который примет база. */
export const normalizeRoomCode = roomCodeFromName;

/** Кандидаты на свободный код: 10a, 10a-2, 10a-3… */
export function codeCandidates(base, count = 8) {
  const b = normalizeRoomCode(base);
  const out = [b];
  for (let k = 2; out.length < count; k++) out.push(`${b.slice(0, 21)}-${k}`);
  return out;
}

/** Ссылка для доски (без протокола) и полная. */
export function roomLink(code, origin = STUDENT_ORIGIN) {
  const full = `${origin.replace(/\/+$/, '')}/b/${code}`;
  return { full, short: full.replace(/^https?:\/\//, '') };
}

/** Код комнаты из адреса ученика: /b/10a или /student/b/10a. */
export function roomCodeFromPath(pathname) {
  const m = /^\/(?:student\/)?b\/([a-z0-9-]+)\/?$/i.exec(String(pathname || ''));
  return m ? m[1].toLowerCase() : null;
}

/** Ошибка построения, которую стоит показать классу («скрещиваются»). */
export function isTeachingNotice(text) {
  return /скрещиваются|параллельн|лежит в плоскости|совпадают|не пересекает тело/.test(String(text || ''));
}

const seqOf = (v) => (v && Number.isFinite(Number(v.seq)) ? Number(v.seq) : 0);

/**
 * Что изменилось в комнате между версиями записи — для ученика.
 * @returns {{ flashStep: number|null, camera: object|null, pulse: object|null, notice: string|null, reset: boolean }}
 */
export function roomChanges(prev, next) {
  const out = { flashStep: null, camera: null, pulse: null, notice: null, reset: false };
  if (!next) return out;
  const ops0 = prev?.scene?.ops || [];
  const ops1 = next.scene?.ops || [];
  const sameBody = JSON.stringify(prev?.scene?.body || null) === JSON.stringify(next.scene?.body || null);
  if (prev && !sameBody) out.reset = true;
  // Новый шаг — если журнал вырос и старая часть не поменялась.
  if (prev && sameBody && ops1.length > ops0.length
    && ops0.every((op, i) => op.id === ops1[i]?.id)) {
    out.flashStep = ops1.length - 1;
  }
  if (seqOf(next.camera) > seqOf(prev?.camera)) out.camera = clampCamera(next.camera);
  // Пульс и подсказку показываем только «вживую»: ученик, открывший эфир
  // позже, не должен получить вчерашнее «скрещиваются».
  if (prev && seqOf(next.pulse) > seqOf(prev.pulse)) out.pulse = next.pulse;
  if (prev && seqOf(next.notice) > seqOf(prev.notice) && next.notice?.text) out.notice = String(next.notice.text);
  return out;
}

/** Промежуточная камера: yaw — по кратчайшей дуге. */
export function interpolateCamera(a, b, k) {
  let dy = ((b.yaw - a.yaw) % 360 + 540) % 360 - 180;
  if (!Number.isFinite(dy)) dy = 0;
  return clampCamera({
    yaw: a.yaw + dy * k,
    pitch: a.pitch + (b.pitch - a.pitch) * k,
    zoom: (a.zoom || 1) + ((b.zoom || 1) - (a.zoom || 1)) * k,
  });
}

/** Сцена из записи комнаты: пустая или битая → null. */
export function sceneOfRoom(room) {
  const s = room?.scene;
  if (!s || typeof s !== 'object' || !s.body || !Array.isArray(s.ops)) return null;
  return s;
}
