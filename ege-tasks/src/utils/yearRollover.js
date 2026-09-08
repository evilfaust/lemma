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
