import { DEFAULT_THRESHOLDS, gradeFromPercent } from './classJournal';
import { drillAnswerRows } from './drillTest';

/**
 * Выгрузка результатов работы в Excel (v3.9.321) — чистая логика без React и
 * сети. Учитель вносит бумажную работу с телефона, а в деканат нужна таблица:
 * ФИО, вариант, баллы, процент, оценка, задания «1/0» и сводка по классу
 * (решаемость заданий, средний балл, успеваемость и качество знаний).
 *
 * Компонент только загружает попытки и ответы и отдаёт результат
 * `resultsSheets` писателю `utils/xlsxWriter.js`.
 */

const DONE = new Set(['submitted', 'corrected']);
const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З'];

/** Сдана ли попытка (незаконченные в выгрузку не идут). */
export function isFinishedAttempt(attempt) {
  return DONE.has(attempt?.status);
}

/** Чей это результат: аккаунт ученика, а без него — ФИО текстом. */
export function studentKey(attempt) {
  if (attempt?.student) return `s:${attempt.student}`;
  const name = String(attempt?.student_name || '').trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
  return name ? `n:${name}` : `a:${attempt?.id}`;
}

function attemptTime(a) {
  return new Date(a?.submitted_at || a?.updated || a?.created || 0).getTime() || 0;
}

/**
 * Одна попытка на ученика — лучшая по проценту (при равенстве — более поздняя).
 * Повторная попытка и случайный дубль при вводе с телефона не должны давать
 * две строки в ведомости.
 */
export function pickBestAttempts(attempts) {
  const best = new Map();
  for (const a of attempts || []) {
    const key = studentKey(a);
    const cur = best.get(key);
    if (!cur) { best.set(key, a); continue; }
    const pa = percentOf(a);
    const pc = percentOf(cur);
    if (pa > pc || (pa === pc && attemptTime(a) > attemptTime(cur))) best.set(key, a);
  }
  return [...best.values()];
}

function percentOf(a) {
  const total = Number(a?.total) || 0;
  return total > 0 ? (Number(a?.score) || 0) / total : 0;
}

/** Номер задания (с 1) по id задачи — из порядка варианта, как у ученика. */
export function taskPositions(attempt, mcTest) {
  const map = {};
  const variant = attempt?.expand?.variant;
  if (variant) {
    let order = variant.order;
    if (typeof order === 'string') {
      try { order = JSON.parse(order); } catch { order = null; }
    }
    if (Array.isArray(order) && order.length) {
      order.forEach((o) => {
        if (o?.taskId != null && Number.isFinite(Number(o.position))) map[o.taskId] = Number(o.position) + 1;
      });
    }
    if (!Object.keys(map).length && Array.isArray(variant.tasks)) {
      variant.tasks.forEach((id, i) => { map[id] = i + 1; });
    }
  }
  if (!Object.keys(map).length && mcTest) {
    const v = (mcTest.variants || []).find(
      (x) => String(x.number) === String(attempt?.mc_variant ?? attempt?.variant),
    );
    (v?.tasks || []).forEach((t, i) => {
      const id = t.task_id || t.id;
      if (id) map[id] = i + 1;
    });
  }
  return map;
}

/** Ответ теста с выбором хранится номером варианта ответа — пишем буквой. */
function choiceLetter(raw, isChoice) {
  if (!isChoice) return raw;
  const i = Number.parseInt(raw, 10);
  return Number.isInteger(i) && i >= 0 && i < LETTERS.length ? LETTERS[i] : raw;
}

/**
 * Задания попытки: [{ position, correct, given }], позиция с 1.
 * answers — строки attempt_answers этой попытки (у тренировки из генератора их
 * нет: ответы в самой попытке, `drill_answers`).
 */
export function attemptItems(attempt, answers, mcTest) {
  if (Array.isArray(attempt?.drill_answers)) {
    return drillAnswerRows(attempt, mcTest)
      .filter((r) => Number.isFinite(r.position))
      .map((r) => ({
        position: r.position,
        correct: !!r.is_correct,
        given: r.given == null ? '' : String(r.given),
      }))
      .sort((x, y) => x.position - y.position);
  }
  const positions = taskPositions(attempt, mcTest);
  const isChoice = !!mcTest && !attempt?.expand?.variant;
  const list = answers || [];
  const out = [];
  list.forEach((a, i) => {
    const pos = positions[a.task] ?? (Object.keys(positions).length ? null : i + 1);
    if (!pos) return;
    out.push({
      position: pos,
      correct: !!a.is_correct,
      given: choiceLetter(a.answer_raw == null ? '' : String(a.answer_raw), isChoice),
    });
  });
  return out.sort((x, y) => x.position - y.position);
}

function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function variantLabel(attempt) {
  return attempt?.expand?.variant?.number ?? attempt?.mc_variant ?? (
    typeof attempt?.variant === 'string' && /^\d+$/.test(attempt.variant) ? attempt.variant : ''
  );
}

const round1 = (x) => Math.round(x * 10) / 10;

