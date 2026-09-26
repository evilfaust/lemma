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
//   «4+», «4-», «4=» — оценка с плюсом/минусом (v3.9.241): в средний идёт
//                  цифрой, плюсы и минусы — суждение учителя, журнал их не
//                  переводит в доли
//   «w»         — вейтинг: пропустил по болезни, ждём пересдачи (долг, в
//                  средний не входит)
//   «—»         — не писал по уважительной причине (забрали на олимпиаду):
//                  не долг и не в среднем
// Интенсив (v3.9.241) — блок колонок `journal_blocks`: у колонки есть `block`
// и роль `role` (work — работа дня, day — оценка за день, final — зачётная
// работа, total — итог). Подсказки «за день» и «итог» считает
// `intensiveSummary`; ставит оценки всё равно учитель.
// Числовое поле PocketBase не отличает «пусто» от нуля, а 0 баллов — законная
// отметка, поэтому текст.

import { parseAcademicYear } from './academicYear';

export const ABSENT = 'н';
export const WAIT = 'w';
export const SKIP = '—';

/** Роли колонок интенсива. Пусто у колонки в интенсиве = работа. */
export const ROLES = ['work', 'day', 'final', 'total'];
export const ROLE_LABELS = {
  work: 'Работа дня',
  day: 'Оценка за день',
  final: 'Зачётная работа',
  total: 'Итог интенсива',
};
/** Доля зачётной работы в расчёте итога по умолчанию, %: дни делят остаток. */
export const DEFAULT_FINAL_SHARE = 40;

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
// ц — «w» в русской раскладке
const WAIT_ALIASES = new Set(['w', 'ц', 'wait', 'waiting', 'вейт', 'вейтинг']);
// Одиночный дефис в шкале «зачёт» — незачёт, поэтому там «не писал» — только словом.
const SKIP_ALIASES = new Set(['—', '–', '-', '−', 'осв', 'не писал', 'нп']);
const SKIP_WORDS = new Set(['осв', 'не писал', 'нп']);
// «4+», «4 -», «4−», «4=» → цифра и модификатор.
const MOD_GRADE = /^([1-5])\s*([+\-−–=])$/;
const MOD_CANON = { '+': '+', '-': '-', '−': '-', '–': '-', '=': '=' };
const MOD_SHOW = { '+': '+', '-': '−', '=': '=' };
const PASS_YES = new Set(['+', 'з', 'зач', 'зачет', 'зачёт', 'да', '1', '✓', 'v']);
const PASS_NO = new Set(['-', '−', '–', '—', 'нз', 'н/з', 'незач', 'незачет', 'незачёт', 'нет', '0', '✗', 'x', 'х']);

/**
 * Хранимый текст → { value: число|null, absent, wait?, skip?, mod? }.
 * У оценки с плюсом/минусом value — сама цифра, mod — «+», «-» или «=».
 */
