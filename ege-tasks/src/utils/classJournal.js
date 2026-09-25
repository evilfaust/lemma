// Журнал класса (v3.9.236) — чистая логика: без сети и React, под тестами
// `__tests__/classJournal.test.js`.
//
// Журнал = ученики × колонки. Колонка — одна проверка любого происхождения:
//   • ручная (source 'manual') — отметку ставит учитель: устный счёт, опрос,
//     бумажная самостоятельная;
//   • онлайн-работа Lemma ('work' / 'session') — значение берётся из попыток
//     (лучшая по всем выдачам работы), запись в journal_marks — ручная правка
//     поверх результата («переписал на бумаге»).
// Колонки из БД (`journal_columns`) и «найденные» онлайн-работы (по попыткам
// учеников класса, записи ещё нет) сводит `mergeColumns`.
// Колонка может быть привязана к уроку календаря (`lesson`): тогда отсутствие
// по посещаемости урока само даёт «н» в пустой клетке (v3.9.239).
//
// Клетка хранится ТЕКСТОМ в каноническом виде (`journal_marks.value`):
//   «18», «7.5» — число (смысл задаёт шкала колонки)
//   «1» / «0»   — зачёт / незачёт
//   «н»         — не был / не писал
// Числовое поле PocketBase не отличает «пусто» от нуля, а 0 баллов — законная
// отметка, поэтому текст.

import { parseAcademicYear } from './academicYear';

export const ABSENT = 'н';

export const SCALES = ['points', 'grade', 'pass', 'percent'];

export const SCALE_LABELS = {
  points: 'Баллы',
  grade: 'Оценка 2–5',
  pass: 'Зачёт',
  percent: 'Проценты',
};

/** Пороги перевода в оценку — доля от максимума, %. «5» от 85 %, «4» от 65 %, «3» от 45 %. */
export const DEFAULT_THRESHOLDS = Object.freeze({ 5: 85, 4: 65, 3: 45 });

/** Подсказки категорий — поле свободное, это только варианты для автодополнения. */
export const CATEGORY_SUGGESTIONS = [
  'Устный счёт', 'Самостоятельная', 'Контрольная', 'Интенсив', 'Опрос', 'Домашняя', 'Тест',
];

export const WEIGHT_OPTIONS = [1, 1.5, 2, 3];

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

// ─── Колонка ────────────────────────────────────────────────────────────────

export function isOnlineSource(source) {
  return source === 'work' || source === 'session';
}

/** Шкала колонки. Онлайн-колонка всегда в процентах: это доля верных в попытке. */
export function columnScale(col) {
  if (isOnlineSource(col?.source)) return 'percent';
  return SCALES.includes(col?.scale) ? col.scale : 'points';
}

/**
 * Вес колонки в среднем. 0 — не учитывается. Пустой вес читается как 1:
 * числовое поле PocketBase хранит «не задано» нулём.
 */
export function columnWeight(col) {
  if (col?.no_avg || col?.noAvg) return 0;
  const w = Number(col?.weight);
  return w > 0 ? w : 1;
}

/** Пороги 5/4/3 в процентах; мусор и пропуски — из умолчаний, порядок гарантирован. */
export function normalizeThresholds(t) {
  const src = t && typeof t === 'object' ? t : {};
  const pick = (k) => {
    const v = Number(src[k]);
    return Number.isFinite(v) && v >= 0 && v <= 100 ? v : DEFAULT_THRESHOLDS[k];
  };
  const five = pick(5);
  const four = Math.min(pick(4), five);
  const three = Math.min(pick(3), four);
  return { 5: five, 4: four, 3: three };
}

/** Оценка по проценту выполнения. */
export function gradeFromPercent(pct, thresholds = DEFAULT_THRESHOLDS) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const t = normalizeThresholds(thresholds);
  // Эпсилон: 13 из 20 = 65 %, а не 64,999…
  const p = pct + 1e-9;
  if (p >= t[5]) return 5;
  if (p >= t[4]) return 4;
  if (p >= t[3]) return 3;
  return 2;
}

/**
 * С какого балла начинается каждая оценка — подсказка учителю, который
 * думает баллами, а не процентами: «5 — от 17, 4 — от 13, 3 — от 9».
 */
