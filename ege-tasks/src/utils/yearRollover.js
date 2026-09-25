// Чистая логика перевода на новый учебный год: из списка групп и их составов
// собирает ПЛАН («что будет создано, кто куда переедет»), который мастер
// показывает учителю до применения. Ничего не сохраняет и не ходит в сеть —
// поэтому покрыта юнит-тестами (`src/__tests__/yearRollover.test.js`).
//
// Применение плана — в `shared/services/pb/rollover.js`.

import { nextAcademicYear, parseAcademicYear } from './academicYear';

/** Последний класс школы: из него выпускают, а не переводят. */
export const FINAL_GRADE = 11;

/** Что делать с группой: продолжить в новом году, закрыть выпуском, пропустить. */
export const GROUP_ACTIONS = { CONTINUE: 'continue', GRADUATE: 'graduate', SKIP: 'skip' };

/** Что делать с учеником. */
export const STUDENT_ACTIONS = {
  TRANSFER: 'transfer',   // в группу-наследника (или в выбранную вручную)
  GRADUATE: 'graduate',   // выпустился
  LEAVE: 'leave',         // выбыл (перестал заниматься)
  STAY: 'stay',           // не трогать: остаётся в прежней группе
};

/**
 * Имя группы следующего года: число класса в названии повышается на единицу.
 * «10 кл» → «11 кл», «9А» → «10А». Если класс не указан или в названии его
 * числа нет («12У», «Кружок»), имя остаётся прежним — учитель поправит руками.
 */
export function suggestNextGroupName(name, grade) {
  const src = String(name ?? '').trim();
  const g = Number(grade);
  if (!src || !Number.isInteger(g) || g < 1 || g > 11) return src;
  // Именно число класса, а не его вхождение в другое число («10» в «2110»).
  const re = new RegExp(`(?<!\\d)${g}(?!\\d)`);
  return re.test(src) ? src.replace(re, String(g + 1)) : src;
}

function defaultGroupAction(group) {
  // Курсы и интенсивы живут своим циклом — в ежегодный перевод не втягиваем.
  if (group.kind === 'course') return GROUP_ACTIONS.SKIP;
  if (Number(group.grade) === FINAL_GRADE) return GROUP_ACTIONS.GRADUATE;
  return GROUP_ACTIONS.CONTINUE;
}

function defaultStudentAction(groupAction) {
  if (groupAction === GROUP_ACTIONS.GRADUATE) return STUDENT_ACTIONS.GRADUATE;
  if (groupAction === GROUP_ACTIONS.SKIP) return STUDENT_ACTIONS.STAY;
  return STUDENT_ACTIONS.TRANSFER;
}

/**
 * Черновик плана перевода.
 *
 * @param {object}   p
 * @param {Array}    p.groups     группы года-источника (записи teaching_groups)
 * @param {object}   p.rosters    { [groupId]: студенты группы }
 * @param {string}   p.fromYear   учебный год источника («2025/2026»)
 * @param {string}   [p.toYear]   целевой год (по умолчанию — следующий)
 * @returns {{fromYear, toYear, groups: Array, students: Array}}
 */
export function buildRolloverPlan({ groups = [], rosters = {}, fromYear, toYear } = {}) {
  const target = toYear || nextAcademicYear(fromYear);

  const planGroups = groups.map((g) => {
    const action = defaultGroupAction(g);
    const grade = Number(g.grade);
    const nextGrade = Number.isInteger(grade) && grade >= 1 && grade < FINAL_GRADE ? grade + 1 : grade || null;
    return {
      sourceId: g.id,
      sourceName: g.name,
      kind: g.kind || 'class',
      grade: Number.isFinite(grade) && grade > 0 ? grade : null,
      action,
      // Заготовка новой группы (используется только при action = continue).
      newName: action === GROUP_ACTIONS.CONTINUE ? suggestNextGroupName(g.name, grade) : '',
      newGrade: action === GROUP_ACTIONS.CONTINUE ? nextGrade : null,
      archiveSource: action !== GROUP_ACTIONS.SKIP,
    };
  });

  const byId = new Map(planGroups.map((g) => [g.sourceId, g]));
  const planStudents = [];
  for (const g of planGroups) {
    for (const s of rosters[g.sourceId] || []) {
      planStudents.push({
        studentId: s.id,
        name: s.name || s.username || '',
        external: !!s.external,
        sourceGroupId: g.sourceId,
        action: defaultStudentAction(g.action),
        // Куда переводим: по умолчанию — наследник своей же группы.
        // Ссылаемся на sourceId, потому что id новой группы появится
        // только при применении плана.
        targetSourceId: g.action === GROUP_ACTIONS.CONTINUE ? g.sourceId : null,
      });
    }
  }

  // Ученик, чья группа не продолжается, не может «перевестись в никуда».
  for (const s of planStudents) {
    if (s.action !== STUDENT_ACTIONS.TRANSFER) continue;
    const dest = byId.get(s.targetSourceId);
    if (!dest || dest.action !== GROUP_ACTIONS.CONTINUE) {
      s.action = STUDENT_ACTIONS.STAY;
      s.targetSourceId = null;
    }
  }

  return { fromYear, toYear: target, groups: planGroups, students: planStudents };
}

