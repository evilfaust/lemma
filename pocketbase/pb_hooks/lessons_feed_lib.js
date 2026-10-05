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
function projectItems(materials, isCourse) {
  const arr = Array.isArray(materials) ? materials : [];
  const out = [];
  for (const m of arr) {
    if (!materialVisible(m, isCourse)) continue;
    const role = m.role === 'homework' ? 'homework' : 'class';
    const due = dueOf(m);
    if (m.type === 'material') {
      out.push({ kind: 'file', role, due, title: m.title || 'Материал', file_url: m.url || '' });
    } else if (m.type === 'session') {
      out.push({ kind: 'work', role, due, title: m.title || 'Работа', session_id: m.id || '' });
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

module.exports = { materialVisible, dueOf, projectItems, pbDate };