export function thresholdPoints(max, thresholds) {
  const m = Number(max);
  if (!(m > 0)) return null;
  const t = normalizeThresholds(thresholds);
  const need = (pct) => Math.ceil((m * pct) / 100 - 1e-9);
  return { 5: need(t[5]), 4: need(t[4]), 3: need(t[3]) };
}

// ─── Даты ───────────────────────────────────────────────────────────────────

/** 'YYYY-MM-DD' из даты PocketBase («2026-09-25 12:00:00.000Z») или null. */
export function dayOf(value) {
  const m = String(value || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Местный день метки времени (created сессии — это UTC-время, не дата). */
export function localDay(value) {
  if (!value) return null;
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return dayOf(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Дата колонки для записи в PocketBase. Полдень UTC — чтобы день не уехал
 * ни в одном часовом поясе России (полночь МСК — это ещё вчера по UTC).
 */
export function toStoredDate(day) {
  const d = dayOf(day);
  return d ? `${d} 12:00:00.000Z` : '';
}

/** «25.09» */
export function shortDay(day) {
  const d = dayOf(day);
  if (!d) return '';
  const [, m, dd] = d.split('-');
  return `${dd}.${m}`;
}

export function monthKey(day) {
  const d = dayOf(day);
  return d ? d.slice(0, 7) : null;
}

export function monthLabel(key) {
  const m = Number(String(key || '').slice(5, 7));
  return MONTHS[m - 1] || 'Без даты';
}

/**
 * Окно учебного года для попыток: с 1 августа по 31 июля (граница года та же,
 * что в `academicYear.js`). Журнал — на год, иначе в новый класс приехали бы
 * прошлогодние онлайн-работы тех же учеников.
 */
export function yearWindow(year) {
  const start = parseAcademicYear(year);
  if (!start) return null;
  return { from: `${start}-08-01 00:00:00.000Z`, to: `${start + 1}-08-01 00:00:00.000Z` };
}

/** День урока: фактический, если урок перенесли, иначе плановый. */
export function lessonDay(lesson) {
  return localDay(lesson?.date_fact || lesson?.date_plan);
}

// ─── Посещаемость ───────────────────────────────────────────────────────────

/** Статусы посещаемости, которые в журнале читаются как «н». */
export const ABSENT_STATUSES = new Set(['absent', 'excused']);

/** Отметки посещаемости → Map<`${lesson}|${student}`, статус>. */
export function indexAttendance(rows = []) {
  const map = new Map();
  for (const r of rows) {
    if (r?.lesson && r?.student && r?.status) map.set(`${r.lesson}|${r.student}`, r.status);
  }
  return map;
}

// ─── Значение клетки ────────────────────────────────────────────────────────

const ABSENT_ALIASES = new Set(['н', 'нб', 'н/б', 'н\\б', 'n', 'y']); // y — «н» в латинской раскладке
const PASS_YES = new Set(['+', 'з', 'зач', 'зачет', 'зачёт', 'да', '1', '✓', 'v']);
const PASS_NO = new Set(['-', '−', '–', '—', 'нз', 'н/з', 'незач', 'незачет', 'незачёт', 'нет', '0', '✗', 'x', 'х']);

/** Хранимый текст → { value: число|null, absent }. */
export function decodeValue(stored) {
  const s = String(stored ?? '').trim();
  if (!s) return { value: null, absent: false };
  if (s === ABSENT) return { value: null, absent: true };
  const n = Number(s);
  return Number.isFinite(n) ? { value: n, absent: false } : { value: null, absent: false };
}

function parseNumber(s) {
  const t = String(s).replace(/\s+/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Число в каноническую запись: «7.5», без хвостовых нулей. */
function canon(n) {
  return String(Math.round(n * 100) / 100);
}

/**
 * Разбор ввода учителя по шкале колонки.
 * → { ok: true, stored } (stored '' = очистить клетку) | { ok: false, error }
 */
export function parseCellInput(raw, col) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return { ok: true, stored: '' };
  if (ABSENT_ALIASES.has(s)) return { ok: true, stored: ABSENT };

  const scale = columnScale(col);
  const tail = ' или «н» — не был';

  if (scale === 'pass') {
    if (PASS_YES.has(s)) return { ok: true, stored: '1' };
    if (PASS_NO.has(s)) return { ok: true, stored: '0' };
    return { ok: false, error: `Зачёт — «+» или «з», незачёт — «−» или «нз»${tail}` };
  }

  if (scale === 'grade') {
    const n = parseNumber(s);
    if (n != null && Number.isInteger(n) && n >= 1 && n <= 5) return { ok: true, stored: String(n) };
    return { ok: false, error: `Оценка — целое число от 1 до 5${tail}` };
  }

  if (scale === 'percent') {
    const n = parseNumber(s.replace(/%$/, ''));
    if (n != null && n <= 100) return { ok: true, stored: canon(n) };
    return { ok: false, error: `Проценты — число от 0 до 100${tail}` };
  }

  // Баллы. «18/20» из чужой таблицы принимаем, если знаменатель — максимум колонки.
  const max = Number(col?.max_score ?? col?.max) || 0;
  let n = parseNumber(s);
  const frac = s.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (n == null && frac) {
    const den = parseNumber(frac[2]);
    if (max > 0 && den === max) n = parseNumber(frac[1]);
  }
  const range = max > 0 ? `от 0 до ${canon(max).replace('.', ',')}` : 'не меньше 0';
  if (n == null || (max > 0 && n > max)) {
    return { ok: false, error: `Баллы — число ${range}${tail}` };
  }
  return { ok: true, stored: canon(n) };
}

/** Текст для редактора, когда учитель правит уже стоящую отметку. */
export function editText(col, stored) {
  const { value, absent } = decodeValue(stored);
  if (absent) return ABSENT;
  if (value == null) return '';
  if (columnScale(col) === 'pass') return value >= 1 ? 'з' : 'нз';
  return formatNumber(value);
}

export function formatNumber(n) {
  if (n == null || !Number.isFinite(n)) return '';
  return canon(n).replace('.', ',');
}

export function formatAvg(x) {
  return x == null ? '' : x.toFixed(1).replace('.', ',');
}

/** Процент выполнения значения (для баллов и процентов), иначе null. */
export function percentOf(col, value) {
  if (value == null) return null;
  const scale = columnScale(col);
  if (scale === 'percent') return value;
  if (scale === 'points') {
    const max = Number(col?.max_score ?? col?.max) || 0;
    return max > 0 ? (value * 100) / max : null;
  }
  return null;
}

/** Оценка значения по шкале колонки. Зачёт оценкой не считается. */
export function gradeOfValue(col, value) {
  if (value == null) return null;
  const scale = columnScale(col);
  if (scale === 'grade') return value;
  if (scale === 'pass') return null;
  return gradeFromPercent(percentOf(col, value), col?.thresholds);
}

export const GRADE_TONE = { 5: 'teal', 4: 'blue', 3: 'amber', 2: 'rose', 1: 'rose' };

// ─── Онлайн-работы ──────────────────────────────────────────────────────────

/** Ключ онлайн-колонки: работа целиком (все её выдачи) либо отдельная выдача (тест A/B/C/D). */
export function onlineKey(session) {
  if (!session) return null;
  return session.work ? `w:${session.work}` : `s:${session.id}`;
}

function sessionTitle(s) {
  const e = s?.expand || {};
  return e.work?.title || s?.student_title || e.mc_test?.title || e.trig_mc_test?.title || 'Работа';
}

const attemptPct = (a) => (a?.total ? (a.score || 0) / a.total : (a?.score || 0) / 1e6);

/**
 * Попытки учеников класса → онлайн-колонки и их клетки.
 * attempts — записи `attempts` с expand session (+ work / mc_test / trig_mc_test).
 * Одна работа = одна колонка, сколько бы выдач у неё ни было (летняя программа
 * заводит выдачу на каждого ученика) — берётся лучшая попытка по всем.
 * → { columns: Map<key, info>, cells: Map<`${studentId}|${key}`, agg> }
 */
export function collectOnline(attempts = []) {
  const columns = new Map();
  const cells = new Map();

  for (const att of attempts) {
    const sess = att?.expand?.session;
    if (!sess || !att.student) continue;
    const key = onlineKey(sess);

    let info = columns.get(key);
    if (!info) {
      info = {
        key,
        source: sess.work ? 'work' : 'session',
        workId: sess.work || '',
        sessionId: sess.work ? '' : sess.id,
        title: sessionTitle(sess),
        sessions: new Map(),
      };
      columns.set(key, info);
    }
    let si = info.sessions.get(sess.id);
    if (!si) {
      si = { id: sess.id, created: sess.created, deadline: sess.deadline || '', students: new Set() };
      info.sessions.set(sess.id, si);
    }
    si.students.add(att.student);

    const ck = `${att.student}|${key}`;
    const agg = cells.get(ck) || { best: null, bestSession: null, started: false };
    if (att.status === 'submitted' || att.status === 'corrected') {
      if (!agg.best || attemptPct(att) > attemptPct(agg.best)) {
        agg.best = att;
        agg.bestSession = sess;
      }
    } else if (att.status === 'started') {
      agg.started = true;
    }
    cells.set(ck, agg);
  }

  for (const info of columns.values()) {
    const list = [...info.sessions.values()];
    const days = list.map((s) => localDay(s.created)).filter(Boolean).sort();
    info.day = days[0] || null;
    const maxDeadline = (arr) => arr.map((s) => s.deadline).filter(Boolean).sort().pop() || '';
    info.deadline = maxDeadline(list);
    // «Просрочено» тем, кто вообще не открывал работу, ставим только по выдаче
    // КЛАССУ — её открыли хотя бы двое. Персональные выдачи (летняя программа)
    // иначе объявили бы должниками всех, кому эту работу не давали.
    info.classDeadline = maxDeadline(list.filter((s) => s.students.size >= 2));
  }

  return { columns, cells };
}

/**
 * Статус онлайн-клетки. assigned — колонку учитель завёл сам («Работа Lemma»):
 * значит, выдана всему классу, и срок касается каждого.
 * → { kind: passed|late|failed|overdue|in_progress|none, pct, tip }
 */
export function onlineStatus(col, agg, { now = new Date(), assigned = false } = {}) {
  const fmt = (v) => {
    const d = new Date(String(v).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const past = (v) => v && new Date(String(v).replace(' ', 'T')).getTime() < now.getTime();

  if (agg?.best) {
    const a = agg.best;
    const s = agg.bestSession || {};
    const pct = a.total ? Math.round(((a.score || 0) * 100) / a.total) : null;
    const late = !!(s.deadline && a.submitted_at && a.submitted_at > s.deadline);
    const ps = Number(s.passing_score) || 0;
    let kind = late ? 'late' : 'passed';
    const parts = [`${a.score ?? 0}${a.total ? ` из ${a.total}` : ''}`];
    if (ps >= 1) {
      const pass = (a.score || 0) >= ps;
      if (!pass) kind = 'failed';
      parts.push(pass ? 'зачёт' : `незачёт (порог ${ps})`);
    }
    if (a.submitted_at) parts.push(`сдано ${fmt(a.submitted_at)}`);
    if (late) parts.push('после срока');
    if (a.source === 'scan') parts.push('бумажный бланк');
    return { kind, pct, tip: parts.join(' · ') };
  }
  if (agg?.started) return { kind: 'in_progress', pct: null, tip: 'Начал, но не сдал' };
  const deadline = assigned ? col?.deadline : col?.classDeadline;
  if (past(deadline)) return { kind: 'overdue', pct: null, tip: `Не сдал, срок ${fmt(deadline)}` };
  return { kind: 'none', pct: null, tip: 'Не сдавал' };
}

// ─── Колонки журнала ────────────────────────────────────────────────────────

/**
 * Колонки из БД + найденные онлайн-работы → единый список по дате.
 * Колонка: { key, id, virtual, source, online, title, day, scale, max_score,
 *   thresholds, weight, no_avg, hidden, category, note, owner, workId,
 *   sessionId, deadline, classDeadline, assigned, created, record }
 * sessionDeadlines — Map<key, срок> выдач работ, которые учитель завёл в журнал
 * сам: по такой работе ещё может не быть ни одной попытки, а срок уже идёт.
 */
export function mergeColumns(stored = [], online = new Map(), { sessionDeadlines = new Map() } = {}) {
  const out = [];
  const used = new Set();

  for (const rec of stored) {
    const source = rec.source || 'manual';
    const isOnline = isOnlineSource(source);
    const key = source === 'work' && rec.work ? `w:${rec.work}`
      : source === 'session' && rec.session ? `s:${rec.session}`
        : `m:${rec.id}`;
    const info = isOnline ? online.get(key) : null;
    used.add(key);
    out.push({
      key,
      id: rec.id,
      virtual: false,
      source,
      online: isOnline,
      title: rec.title || info?.title || 'Без названия',
      day: dayOf(rec.date) || info?.day || null,
      scale: isOnline ? 'percent' : columnScale(rec),
      max_score: Number(rec.max_score) || 0,
      thresholds: rec.thresholds || null,
      weight: rec.weight,
      no_avg: !!rec.no_avg,
      hidden: !!rec.hidden,
      category: rec.category || '',
      note: rec.note || '',
      owner: rec.owner || '',
      workId: rec.work || info?.workId || '',
      sessionId: rec.session || info?.sessionId || '',
      lessonId: rec.lesson || '',
      deadline: info?.deadline || sessionDeadlines.get(key) || '',
      classDeadline: info?.classDeadline || '',
      // Работа выдана классу целиком (учитель сам завёл колонку) — срок
      // касается каждого. Закреплённая ради правки одной клетки — нет.
      assigned: isOnline && !!rec.assigned,
      created: rec.created || '',
      record: rec,
    });
  }

  for (const info of online.values()) {
    if (used.has(info.key)) continue;
    out.push({
      key: info.key,
      id: null,
      virtual: true,
      source: info.source,
      online: true,
      title: info.title,
      day: info.day,
      scale: 'percent',
      max_score: 0,
      thresholds: null,
      weight: 1,
      no_avg: false,
      hidden: false,
      category: '',
      note: '',
      owner: '',
      workId: info.workId,
      sessionId: info.sessionId,
      lessonId: '',
      deadline: info.deadline,
      classDeadline: info.classDeadline,
      assigned: false,
      created: '',
      record: null,
    });
  }

  return out.sort((a, b) => {
    if (a.day !== b.day) {
      if (!a.day) return 1;
      if (!b.day) return -1;
      return a.day < b.day ? -1 : 1;
    }
    if (a.created !== b.created) {
      if (!a.created) return 1;
      if (!b.created) return -1;
      return a.created < b.created ? -1 : 1;
    }
    return String(a.title).localeCompare(String(b.title), 'ru');
  });
}

/** Месяцы, в которых есть колонки: [{ key: '2026-09', label: 'Сентябрь', count }]. */
export function columnMonths(columns = []) {
  const map = new Map();
  for (const c of columns) {
    const k = monthKey(c.day);
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, count]) => ({ key, label: monthLabel(key), count }));
}

export function inPeriod(col, period) {
  if (!period || period === 'all') return true;
  return monthKey(col.day) === period;
}

/** Шапка месяцев: подряд идущие колонки одного месяца → { key, label, span }. */
export function monthSpans(columns = []) {
  const spans = [];
  for (const c of columns) {
    const k = monthKey(c.day) || 'none';
    const last = spans[spans.length - 1];
    if (last && last.key === k) last.span += 1;
    else spans.push({ key: k, label: k === 'none' ? 'Без даты' : monthLabel(k), span: 1 });
  }
  return spans;
}

/** «Устный счёт 3» → «Устный счёт 4»; без номера — то же название. */
export function suggestNextTitle(title) {
  const t = String(title || '').trim();
  const m = t.match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return t;
  return `${m[1]}${Number(m[2]) + 1}${m[3]}`;
}

// ─── Клетки и сводки ────────────────────────────────────────────────────────

export const markKey = (colId, studentId) => `${colId}|${studentId}`;

export function indexMarks(marks = []) {
  const map = new Map();
  for (const m of marks) map.set(markKey(m.col, m.student), m);
  return map;
}

/**
 * Клетка «колонка × ученик».
 * → { kind: empty|manual|online|override|absent («н» из посещаемости), stored, absent, value, grade, text,
 *     tone, textTone, status, comment, tip, editable }
 */
export function resolveCell(col, mark, agg, { mode = 'raw', now, former = false, attendance } = {}) {
  const comment = mark?.comment || '';
  const stored = mark?.value || '';
  // Выбывшему работы класса уже не выдаются — «долгом» его не считаем.
  const status = col.online
    ? onlineStatus(former ? { ...col, classDeadline: '' } : col, agg, { now, assigned: col.assigned && !former })
    : null;

  // Не был на уроке, к которому привязана колонка, — пустая клетка сама
  // становится «н». Ручная отметка главнее (написал позже — учитель вписал
  // балл), онлайн-результат тоже: работу могли сдать и из дома.
  const missed = !stored && ABSENT_STATUSES.has(attendance)
    && (!col.online || !status || status.kind === 'none' || status.kind === 'overdue');
  if (missed) {
    const excused = attendance === 'excused';
    return {
      kind: 'absent',
      stored: '', absent: true, value: null, grade: null,
      text: ABSENT, tone: null, textTone: 'muted', status, comment,
      excused, fromAttendance: true,
      tip: [
        excused ? 'Не был на уроке, уважительная причина (посещаемость)' : 'Не был на уроке (посещаемость)',
        comment || null,
      ].filter(Boolean).join('\n'),
    };
  }

  if (stored) {
    const { value, absent } = decodeValue(stored);
    const grade = absent ? null : gradeOfValue(col, value);
    let text = '';
    if (absent) text = ABSENT;
    else if (columnScale(col) === 'pass') text = value >= 1 ? 'зач' : 'н/з';
    else if (mode === 'grade' && grade != null) text = String(grade);
    else if (columnScale(col) === 'percent') text = `${formatNumber(value)}%`;
    else text = formatNumber(value);

    const tone = grade != null ? GRADE_TONE[grade] : null;
    let textTone = null;
    if (absent) textTone = 'muted';
    else if (columnScale(col) === 'pass') textTone = value >= 1 ? 'teal' : 'rose';

    const tip = [
      col.online ? `Исправлено вручную. Из попыток: ${status?.tip || '—'}` : null,
      comment || null,
    ].filter(Boolean).join('\n');
    return {
      kind: col.online ? 'override' : 'manual',
      stored, absent, value, grade, text, tone, textTone, status, comment, tip,
    };
  }

  if (col.online && status) {
    const submitted = ['passed', 'late', 'failed'].includes(status.kind);
    const grade = submitted && status.pct != null
      ? gradeFromPercent(status.pct, col.thresholds) : null;
    let text = '';
    let textTone = null;
    if (submitted) {
      if (mode === 'grade' && grade != null) text = String(grade);
      else if (status.pct != null) text = `${status.pct}%`;
      else text = status.kind === 'failed' ? 'н/з' : 'сдал';
    } else if (status.kind === 'in_progress') {
      text = 'пишет';
      textTone = 'blue';
    } else if (status.kind === 'overdue') {
      text = 'долг';
      textTone = 'rose';
    }
    return {
      kind: status.kind === 'none' ? 'empty' : 'online',
      stored: '', absent: false, value: status.pct, grade,
      text, tone: grade != null ? GRADE_TONE[grade] : null, textTone,
      status, comment,
      tip: [status.tip, comment || null].filter(Boolean).join('\n'),
      late: status.kind === 'late',
      failed: status.kind === 'failed',
    };
  }

  return {
    kind: 'empty', stored: '', absent: false, value: null, grade: null,
    text: '', tone: null, textTone: null, status, comment, tip: comment,
  };
}

/**
 * Сводка строки: взвешенный средний балл и долги («н» + не сдал онлайн в срок).
 * Скрытые колонки не считаются, даже когда их показывают: иначе средний
 * менялся бы от галочки «показать скрытые».
 */
export function summarizeRow(columns, cells) {
  let sum = 0;
  let wsum = 0;
  let absences = 0;
  let overdue = 0;
  columns.forEach((col, i) => {
    const cell = cells[i];
    if (!cell || col.hidden) return;
    if (cell.absent) absences += 1;
    if (cell.kind === 'online' && cell.status?.kind === 'overdue') overdue += 1;
    const w = columnWeight(col);
    if (cell.grade != null && w > 0) {
      sum += w * cell.grade;
      wsum += w;
    }
  });
  return { avg: wsum ? sum / wsum : null, absences, overdue, debts: absences + overdue };
}

/** Сводка колонки: сколько клеток заполнено и средняя оценка класса. */
export function summarizeColumn(cells) {
  let filled = 0;
  let sum = 0;
  let n = 0;
  for (const cell of cells) {
    if (cell.kind === 'manual' || cell.kind === 'override' || cell.kind === 'absent') filled += 1;
    else if (cell.kind === 'online' && !['in_progress', 'overdue'].includes(cell.status?.kind)) filled += 1;
    if (cell.grade != null) { sum += cell.grade; n += 1; }
  }
  return { filled, total: cells.length, avg: n ? sum / n : null };
}

/**
 * Вся сетка: строки учеников с клетками и сводкой + сводки колонок.
 * students — [{ id, … }], columns — видимые колонки, marksIndex — `indexMarks`,
 * onlineCells — `collectOnline(...).cells`, attendance — `indexAttendance`
 * (посещаемость уроков, к которым привязаны колонки). Выбывшие (`former`)
 * видны строкой, но в сводки класса («внесено N из M», средний по классу) не
 * входят.
 */
export function buildGrid(students, columns, marksIndex, onlineCells, {
  mode = 'raw', now = new Date(), attendance = new Map(),
} = {}) {
  const rows = students.map((student) => {
    const cells = columns.map((col) => resolveCell(
      col,
      col.id ? marksIndex.get(markKey(col.id, student.id)) : undefined,
      col.online ? onlineCells.get(`${student.id}|${col.key}`) : undefined,
      {
        mode,
        now,
        former: !!student.former,
        attendance: col.lessonId ? attendance.get(`${col.lessonId}|${student.id}`) : undefined,
      },
    ));
    return { student, cells, summary: summarizeRow(columns, cells) };
  });
  const current = rows.filter((r) => !r.student.former);
  const colStats = columns.map((_, c) => summarizeColumn(current.map((r) => r.cells[c])));
  return { rows, colStats };
}

/** Ученики журнала: состав класса + выбывшие, у кого в журнале остались отметки. */
export function journalStudents(roster = [], former = []) {
  const seen = new Set(roster.map((s) => s.id));
  const extra = former
    .filter((s) => s && !seen.has(s.id))
    .map((s) => ({ ...s, former: true }))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
  return [...roster, ...extra];
}

// ─── Вставка из таблицы ─────────────────────────────────────────────────────

/** Текст буфера (Google Таблицы, Excel) → строки × ячейки. */
export function parseClipboard(text) {
  const t = String(text ?? '').replace(/\r\n?/g, '\n');
  if (!t.includes('\t') && !t.includes('\n')) return [[t.trim()]];
  const lines = t.replace(/\n$/, '').split('\n');
  return lines.map((line) => line.split('\t').map((c) => c.trim()));
}

/**
 * Куда ляжет вставленный блок: от выбранной клетки вправо и вниз.
 * → { cells: [{ r, c, raw }], clipped } — clipped: сколько значений не влезло.
 */
export function planPaste(grid, { row, col, rowCount, colCount }) {
  const cells = [];
  let clipped = 0;
  grid.forEach((line, dr) => {
    line.forEach((raw, dc) => {
      const r = row + dr;
      const c = col + dc;
      if (r >= rowCount || c >= colCount) {
        if (raw !== '') clipped += 1;
        return;
      }
      cells.push({ r, c, raw });
    });
  });
  return { cells, clipped };
}

// ─── Выгрузка ───────────────────────────────────────────────────────────────

/** Таблица для выгрузки: шапка + ученики; клетки — как на экране. */
export function journalTable(grid, columns) {
  const head = ['Ученик', ...columns.map((c) => `${c.title}${c.day ? ` (${shortDay(c.day)})` : ''}`), 'Средний'];
  const body = grid.rows.map((row) => [
    row.student.name || '',
    ...row.cells.map((cell) => cell.text || ''),
    formatAvg(row.summary.avg),
  ]);
  return [head, ...body];
}

export function toTsv(table) {
  return table.map((r) => r.map((v) => String(v).replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
}

/** CSV для Excel с русской локалью: разделитель «;», BOM добавляет вызывающий. */
export function toCsv(table, sep = ';') {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[";\n\r]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return table.map((r) => r.map(esc).join(sep)).join('\r\n');
}