/** Сводка для превью-диффа перед применением. */
export function summarizeRolloverPlan(plan) {
  const groups = plan?.groups || [];
  const students = plan?.students || [];
  const count = (list, fn) => list.filter(fn).length;
  return {
    groupsToCreate: count(groups, (g) => g.action === GROUP_ACTIONS.CONTINUE),
    groupsToArchive: count(groups, (g) => g.action !== GROUP_ACTIONS.SKIP && g.archiveSource),
    groupsSkipped: count(groups, (g) => g.action === GROUP_ACTIONS.SKIP),
    transferred: count(students, (s) => s.action === STUDENT_ACTIONS.TRANSFER),
    graduated: count(students, (s) => s.action === STUDENT_ACTIONS.GRADUATE),
    left: count(students, (s) => s.action === STUDENT_ACTIONS.LEAVE),
    stayed: count(students, (s) => s.action === STUDENT_ACTIONS.STAY),
  };
}

/** Что мешает применить план: список человекочитаемых проблем ([] = всё готово). */
export function validateRolloverPlan(plan) {
  const problems = [];
  const target = plan?.toYear;
  if (!parseAcademicYear(target)) {
    problems.push('Не указан целевой учебный год');
  }
  const creating = (plan?.groups || []).filter((g) => g.action === GROUP_ACTIONS.CONTINUE);
  for (const g of creating) {
    if (!String(g.newName || '').trim()) {
      problems.push(`Не задано название новой группы для «${g.sourceName}»`);
    }
  }
  const names = creating.map((g) => String(g.newName || '').trim().toLowerCase()).filter(Boolean);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  for (const n of Array.from(new Set(dupes))) {
    problems.push(`Две новые группы с одинаковым названием «${n}»`);
  }
  const byId = new Map((plan?.groups || []).map((g) => [g.sourceId, g]));
  for (const s of plan?.students || []) {
    if (s.action !== STUDENT_ACTIONS.TRANSFER) continue;
    const dest = byId.get(s.targetSourceId);
    if (!dest || dest.action !== GROUP_ACTIONS.CONTINUE) {
      problems.push(`Для ученика «${s.name}» не выбрана группа перевода`);
    }
  }
  return problems;
}

// ── Цепочка «тот же класс в другие годы» ────────────────────────────────────
// Перевод не переносит группу, а создаёт новую с `prev_group` на прошлогоднюю.
// Поэтому всё, что было привязано к прошлогодней группе (каникулярные кампании,
// программы, журнал), из нового класса не видно. Эти функции восстанавливают
// связь: по ним экран находит и предков, и потомков выбранной группы.

/**
 * Предки и потомки группы по `prev_group`.
 * @param {Array}  groups  все известные группы (teaching_groups, любые годы)
 * @param {string} groupId группа, от которой строим цепочку
 * @returns {{ancestors: Array, descendants: Array}} от ближайшего к дальнему
 */