/**
 * Таблица результатов.
 * → { rows: [{ name, session, variant, date, items: {pos: {correct, given}},
 *              score, total, pct, grade }], taskCount, summary }
 */
export function buildResultsTable({
  attempts,
  answersByAttempt = {},
  mcTest = null,
  bestOnly = true,
  thresholds = DEFAULT_THRESHOLDS,
} = {}) {
  let list = (attempts || []).filter(isFinishedAttempt);
  if (bestOnly) list = pickBestAttempts(list);

  const rows = list.map((a) => {
    const items = {};
    for (const it of attemptItems(a, answersByAttempt[a.id], mcTest)) items[it.position] = it;
    const score = Number(a.score) || 0;
    const total = Number(a.total) || 0;
    const pct = total > 0 ? Math.round((score / total) * 100) : null;
    return {
      id: a.id,
      name: String(a.student_name || '').trim() || 'Без имени',
      session: a.session,
      variant: variantLabel(a),
      date: formatDate(a.submitted_at || a.created),
      items,
      score,
      total,
      pct,
      grade: pct == null ? null : gradeFromPercent((score / total) * 100, thresholds),
    };
  }).sort((x, y) => x.name.localeCompare(y.name, 'ru') || String(x.variant).localeCompare(String(y.variant), 'ru'));

  const taskCount = rows.reduce((m, r) => Math.max(
    m,
    r.total || 0,
    ...Object.keys(r.items).map(Number),
  ), 0);

  return { rows, taskCount, summary: summarizeResults(rows, taskCount) };
}

/** Сводка по классу: решаемость заданий, средние, оценки, успеваемость, качество. */
export function summarizeResults(rows, taskCount) {
  const solved = [];
  for (let p = 1; p <= taskCount; p++) {
    let n = 0;
    let c = 0;
    for (const r of rows) {
      const it = r.items[p];
      if (!it) continue;
      n++;
      if (it.correct) c++;
    }
    solved.push(n ? Math.round((c / n) * 100) : null);
  }
  const withPct = rows.filter((r) => r.pct != null);
  const avgScore = rows.length ? round1(rows.reduce((s, r) => s + r.score, 0) / rows.length) : null;
  const avgPct = withPct.length ? Math.round(withPct.reduce((s, r) => s + r.pct, 0) / withPct.length) : null;
  const grades = { 5: 0, 4: 0, 3: 0, 2: 0 };
  rows.forEach((r) => { if (r.grade in grades) grades[r.grade]++; });
  const graded = grades[5] + grades[4] + grades[3] + grades[2];
  const avgGrade = graded
    ? round1((grades[5] * 5 + grades[4] * 4 + grades[3] * 3 + grades[2] * 2) / graded)
    : null;
  return {
    count: rows.length,
    solved,
    avgScore,
    avgPct,
    grades,
    avgGrade,
    // Успеваемость — доля «3» и выше, качество знаний — доля «4» и «5».
    success: graded ? Math.round(((grades[5] + grades[4] + grades[3]) / graded) * 100) : null,
    quality: graded ? Math.round(((grades[5] + grades[4]) / graded) * 100) : null,
  };
}

const cell = (v, s) => ({ v, s });

/**
 * Листы книги для `xlsxWriter.buildXlsx`.
 * meta: { title, subtitle?, sessionLabels? }
 * options: { withTasks = true, withGrade = true, withAnswers = true, thresholds }
 */
