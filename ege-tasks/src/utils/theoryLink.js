// Статья теории по ссылке: student.oipav.ru/t/<id> — читается без входа,
// если учитель открыл её («Поделиться» в статье). Страница живёт в
// ученическом приложении: оно уже открыто всем и без логина.

export const STUDENT_ORIGIN = 'https://student.oipav.ru';

/** Ссылка на статью: { full, short } (short — без протокола, для подписи). */
export function articleLink(id, origin = STUDENT_ORIGIN) {
  const full = `${origin.replace(/\/+$/, '')}/t/${id}`;
  return { full, short: full.replace(/^https?:\/\//, '') };
}

/** Id статьи из адреса: /t/<id> или /student/t/<id>. */
export function articleIdFromPath(pathname) {
  const m = /^\/(?:student\/)?t\/([a-z0-9]{15})\/?$/.exec(String(pathname || ''));
  return m ? m[1] : null;
}
