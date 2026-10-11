/**
 * Чистая логика хука calendar_feed.pb.js (v3.9.352): календарь учителя в
 * формате iCalendar (RFC 5545) — подписка из iPhone / Mac / Google / Яндекса.
 *
 * CommonJS — так его подключает JSVM PocketBase (`require` внутри обработчика).
 * Файл без суффикса .pb.js, поэтому PB сам его не исполняет. Тесты —
 * ege-tasks/src/__tests__/calendarFeed.test.js (через createRequire).
 *
 * 🚨 Таблица пар продублирована из ege-tasks/src/components/workspace/lessonTime.js
 * (хук не может импортировать модули фронта). Тест сверяет обе копии — новую
 * пару или сдвиг звонков править в ДВУХ местах.
 *
 * Время. PB хранит даты в UTC, а учитель вводит их по своим часам (Москва):
 * пара «1» лежит как 07:15Z = 10:15 МСК. Поэтому «время на часах» считаем в
 * фиксированном поясе (TZ_OFFSET_MIN), а в ленту пишем снова UTC с «Z» —
 * календарь телефона сам покажет его в поясе владельца. Летнего времени в
 * России нет с 2014 года, сдвиг постоянный.
 */

const TZ_OFFSET_MIN = 180; // Europe/Moscow
const TZ_NAME = 'Europe/Moscow';
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

const PAIRS = [
  { key: '0', label: 'Нулевая', full: ['09:00', '10:00'], halves: null },
  { key: '1', label: '1-я пара', full: ['10:15', '11:45'], halves: [['10:15', '11:00'], ['11:05', '11:45']] },
  { key: '2', label: '2-я пара', full: ['12:00', '13:45'], halves: [['12:00', '12:45'], ['12:50', '13:45']] },
  { key: '3', label: '3-я пара', full: ['14:05', '15:40'], halves: [['14:05', '14:50'], ['14:55', '15:40']] },
  { key: '4', label: '4-я пара', full: ['16:00', '17:35'], halves: [['16:00', '16:45'], ['16:50', '17:35']] },
  { key: '5', label: '5-я пара', full: ['17:45', '19:20'], halves: [['17:45', '18:30'], ['18:35', '19:20']] },
  { key: '6', label: 'Вечерняя 1', full: ['18:00', '19:30'], halves: [['18:00', '18:45'], ['18:45', '19:30']] },
  { key: '7', label: 'Вечерняя 2', full: ['19:40', '21:10'], halves: [['19:40', '20:25'], ['20:25', '21:10']] },
];

// Диапазон ['чч:мм','чч:мм'] по коду time_slot: "0"|"N"|"Na"/"Nb"|"N-M".
function slotRange(code) {
  if (!code) return null;
  const inten = /^(\d)-(\d)$/.exec(code);
  if (inten) {
    const a = PAIRS.find((p) => p.key === inten[1]);
    const b = PAIRS.find((p) => p.key === inten[2]);
    return a && b ? [a.full[0], b.full[1]] : null;
  }
  const half = /^(\d)([ab])$/.exec(code);
  if (half) {
    const p = PAIRS.find((x) => x.key === half[1]);
    return p && p.halves ? (half[2] === 'a' ? p.halves[0] : p.halves[1]) : null;
  }
  const p = PAIRS.find((x) => x.key === code);
  return p ? p.full : null;
}

function slotLabel(code) {
  if (!code) return '';
  const inten = /^(\d)-(\d)$/.exec(code);
  if (inten) return 'интенсив, пары ' + inten[1] + '–' + inten[2];
  const half = /^(\d)([ab])$/.exec(code);
  const p = PAIRS.find((x) => x.key === (half ? half[1] : code));
  if (!p) return '';
  return half ? p.label + ', ' + (half[2] === 'a' ? '1-я' : '2-я') + ' половина' : p.label;
}

// Конец по старту, если слота нет: старт целой пары или 2-й полупары → её конец.
function endByStart(hm) {
  for (const p of PAIRS) {
    if (p.full[0] === hm) return p.full[1];
    if (p.halves && p.halves[1][0] === hm) return p.halves[1][1];
  }
  return '';
}

// ── Время ───────────────────────────────────────────────────────────────────

// Строка PB ("2026-10-12 07:15:00.000Z") или ISO → миллисекунды UTC; NaN, если пусто.
function parsePb(v) {
  if (!v) return NaN;
  return Date.parse(String(v).trim().replace(' ', 'T'));
}