export function resultsSheets(table, meta = {}, options = {}) {
  const { withTasks = true, withGrade = true, withAnswers = true, thresholds = DEFAULT_THRESHOLDS } = options;
  const { rows, taskCount, summary } = table;
  const labels = meta.sessionLabels || null;
  const showSession = !!labels && new Set(rows.map((r) => r.session)).size > 1;
  const taskCols = withTasks ? taskCount : 0;

  const head = ['№', 'Ученик'];
  if (showSession) head.push('Выдача');
  head.push('Вариант', 'Дата');
  for (let p = 1; p <= taskCols; p++) head.push(String(p));
  head.push('Баллы', 'Из', '%');
  if (withGrade) head.push('Оценка');
  const width = head.length;
  const firstTaskCol = showSession ? 5 : 4;
  const scoreCol = firstTaskCol + taskCols;

  const out = [];
  out.push([cell(meta.title || 'Результаты работы', 'title')]);
  const sub = [meta.subtitle, `Учеников: ${summary.count}`].filter(Boolean).join(' · ');
  out.push([cell(sub, 'muted')]);
  out.push([]);
  const headerRow = out.length;
  out.push(head.map((h) => cell(h, 'header')));

  rows.forEach((r, i) => {
    const line = [cell(i + 1, 'cellCenter'), cell(r.name, 'cell')];
    if (showSession) line.push(cell(labels?.[r.session] || '', 'cell'));
    line.push(cell(r.variant === '' ? '' : Number(r.variant) || r.variant, 'cellCenter'), cell(r.date, 'cellCenter'));
    for (let p = 1; p <= taskCols; p++) {
      const it = r.items[p];
      line.push(cell(it ? (it.correct ? 1 : 0) : '', 'cellCenter'));
    }
    line.push(cell(r.score, 'cellCenter'), cell(r.total || '', 'cellCenter'), cell(r.pct ?? '', 'cellCenter'));
    if (withGrade) line.push(cell(r.grade ?? '', 'cellCenter'));
    out.push(line);
  });

  // Итоговая строка: решаемость каждого задания и средние по классу.
  if (rows.length) {
    const total = Array.from({ length: width }, () => cell('', 'total'));
    total[1] = cell(taskCols ? 'Решили, %' : 'Среднее', 'total');
    for (let p = 1; p <= taskCols; p++) total[firstTaskCol + p - 1] = cell(summary.solved[p - 1] ?? '', 'totalCenter');
    total[scoreCol] = cell(summary.avgScore ?? '', 'totalCenter');
    total[scoreCol + 1] = cell('', 'totalCenter');
    total[scoreCol + 2] = cell(summary.avgPct ?? '', 'totalCenter');
    if (withGrade) total[scoreCol + 3] = cell(summary.avgGrade ?? '', 'totalCenter');
    out.push(total);
  }

  if (withGrade && rows.length) {
    out.push([]);
    const g = summary.grades;
    out.push([cell('', 'normal'), cell('Оценки', 'bold'), cell(`«5» — ${g[5]}, «4» — ${g[4]}, «3» — ${g[3]}, «2» — ${g[2]}`)]);
    out.push([cell(''), cell('Средний балл (оценка)', 'bold'), cell(summary.avgGrade ?? '')]);
    out.push([cell(''), cell('Успеваемость, %', 'bold'), cell(summary.success ?? '')]);
    out.push([cell(''), cell('Качество знаний, %', 'bold'), cell(summary.quality ?? '')]);
    out.push([cell(''), cell(
      `Оценка по проценту выполнения: «5» от ${thresholds[5]} %, «4» от ${thresholds[4]} %, «3» от ${thresholds[3]} %`,
      'muted',
    )]);
  }

  const cols = [5, 32];
  if (showSession) cols.push(22);
  cols.push(9, 12);
  for (let p = 1; p <= taskCols; p++) cols.push(taskCols > 15 ? 4.5 : 5.5);
  cols.push(8, 6, 7);
  if (withGrade) cols.push(9);

  const sheets = [{
    name: 'Результаты',
    rows: out,
    cols,
    freeze: { row: headerRow + 1, col: 2 },
    merges: [`A1:${colName(Math.max(width, 3) - 1)}1`, `A2:${colName(Math.max(width, 3) - 1)}2`],
  }];

  if (withAnswers && taskCount > 0 && rows.some((r) => Object.values(r.items).some((it) => it.given !== ''))) {
    sheets.push(answersSheet(table, meta, showSession, labels));
  }
  return sheets;
}

/** Буква колонки Excel (0 → A). Своя копия: модуль не тянет за собой zip. */
function colName(i) {
  let n = i + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Второй лист — что ученик написал в каждом задании (для спорных случаев). */
function answersSheet(table, meta, showSession, labels) {
  const { rows, taskCount } = table;
  const head = ['№', 'Ученик'];
  if (showSession) head.push('Выдача');
  head.push('Вариант');
  for (let p = 1; p <= taskCount; p++) head.push(String(p));
  const out = [
    [cell(`${meta.title || 'Результаты работы'} — ответы учеников`, 'title')],
    [cell('Ответ, который записан у ученика; неверные отмечены знаком «✗».', 'muted')],
    [],
    head.map((h) => cell(h, 'header')),
  ];
  rows.forEach((r, i) => {
    const line = [cell(i + 1, 'cellCenter'), cell(r.name, 'cell')];
    if (showSession) line.push(cell(labels?.[r.session] || '', 'cell'));
    line.push(cell(r.variant === '' ? '' : Number(r.variant) || r.variant, 'cellCenter'));
    for (let p = 1; p <= taskCount; p++) {
      const it = r.items[p];
      if (!it) { line.push(cell('', 'cellCenter')); continue; }
      const given = it.given === '' ? '—' : it.given;
      line.push(cell(it.correct ? given : `${given} ✗`, 'cellCenter'));
    }
    out.push(line);
  });
  const cols = [5, 32];
  if (showSession) cols.push(22);
  cols.push(9);
  for (let p = 1; p <= taskCount; p++) cols.push(10);
  return {
    name: 'Ответы',
    rows: out,
    cols,
    freeze: { row: 4, col: 2 },
    merges: [`A1:${colName(Math.max(head.length, 3) - 1)}1`, `A2:${colName(Math.max(head.length, 3) - 1)}2`],
  };
}

/** Имя файла: «Контрольная 3 — 10А — 07.10.2026». */
export function resultsFileName({ title, groupName, date } = {}) {
  return [title || 'Результаты', groupName, date].filter(Boolean).join(' — ');
}