export function buildGroupLineage(groups = [], groupId) {
  const byId = new Map(groups.filter(Boolean).map((g) => [g.id, g]));
  const seen = new Set([groupId]);

  const ancestors = [];
  let cur = byId.get(groupId);
  while (cur?.prev_group && !seen.has(cur.prev_group)) {
    const parent = byId.get(cur.prev_group);
    if (!parent) break;
    ancestors.push(parent);
    seen.add(parent.id);
    cur = parent;
  }

  const childrenOf = new Map();
  for (const g of groups) {
    if (!g?.prev_group) continue;
    if (!childrenOf.has(g.prev_group)) childrenOf.set(g.prev_group, []);
    childrenOf.get(g.prev_group).push(g);
  }
  const descendants = [];
  const queue = [...(childrenOf.get(groupId) || [])];
  while (queue.length) {
    const g = queue.shift();
    if (!g || seen.has(g.id)) continue;
    seen.add(g.id);
    descendants.push(g);
    queue.push(...(childrenOf.get(g.id) || []));
  }

  return { ancestors, descendants };
}

/** Id всей цепочки, включая саму группу: «этот класс во все годы». */
export function groupLineageIds(groups = [], groupId) {
  if (!groupId) return [];
  const { ancestors, descendants } = buildGroupLineage(groups, groupId);
  return [groupId, ...ancestors.map((g) => g.id), ...descendants.map((g) => g.id)];
}

/**
 * Состав группы из журнала членства.
 *
 * 🚨 Почему не «просто активные»: перевод на новый год закрывает членства
 * статусом `transferred`, но кого-то могут не перевести (ушёл в другую школу,
 * остался на второй год). Тогда у прошлогодней группы остаётся один активный
 * член — и правило «есть активные → показываем только их» схлопывало ростер
 * с двенадцати человек до одного, унося с собой их каникулярные задания.
 *
 * @param {Array}  rows        членства группы (group_memberships)
 * @param {object} [opts]
 * @param {'auto'|'active'|'all'} [opts.scope='auto']
 * @param {string} [opts.currentYear] текущий учебный год («2026/2027»)
 */
export function selectRosterMemberships(rows = [], { scope = 'auto', currentYear = '' } = {}) {
  const list = rows.filter(Boolean);
  const isActive = (m) => (m.status || 'active') === 'active';
  if (scope === 'all') return list;
  const active = list.filter(isActive);
  if (scope === 'active') return active;

  // Группа целиком переведена/выпущена — показываем её исторический состав.
  if (!active.length) return list;

  // Смешанный случай: закрытые членства ПРОШЛЫХ лет — это состав того года,
  // он и есть ростер прошлогодней группы. Выбывшие в текущем году — нет.
  const carried = list.filter((m) => !isActive(m) && m.year && currentYear && m.year !== currentYear);
  return [...active, ...carried];
}

/**
 * Членства группы + ученики, у которых указатель `students.teaching_group`
 * стоит на этой группе, а строки членства в ней нет ВОВСЕ.
 *
 * 🚨 Такие «висящие» ученики появлялись, когда ученика создавали или переводили
 * в обход `setStudentGroup`: «Вписать вручную», «Аккаунты», смена группы в
 * карточке ученика (до v3.9.238). Пока у группы не было ни одного членства,
 * их находил запасной путь по указателю; появилось первое — и они молча
 * пропадали из состава, журнала и посещаемости. Указатель и есть «где ученик
 * сейчас», поэтому такой ученик — действующий член группы: для него строится
 * синтетическая строка, дальше его отбирает тот же `selectRosterMemberships`.
 * Ученик с ЗАКРЫТЫМ членством в группе (выбыл, переведён) сюда не попадает —
 * строка у него есть.
 *
 * @param {Array}  rows      членства группы (group_memberships)
 * @param {Array}  students  ученики с teaching_group = groupId
 * @param {string} groupId
 */
export function withPointerMembers(rows = [], students = [], groupId = '') {
  const list = rows.filter(Boolean);
  const have = new Set(list.map((m) => m.student));
  const extra = students
    .filter((s) => s?.id && !have.has(s.id) && have.add(s.id))
    .map((s) => ({
      id: `pointer:${s.id}`,
      student: s.id,
      group: groupId,
      year: '',
      // Выпускник/выбывший с неснятым указателем действующим членом не считается.
      status: s.status && s.status !== 'active' ? 'left' : 'active',
      pointerOnly: true,
      expand: { student: s },
    }));
  return [...list, ...extra];
}