export function decodeValue(stored) {
  const s = String(stored ?? '').trim();
  if (!s) return { value: null, absent: false };
  if (s === ABSENT) return { value: null, absent: true };
  if (s === WAIT) return { value: null, absent: false, wait: true };
  if (s === SKIP) return { value: null, absent: false, skip: true };
  const g = s.match(/^([1-5])([+\-=])$/);
  if (g) return { value: Number(g[1]), absent: false, mod: g[2] };
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
  if (WAIT_ALIASES.has(s)) return { ok: true, stored: WAIT };

  const scale = columnScale(col);
  if (scale === 'pass' ? SKIP_WORDS.has(s) : SKIP_ALIASES.has(s)) return { ok: true, stored: SKIP };
  const tail = ' или «н» — не был, «w» — вейтинг';

  if (scale === 'pass') {
    if (PASS_YES.has(s)) return { ok: true, stored: '1' };
    if (PASS_NO.has(s)) return { ok: true, stored: '0' };
    return { ok: false, error: `Зачёт — «+» или «з», незачёт — «−» или «нз»${tail}` };
  }

  if (scale === 'grade') {
    const n = parseNumber(s);
    if (n != null && Number.isInteger(n) && n >= 1 && n <= 5) return { ok: true, stored: String(n) };
    const g = s.match(MOD_GRADE);
    if (g) return { ok: true, stored: `${g[1]}${MOD_CANON[g[2]]}` };
    return { ok: false, error: `Оценка — от 1 до 5, можно с «+», «−», «=»${tail}` };
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
  const { value, absent, wait, skip, mod } = decodeValue(stored);
  if (absent) return ABSENT;
  if (wait) return WAIT;
  if (skip) return SKIP;
  if (mod) return `${value}${mod}`;
  if (value == null) return '';
  if (columnScale(col) === 'pass') return value >= 1 ? 'з' : 'нз';
  return formatNumber(value);
}

export function formatNumber(n) {
  if (n == null || !Number.isFinite(n)) return '';
  return canon(n).replace('.', ',');
}

/** Оценка для экрана: «4», «4+», «4−», «4=». */
export function formatGrade(value, mod) {
  if (value == null) return '';
  return `${value}${mod ? MOD_SHOW[mod] || '' : ''}`;
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
 * blocks — интенсивы класса (`journal_blocks`): их колонки идут подряд, от
 * первого дня интенсива, зачёт и итог — в конце (`compareColumns`).
 */
export function mergeColumns(stored = [], online = new Map(), { sessionDeadlines = new Map(), blocks = [] } = {}) {
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
      // Материал без своей связи: { type: 'sheet', id, generator, title } —
      // лист генератора, из которого завели колонку (v3.9.240).
      ref: rec.ref && typeof rec.ref === 'object' ? rec.ref : null,
      // Интенсив (v3.9.241): колонка без роли внутри интенсива — работа дня.
      blockId: rec.block || '',
      role: rec.block ? (ROLES.includes(rec.role) ? rec.role : 'work') : '',
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
      ref: null,
      blockId: '',
      role: '',
      deadline: info.deadline,
      classDeadline: info.classDeadline,
      assigned: false,
      created: '',
      record: null,
    });
  }

  const blocksById = new Map(blocks.map((b) => [b.id, b]));
  for (const col of out) {
    if (col.blockId && !blocksById.has(col.blockId)) { col.blockId = ''; col.role = ''; }
  }
  return out.sort((a, b) => compareColumns(a, b, blocksById));
}

const ROLE_ORDER = { work: 0, day: 1, final: 2, total: 3 };
const TAIL_ROLES = new Set(['final', 'total']);

function compareDays(a, b) {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? -1 : 1;
}

/**
 * Порядок колонок: по дате, но интенсив — одним куском с его первого дня:
 * внутри — по дням (работы, потом оценка за день), зачёт и итог в конце.
 */