const pad = (n) => (n < 10 ? '0' : '') + n;

// Миллисекунды UTC → «часы владельца» { y, mo, d, h, mi } (через сдвиг пояса).
function wall(ms) {
  const d = new Date(ms + TZ_OFFSET_MIN * MIN);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes() };
}

// Полночь дня владельца, в котором лежит ms, + «чч:мм» → миллисекунды UTC.
function atWall(ms, hm) {
  const w = wall(ms);
  const parts = hm.split(':');
  return Date.UTC(w.y, w.mo - 1, w.d, Number(parts[0]), Number(parts[1])) - TZ_OFFSET_MIN * MIN;
}

function utcStamp(ms) {
  const d = new Date(ms);
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate())
    + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
}

// Дата владельца (VALUE=DATE); shiftDays — для исключающего DTEND.
function wallDate(ms, shiftDays) {
  const w = wall(ms);
  const d = new Date(Date.UTC(w.y, w.mo - 1, w.d) + (shiftDays || 0) * DAY);
  return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
}

// Урок → { start, end } в мс UTC. Логика та же, что lessonStartEnd на фронте:
// урок, созданный кликом по ячейке (полночь + слот), берёт старт из пары.
function lessonTimes(l) {
  let start = parsePb(l.date_plan);
  if (isNaN(start)) return null;
  const range = slotRange(l.time_slot);
  const w = wall(start);
  if (range && !w.h && !w.mi) start = atWall(start, range[0]);
  let end;
  if (range) {
    end = atWall(start, range[1]);
  } else {
    const sw = wall(start);
    const e = endByStart(pad(sw.h) + ':' + pad(sw.mi));
    end = e ? atWall(start, e) : start + 45 * MIN;
  }
  if (end <= start) end = start + 45 * MIN;
  return { start: start, end: end };
}

// ── Текст iCalendar ─────────────────────────────────────────────────────────

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

function utf8Len(ch) {
  const c = ch.codePointAt(0);
  if (c < 0x80) return 1;
  if (c < 0x800) return 2;
  if (c < 0x10000) return 3;
  return 4;
}

