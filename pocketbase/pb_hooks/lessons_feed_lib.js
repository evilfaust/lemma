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
// Работа, тест и работа по геометрии (v3.9.358, единый список материалов)
// видны, только когда учитель выбрал, как их выдать (`deliver`); без него —
// «Только мне», как все такие пункты до v3.9.358.
const OWN_TYPES = { work: true, mc_test: true, geometry_work: true };

function materialVisible(m, isCourse) {
  if (!m) return false;
  if (m.type === 'material') return isCourse ? m.visible !== false : m.visible === true;
  if (OWN_TYPES[m.type]) return !!m.deliver && m.visible !== false;
  return m.visible !== false;
}

// Обязательно ли сделать (v3.9.358): учитель решает переключателем у пункта,
// без него — ДЗ и онлайн-работы обязательны, файлы, условия и тексты на уроке —
// для удобства. Работа на бумаге уже написана — она не «сделать», а результат.
function requiredOf(m) {
  if (!m) return false;
  if (m.deliver === 'paper') return false;
  if (typeof m.required === 'boolean') return m.required;
  return m.role === 'homework' || m.type === 'session' || m.deliver === 'online';
}

// Срок ДЗ: 'lesson' — к этому уроку (показывается в нём), 'next' — к
// следующему уроку того же класса и учителя на другой день.
function dueOf(m) {
  return m && m.role === 'homework' && m.due === 'next' ? 'next' : 'lesson';
}

// lessons.materials → пункты для ученика. Работа/тест/геометрия без способа
// выдачи («Только мне») и всё незнакомое ученику не уходят. С v3.9.358 работа
// хранится одной записью `{type:'work', id, deliver, session?}`: online —
// выдача (kind 'work'), show — только условия, paper — писали на бумаге
// (kind 'paper': ученик видит результат, когда учитель его внесёт).
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
    const base = { role: m.role === 'homework' ? 'homework' : 'class', due: dueOf(m), required: requiredOf(m) };
    const item = (fields) => out.push(Object.assign({}, fields, base));
    if (m.type === 'material') {
      item({ kind: 'file', title: m.title || 'Материал', file_url: m.url || '' });
    } else if (m.type === 'session') {
      item({ kind: 'work', title: m.title || 'Работа', session_id: m.id || '' });
    } else if (m.type === 'work_view') {
      item({ kind: 'show', title: m.title || 'Задания', work_id: m.id || '' });
    } else if (m.type === 'geometry_view') {
      item({ kind: 'show', title: m.title || 'Работа по геометрии', work_id: m.id || '', geometry: true });
    } else if (m.type === 'text') {
      item({ kind: 'text', title: m.title || '', description: m.text || '' });
    } else if (m.type === 'work' || m.type === 'mc_test') {
      // Единый список (v3.9.358): одна запись на работу, способ выдачи — deliver.
      const title = m.title || (m.type === 'mc_test' ? 'Тест' : 'Работа');
      if (m.deliver === 'online') {
        if (!m.session) continue; // выдачи нет — решать нечего
        const own = m.type === 'mc_test' ? { test_id: m.id || '' } : { work_id: m.id || '' };
        item(Object.assign({ kind: 'work', title, session_id: m.session }, own));
      } else if (m.deliver === 'show' && m.type === 'work') {
        item({ kind: 'show', title, work_id: m.id || '' });
      } else if (m.deliver === 'paper' && m.type === 'work') {
        item({ kind: 'paper', title, work_id: m.id || '' });
      }
    } else if (m.type === 'geometry_work' && m.deliver === 'show') {
      item({ kind: 'show', title: m.title || 'Работа по геометрии', work_id: m.id || '', geometry: true });
    }
  }
  return out;
}

// Дата в формате, в котором PB хранит datetime («2026-10-05 07:15:00.000Z»):
// сравнение в фильтре строковое, ISO с «T» на той же дате дал бы неверный ответ.
function pbDate(d) {
  return new Date(d).toISOString().replace('T', ' ');
}

module.exports = { materialVisible, requiredOf, dueOf, projectItems, pbDate, viewOfSessionLink };
