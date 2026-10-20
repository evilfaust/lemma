// Ученик в нескольких группах сразу (v3.9.386).
//
// Малые группы бывают почти индивидуальными, и один ученик ходит в две:
// «11 ЕГЭ» и «Параметр». Журнал членства (`group_memberships`) с самого
// начала многие-ко-многим — уникальна только пара (ученик, группа). Одну
// группу предполагал лишь `setStudentGroup`: «добавить в группу» у него
// значило «перевести», и прежнее членство молча закрывалось. Так Иван,
// добавленный в «Параметр», пропал из «11 ЕГЭ» — из журнала, посещаемости и
// своих же уроков в кабинете.
//
// Здесь — чистые правила: какие членства открыть, какие закрыть и куда
// поставить указатель `students.teaching_group`. Указатель теперь значит
// «основная группа»: по нему подписан ученик в списках и пикерах, а состав
// любой группы, как и раньше, читается из членств. Применение плана —
// `groupsApi.applyStudentGroups` (shared/services/pb/groups.js).

const isActive = (m) => (m?.status || 'active') === 'active';

/**
 * Группы, в которых ученик сейчас состоит, — основная первой.
 *
 * Указатель без строки членства тоже считается (как в `withPointerMembers`):
 * таких учеников создавали в обход журнала. Указатель на группу, где строка
 * закрыта, — нет: ученик из неё выбыл, указатель просто не успели снять.
 *
 * @param {Array}  memberships  членства ученика (group_memberships)
 * @param {string} pointer      students.teaching_group
 * @returns {string[]}
 */
export function activeGroupIds(memberships = [], pointer = '') {
  const rows = memberships.filter(Boolean);
  const ids = [];
  const push = (id) => { if (id && !ids.includes(id)) ids.push(id); };
  const pointerRow = pointer ? rows.find((m) => m.group === pointer) : null;
  if (pointer && (!pointerRow || isActive(pointerRow))) push(pointer);
  rows.filter(isActive).forEach((m) => push(m.group));
  return ids;
}

/**
 * План «у ученика должны быть ровно эти группы».
 *
 * Основная группа: выбранная явно, если она в списке; иначе прежняя, если
 * ученик в ней остаётся; иначе первая из списка; пустой список — без группы.
 *
 * @param {object}   p
 * @param {string[]} p.active   где ученик состоит сейчас (activeGroupIds)
 * @param {string}   p.pointer  текущая основная группа
 * @param {string[]} p.wanted   где он должен состоять
 * @param {string}   [p.primary] желаемая основная группа
 * @returns {{join: string[], close: string[], pointer: string}}
 */
export function planStudentGroups({ active = [], pointer = '', wanted = [], primary = '' } = {}) {
  const want = [...new Set(wanted.filter(Boolean))];
  const join = want.filter((id) => !active.includes(id));
  const close = active.filter((id) => !want.includes(id));
  let next = '';
  if (primary && want.includes(primary)) next = primary;
  else if (pointer && want.includes(pointer)) next = pointer;
  else next = want[0] || '';
  return { join, close, pointer: next };
}

/**
 * Добавить ученика в группу.
 * move = false — остаётся и во всех прежних (по умолчанию, решение 20.10.2026);
 * move = true  — «перевести сюда»: прежние группы закрываются.
 */
export function planJoinGroup({ active = [], pointer = '', groupId, move = false } = {}) {
  if (move) return planStudentGroups({ active, pointer, wanted: [groupId], primary: groupId });
  return planStudentGroups({ active, pointer, wanted: [...active, groupId] });
}

/** Убрать ученика из одной группы; остальные не трогаются. */
export function planLeaveGroup({ active = [], pointer = '', groupId } = {}) {
  return planStudentGroups({ active, pointer, wanted: active.filter((id) => id !== groupId) });
}

/**
 * Действующие группы всех учеников разом: { [studentId]: groupId[] }.
 * Для подписи «где ещё учится» в пикерах и для «Прогресса учеников».
 *
 * @param {Array} memberships  членства (любых учеников, лишние статусы отсеются)
 * @param {Array} students     ученики с полем teaching_group
 */
export function groupsByStudent(memberships = [], students = []) {
  const rowsBy = new Map();
  for (const m of memberships) {
    if (!m?.student) continue;
    if (!rowsBy.has(m.student)) rowsBy.set(m.student, []);
    rowsBy.get(m.student).push(m);
  }
  const out = {};
  for (const s of students) {
    if (!s?.id) continue;
    out[s.id] = activeGroupIds(rowsBy.get(s.id) || [], s.teaching_group || '');
  }
  return out;
}
