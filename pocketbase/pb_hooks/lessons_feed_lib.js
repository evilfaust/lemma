/**
 * Чистая логика хука lessons_feed.pb.js (v3.9.291): что из урока видит ученик.
 *
 * CommonJS — так его подключает JSVM PocketBase (`require` внутри обработчика).
 * Файл без суффикса .pb.js, поэтому PB сам его не исполняет. Тесты —
 * ege-tasks/src/__tests__/studentLessons.test.js (через createRequire).
 *
 * 🚨 Правило видимости файла продублировано в ege-tasks/src/utils/homework.js
 * (`materialVisible`) — модалка урока показывает учителю ровно то же, что
 * получит ученик. Тест сверяет обе копии на одних данных.
 */

// Файл урока виден ученику курса, пока его не скрыли (так было с v3.9.115).
// В классе — только отмеченный явно: до v3.9.291 файлы уроков класса никто
// ученикам не показывал, и среди них могут лежать ключи и разработки учителя.
function materialVisible(m, isCourse) {
  if (!m) return false;
  if (m.type === 'material') return isCourse ? m.visible !== false : m.visible === true;
  return m.visible !== false;
}

// Срок ДЗ: 'lesson' — к этому уроку (показывается в нём), 'next' — к
// следующему уроку того же класса и учителя на другой день.
function dueOf(m) {
  return m && m.role === 'homework' && m.due === 'next' ? 'next' : 'lesson';
}

// lessons.materials → пункты для ученика. Работы учительской петли (type
// 'work'), геометрические работы и всё незнакомое ученику не уходят.
// 'work_view' (v3.9.306) — работа в режиме показа условий: ученику ссылка
// /r/<id> (только условия, без выдачи), id — сама работа.
// 'geometry_view' (v3.9.308) — то же для работы по геометрии: /w/<id>.
// До v3.9.308 ссылку /w/<id> или /r/<id>, вставленную «кодом сессии вручную»,
// урок хранил как выдачу (type 'session', id = вся ссылка) — ученик получал
// «сессия не открыта». Такой пункт читаем как показ условий.
function viewOfSessionLink(m) {
  const hit = /\/([rw])\/([a-z0-9]{15})(?:[/?#]|$)/i.exec(String((m && m.id) || ''));
  if (!hit) return null;
  return { type: hit[1].toLowerCase() === 'w' ? 'geometry_view' : 'work_view', id: hit[2].toLowerCase() };
}

function projectItems(materials, isCourse) {
  const arr = Array.isArray(materials) ? materials : [];
  const out = [];
  for (const raw of arr) {
    const fix = raw && raw.type === 'session' ? viewOfSessionLink(raw) : null;
    const m = fix ? Object.assign({}, raw, fix) : raw;
    if (!materialVisible(m, isCourse)) continue;
    const role = m.role === 'homework' ? 'homework' : 'class';
    const due = dueOf(m);
    if (m.type === 'material') {
      out.push({ kind: 'file', role, due, title: m.title || 'Материал', file_url: m.url || '' });
    } else if (m.type === 'session') {
      out.push({ kind: 'work', role, due, title: m.title || 'Работа', session_id: m.id || '' });
    } else if (m.type === 'work_view') {
      out.push({ kind: 'show', role, due, title: m.title || 'Задания', work_id: m.id || '' });
    } else if (m.type === 'geometry_view') {
      out.push({ kind: 'show', role, due, title: m.title || 'Работа по геометрии', work_id: m.id || '', geometry: true });
    } else if (m.type === 'text') {
      out.push({ kind: 'text', role, due, title: m.title || '', description: m.text || '' });
    }
  }
  return out;
}

// Дата в формате, в котором PB хранит datetime («2026-10-05 07:15:00.000Z»):
// сравнение в фильтре строковое, ISO с «T» на той же дате дал бы неверный ответ.
function pbDate(d) {
  return new Date(d).toISOString().replace('T', ' ');
}

module.exports = { materialVisible, dueOf, projectItems, pbDate, viewOfSessionLink };