export function compareColumns(a, b, blocksById = new Map()) {
  const anchor = (c) => (c.blockId ? dayOf(blocksById.get(c.blockId)?.date_from) || c.day : c.day);
  const byAnchor = compareDays(anchor(a), anchor(b));
  if (byAnchor) return byAnchor;
  if (a.blockId !== b.blockId) {
    // Обычные колонки дня — перед интенсивом, два интенсива с одного дня не смешиваем.
    if (!a.blockId) return -1;
    if (!b.blockId) return 1;
    return a.blockId < b.blockId ? -1 : 1;
  }
  if (a.blockId) {
    const tail = Number(TAIL_ROLES.has(a.role)) - Number(TAIL_ROLES.has(b.role));
    if (tail) return tail;
    if (!TAIL_ROLES.has(a.role)) {
      const byDay = compareDays(a.day, b.day);
      if (byDay) return byDay;
    }
    const byRole = ROLE_ORDER[a.role] - ROLE_ORDER[b.role];
    if (byRole) return byRole;
  } else {
    const byDay = compareDays(a.day, b.day);
    if (byDay) return byDay;
  }
  if (a.created !== b.created) {
    if (!a.created) return 1;
    if (!b.created) return -1;
    return a.created < b.created ? -1 : 1;
  }
  return String(a.title).localeCompare(String(b.title), 'ru');
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

/** «18.09», «18–22.09», «29.09–02.10» — даты интенсива. */
export function rangeLabel(from, to) {
  const a = dayOf(from);
  const b = dayOf(to);
  if (!a) return shortDay(b);
  if (!b || a === b) return shortDay(a);
  if (a.slice(0, 7) === b.slice(0, 7)) return `${a.slice(8, 10)}–${shortDay(b)}`;
  return `${shortDay(a)}–${shortDay(b)}`;
}

/**
 * Верхняя строка шапки: подряд идущие колонки одного месяца → месяц, колонки
 * одного интенсива → его название.
 * → [{ key, label, span, blockId? }]
 */
export function headerSpans(columns = [], blocksById = new Map()) {
  const spans = [];
  for (const c of columns) {
    const block = c.blockId ? blocksById.get(c.blockId) : null;
    const k = block ? `b:${block.id}` : `m:${monthKey(c.day) || 'none'}`;
    const last = spans[spans.length - 1];
    if (last && last.key === k) { last.span += 1; continue; }
    if (block) {
      const dates = rangeLabel(block.date_from, block.date_to);
      spans.push({ key: k, span: 1, blockId: block.id, label: `Интенсив · ${block.title}${dates ? ` · ${dates}` : ''}` });
    } else {
      const m = monthKey(c.day);
      spans.push({ key: k, span: 1, label: m ? monthLabel(m) : 'Без даты' });
    }
  }
  return spans;
}

/** Колонка начинает новый день интенсива (или его хвост: зачёт, итог) — граница в сетке. */
export function startsBlockSection(columns, index) {
  const col = columns[index];
  const prev = columns[index - 1];
  if (!col?.blockId || !prev || prev.blockId !== col.blockId) return false;
  const section = (c) => (TAIL_ROLES.has(c.role) ? 'tail' : c.day);
  return section(col) !== section(prev);
}

/**
 * Дни интенсива для окна создания: уроки класса в этих датах (сдвоенные,
 * интенсив «пары 1–4»), а без уроков — все дни, кроме воскресенья.
 * → [{ day, lesson|null }]
 */
export function intensiveDays(from, to, lessons = []) {
  const a = dayOf(from);
  const b = dayOf(to);
  if (!a || !b || a > b) return [];
  const byDay = new Map();
  for (const l of lessons) {
    const d = lessonDay(l);
    if (!d || d < a || d > b || l.status === 'cancelled') continue;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(l);
  }
  // Один урок в день — его и привязываем (посещаемость → «н»); несколько —
  // угадывать не будем.
  const pick = (d) => (byDay.get(d)?.length === 1 ? byDay.get(d)[0] : null);
  if (byDay.size) {
    return [...byDay.keys()].sort().map((day) => ({ day, lesson: pick(day) }));
  }
  const out = [];
  const cur = new Date(`${a}T12:00:00Z`);
  const end = new Date(`${b}T12:00:00Z`);
  for (let i = 0; cur <= end && i < 60; i += 1) {
    if (cur.getUTCDay() !== 0) out.push({ day: cur.toISOString().slice(0, 10), lesson: null });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Доля зачёта интенсива, % (0–90); пусто — по умолчанию. */
export function finalShareOf(block) {
  const v = Number(block?.final_share);
  if (block?.final_share === '' || block?.final_share == null || !Number.isFinite(v)) return DEFAULT_FINAL_SHARE;
  return Math.min(90, Math.max(0, v));
}

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/**
 * Картина ученика по интенсиву — подсказки для «за день» и «итога».
 * entries — [{ col, cell }] колонок интенсива (включая свёрнутые работы).
 * День: оценка учителя за день; нет её — средняя по работам дня. Итог:
 * средняя по дням с долей (100 − share) % + зачёт с долей share %; без
 * зачёта — средняя по дням. «w» не входит в расчёт и помечает его: ждём
 * пересдачи.
 * → { days: [{ day, value, source: 'teacher'|'works'|null, works: [grade],
 *      wait, dayCol }], final: { grade, wait, skip } | null, value, pending,
 *      waits, share }
 */
export function intensiveSummary(block, entries = []) {
  const share = finalShareOf(block) / 100;
  const byDay = new Map();
  let final = null;
  let waits = 0;
  for (const { col, cell } of entries) {
    if (!cell) continue;
    if (cell.wait) waits += 1;
    if (col.role === 'total') continue;
    if (col.role === 'final') {
      if (!final || (final.grade == null && !final.wait)) {
        final = { grade: cell.grade, wait: !!cell.wait, skip: !!cell.skip, title: col.title };
      }
      continue;
    }
    const d = col.day || '';
    if (!byDay.has(d)) byDay.set(d, { day: d || null, works: [], teacher: null, wait: false, dayCol: null });
    const bucket = byDay.get(d);
    if (col.role === 'day') {
      bucket.dayCol = col;
      if (cell.wait) bucket.wait = true;
      else if (cell.grade != null) bucket.teacher = cell.grade;
    } else if (cell.grade != null) {
      bucket.works.push(cell.grade);
    }
  }
  const days = [...byDay.values()]
    .sort((x, y) => compareDays(x.day, y.day))
    .map((b) => {
      const worksAvg = mean(b.works);
      let value = null;
      let source = null;
      if (b.teacher != null) { value = b.teacher; source = 'teacher'; }
      else if (!b.wait && worksAvg != null) { value = worksAvg; source = 'works'; }
      return { day: b.day, value, source, works: b.works, worksAvg, wait: b.wait, dayCol: b.dayCol };
    });
  const daysAvg = mean(days.filter((d) => d.value != null).map((d) => d.value));
  let value = daysAvg;
  if (final && final.grade != null) {
    value = daysAvg == null ? final.grade : daysAvg * (1 - share) + final.grade * share;
  }
  const pending = !!final?.wait || days.some((d) => d.wait);
  return { days, final, value, daysAvg, pending, waits, share: Math.round(share * 100) };
}

function intensiveTip(summary, block) {
  const lines = [`Расчёт по интенсиву «${block?.title || ''}» — подсказка, итог ставит учитель.`];
  for (const d of summary.days) {
    const when = d.day ? shortDay(d.day) : 'без даты';
    if (d.wait) lines.push(`${when}: w — ждём пересдачи`);
    else if (d.source === 'teacher') lines.push(`${when}: ${formatNumber(d.value)} — оценка за день`);
    else if (d.source === 'works') lines.push(`${when}: ≈${formatAvg(d.value)} по работам (${d.works.join(', ')})`);
    else lines.push(`${when}: нет оценок`);
  }
  if (summary.final) {
    const f = summary.final;
    lines.push(`Зачёт: ${f.wait ? 'w — ждём пересдачи' : f.skip ? 'не писал' : f.grade != null ? f.grade : 'нет оценки'}`);
  }
  if (summary.final?.grade != null && summary.daysAvg != null) {
    lines.push(`Дни ${100 - summary.share} % + зачёт ${summary.share} % = ${formatAvg(summary.value)}`);
  }
  return lines.join('\n');
}

/** «Устный счёт 3» → «Устный счёт 4»; без номера — то же название. */
export function suggestNextTitle(title) {
  const t = String(title || '').trim();
  const m = t.match(/^(.*?)(\d+)(\D*)$/);
  if (!m) return t;
  return `${m[1]}${Number(m[2]) + 1}${m[3]}`;
}

// ─── Колонка по листу генератора (v3.9.240) ─────────────────────────────────

/**
 * Настройки новой колонки по сохранённому листу генератора («В журнал» у листа
 * устного счёта): баллы, максимум = заданий в варианте (каждый ученик пишет
 * свой вариант целиком), категория — «Устный счёт» у листов устного счёта
 * (ключи `oral_*` реестра листов), иначе «Самостоятельная». Ссылка на лист
 * едет в `ref`. Реестр листов сюда не импортируется намеренно: он тянет код
 * всех генераторов.
 */
export function sheetColumnPreset(sheet) {
  if (!sheet?.id) return null;
  const generator = String(sheet.generator || '');
  const max = Number(sheet.questions_count) || 0;
  const title = String(sheet.title || '').trim() || 'Лист генератора';
  return {
    title,
    scale: 'points',
    ...(max > 0 ? { max_score: max } : {}),
    category: generator.startsWith('oral_') ? 'Устный счёт' : 'Самостоятельная',
    ref: { type: 'sheet', id: sheet.id, generator, title },
  };
}

/** Колонка журнала, уже заведённая по этому листу (чтобы не плодить вторую). */
export function findSheetColumn(columns = [], sheetId) {
  if (!sheetId) return null;
  return columns.find((c) => c?.ref?.type === 'sheet' && c.ref.id === sheetId) || null;
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
    const { value, absent, wait, skip, mod } = decodeValue(stored);
    if (wait || skip) {
      return {
        kind: col.online ? 'override' : 'manual',
        stored, absent: false, wait: !!wait, skip: !!skip, value: null, grade: null,
        text: wait ? WAIT : SKIP, tone: null, textTone: wait ? 'wait' : 'muted', status, comment,
        tip: [
          wait ? 'Вейтинг: пропустил, ждём пересдачи' : 'Не писал по уважительной причине — не учитывается',
          comment || null,
        ].filter(Boolean).join('\n'),
      };
    }
    const grade = absent ? null : gradeOfValue(col, value);
    let text = '';
    if (absent) text = ABSENT;
    else if (mod) text = formatGrade(value, mod);
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
      stored, absent, value, grade, mod: mod || '', text, tone, textTone, status, comment, tip,
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
 * Сводка строки: взвешенный средний балл и долги («н», «w» и не сдал онлайн в
 * срок). Скрытые колонки не считаются, даже когда их показывают: иначе средний
 * менялся бы от галочки «показать скрытые». Интенсив входит в средний только
 * итогом — его работы и дни уже в нём учтены.
 */
export function summarizeRow(columns, cells) {
  let sum = 0;
  let wsum = 0;
  let absences = 0;
  let overdue = 0;
  let waits = 0;
  columns.forEach((col, i) => {
    const cell = cells[i];
    if (!cell || col.hidden) return;
    if (cell.absent) absences += 1;
    if (cell.wait) waits += 1;
    if (cell.kind === 'online' && cell.status?.kind === 'overdue') overdue += 1;
    const w = col.blockId && col.role !== 'total' ? 0 : columnWeight(col);
    if (cell.grade != null && w > 0) {
      sum += w * cell.grade;
      wsum += w;
    }
  });
  return { avg: wsum ? sum / wsum : null, absences, overdue, waits, debts: absences + overdue + waits };
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
  mode = 'raw', now = new Date(), attendance = new Map(), blocks = [], blockColumns = null,
} = {}) {
  const cellOf = (col, student) => resolveCell(
    col,
    col.id ? marksIndex.get(markKey(col.id, student.id)) : undefined,
    col.online ? onlineCells.get(`${student.id}|${col.key}`) : undefined,
    {
      mode,
      now,
      former: !!student.former,
      attendance: col.lessonId ? attendance.get(`${col.lessonId}|${student.id}`) : undefined,
    },
  );
  // Подсказки интенсива считаются по ВСЕМ его колонкам, в том числе свёрнутым
  // работам, которых в сетке сейчас нет.
  const blocksById = new Map(blocks.map((b) => [b.id, b]));
  const inBlocks = (blockColumns || columns).filter((c) => c.blockId && !c.hidden && blocksById.has(c.blockId));
  const rows = students.map((student) => {
    const cells = columns.map((col) => cellOf(col, student));
    if (inBlocks.length) applyIntensiveHints(columns, cells, inBlocks, blocksById, (col) => {
      const i = columns.indexOf(col);
      return i >= 0 ? cells[i] : cellOf(col, student);
    });
    return { student, cells, summary: summarizeRow(columns, cells) };
  });
  const current = rows.filter((r) => !r.student.former);
  const colStats = columns.map((_, c) => summarizeColumn(current.map((r) => r.cells[c])));
  return { rows, colStats };
}

// Пустые клетки «за день» и «итог» получают подсказку «≈4,2» (kind 'hint'):
// не отметка — не считается заполненной и в средний не идёт.
function applyIntensiveHints(columns, cells, inBlocks, blocksById, cellFor) {
  const groups = new Map();
  for (const col of inBlocks) {
    if (!groups.has(col.blockId)) groups.set(col.blockId, []);
    groups.get(col.blockId).push({ col, cell: cellFor(col) });
  }
  for (const [blockId, entries] of groups) {
    const block = blocksById.get(blockId);
    const summary = intensiveSummary(block, entries);
    columns.forEach((col, i) => {
      if (col.blockId !== blockId || cells[i].kind !== 'empty') return;
      if (col.role === 'day') {
        const d = summary.days.find((x) => x.dayCol?.key === col.key);
        if (d?.worksAvg == null) return;
        cells[i] = {
          ...cells[i], kind: 'hint', text: `≈${formatAvg(d.worksAvg)}`, textTone: 'hint',
          tip: `Средняя по работам дня: ${d.works.join(', ')} — подсказка, оценку за день ставит учитель`,
        };
      } else if (col.role === 'total') {
        if (summary.final?.wait) {
          cells[i] = {
            ...cells[i], kind: 'hint', text: `${WAIT}?`, textTone: 'hint',
            tip: `${intensiveTip(summary, block)}\nЗачёт — вейтинг: итог после пересдачи`,
          };
        } else if (summary.value != null) {
          cells[i] = {
            ...cells[i], kind: 'hint', text: `≈${formatAvg(summary.value)}`, textTone: 'hint',
            tip: intensiveTip(summary, block), pending: summary.pending,
          };
        }
      }
    });
  }
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
    // Подсказки интенсива («≈4,2») — не отметки, в выгрузку не идут.
    ...row.cells.map((cell) => (cell.kind === 'hint' ? '' : cell.text || '')),
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