// RFC 5545 §3.1: строка не длиннее 75 октетов, продолжение — с пробела.
// Режем по символам (не по байтам), чтобы не разорвать кириллицу посередине.
function fold(line) {
  const out = [];
  let cur = '';
  let len = 0;
  for (const ch of Array.from(line)) {
    const n = utf8Len(ch);
    const limit = out.length ? 74 : 75; // у продолжения 1 октет занят пробелом
    if (len + n > limit) {
      out.push(cur);
      cur = '';
      len = 0;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function vevent(props) {
  const lines = ['BEGIN:VEVENT'];
  for (const p of props) if (p) lines.push(fold(p));
  lines.push('END:VEVENT');
  return lines;
}

const DOMAIN = 'lemma.oipav.ru';
const KIND_LABELS = {
  meeting: 'Педсовет',
  holiday: 'Каникулы',
  olympiad: 'Олимпиада',
  exam: 'Экзамен / пробник',
  parents: 'Родительское собрание',
  other: '',
};

/**
 * Собрать ленту.
 *   teacher: { id, name }
 *   lessons: [{ id, title, date_plan, time_slot, status, owner, updated,
 *               groupName, ownerName }]
 *   events:  [{ id, title, kind, date_start, date_end, all_day, note_md, updated }]
 *   todos:   [{ id, title, due_date, groupName, updated }] — только открытые
 *   nowMs, appUrl — для DTSTAMP и ссылки «открыть в Lemma».
 */
function buildIcs(opts) {
  const o = opts || {};
  const teacher = o.teacher || {};
  const now = o.nowMs || Date.now();
  const stamp = utcStamp(now);
  const appUrl = o.appUrl || 'https://l.oipav.ru';
  const modified = (r) => {
    const t = parsePb(r.updated);
    return isNaN(t) ? '' : 'LAST-MODIFIED:' + utcStamp(t);
  };

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lemma//Calendar feed//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    fold('X-WR-CALNAME:' + esc('Lemma' + (teacher.name ? ' — ' + teacher.name : ''))),
    'X-WR-TIMEZONE:' + TZ_NAME,
    // Подсказка, как часто перечитывать (Apple и Outlook её учитывают, Google — нет).
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ];

  for (const l of o.lessons || []) {
    const t = lessonTimes(l);
    if (!t) continue;
    const cancelled = l.status === 'cancelled';
    const head = l.groupName ? l.groupName + ' · ' : '';
    const title = (cancelled ? 'Отменён: ' : '') + head + (l.title || 'Урок');
    const desc = [];
    const slot = slotLabel(l.time_slot);
    if (slot) desc.push(slot);
    if (l.status === 'done') desc.push('Проведён');
    if (l.owner && teacher.id && l.owner !== teacher.id && l.ownerName) desc.push('Ведёт: ' + l.ownerName);
    desc.push(appUrl + '/app/calendar');
    lines.push.apply(lines, vevent([
      'UID:lesson-' + l.id + '@' + DOMAIN,
      'DTSTAMP:' + stamp,
      'DTSTART:' + utcStamp(t.start),
      'DTEND:' + utcStamp(t.end),
      'SUMMARY:' + esc(title),
      'DESCRIPTION:' + esc(desc.join('\n')),
      'STATUS:' + (cancelled ? 'CANCELLED' : 'CONFIRMED'),
      'CATEGORIES:' + esc('Уроки'),
      modified(l),
    ]));
  }

  for (const e of o.events || []) {
    const start = parsePb(e.date_start);
    if (isNaN(start)) continue;
    const endRaw = parsePb(e.date_end);
    const allDay = e.all_day !== false;
    const kind = KIND_LABELS[e.kind] || '';
    const desc = [kind, e.note_md || ''].filter(Boolean).join('\n');
    let when;
    if (allDay) {
      // DTEND у событий на весь день — ИСКЛЮЧАЮЩИЙ: день после последнего.
      const last = isNaN(endRaw) || endRaw < start ? start : endRaw;
      when = ['DTSTART;VALUE=DATE:' + wallDate(start), 'DTEND;VALUE=DATE:' + wallDate(last, 1)];
    } else {
      const end = isNaN(endRaw) || endRaw <= start ? start + 60 * MIN : endRaw;
      when = ['DTSTART:' + utcStamp(start), 'DTEND:' + utcStamp(end)];
    }
    lines.push.apply(lines, vevent([
      'UID:school-' + e.id + '@' + DOMAIN,
      'DTSTAMP:' + stamp,
      when[0],
      when[1],
      'SUMMARY:' + esc(e.title || 'Мероприятие'),
      desc ? 'DESCRIPTION:' + esc(desc) : '',
      allDay ? 'TRANSP:TRANSPARENT' : '',
      'CATEGORIES:' + esc('Школа'),
      modified(e),
    ]));
  }

  for (const t of o.todos || []) {
    const due = parsePb(t.due_date);
    if (isNaN(due)) continue;
    lines.push.apply(lines, vevent([
      'UID:todo-' + t.id + '@' + DOMAIN,
      'DTSTAMP:' + stamp,
      'DTSTART;VALUE=DATE:' + wallDate(due),
      'DTEND;VALUE=DATE:' + wallDate(due, 1),
      'SUMMARY:' + esc('☐ ' + (t.title || 'Дело') + (t.groupName ? ' (' + t.groupName + ')' : '')),
      'DESCRIPTION:' + esc(appUrl + '/app/todos'),
      'TRANSP:TRANSPARENT',
      'CATEGORIES:' + esc('Дела'),
      modified(t),
    ]));
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// Токен ленты: 40 символов [a-z0-9]. Короче — не принимаем вовсе: пустой
// токен у учителя без ссылки не должен совпасть с пустым запросом.
const TOKEN_RE = /^[a-z0-9]{32,64}$/;
function tokenFromPath(raw) {
  const t = String(raw || '').toLowerCase().replace(/\.ics$/, '');
  return TOKEN_RE.test(t) ? t : '';
}

// Окно ленты: прошлое — чтобы видеть недавние уроки, будущее — учебный год.
const WINDOW_PAST_DAYS = 60;
const WINDOW_FUTURE_DAYS = 365;

module.exports = {
  PAIRS,
  TZ_OFFSET_MIN,
  WINDOW_PAST_DAYS,
  WINDOW_FUTURE_DAYS,
  slotRange,
  slotLabel,
  lessonTimes,
  esc,
  fold,
  buildIcs,
  tokenFromPath,
};
