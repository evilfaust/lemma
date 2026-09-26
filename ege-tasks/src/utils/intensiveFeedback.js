// Обратная связь ученику по итогам интенсива (v3.9.243) — чистая логика:
// данные для LLM, обращение, пол, образцы стиля. Без сети и React, под тестами
// `__tests__/intensiveFeedback.test.js`. Промпт — `pocketbase/feedback-prompt.mjs`.
//
// 🚨 В LLM не уходят ни фамилия, ни имя: модель пишет {ИМЯ}, обращение
// («Ксюша») подставляем здесь (`fillName`). В данных — пол, оценки, проценты,
// названия работ и их описания из заметки колонки.

import { columnScale } from './classJournal';

export const NAME_TOKEN = '{ИМЯ}';

// Имя → как к ученику обращаются на кафедре. Нет в словаре — само имя.
const DIMINUTIVES = {
  Александр: 'Саша', Александра: 'Саша', Алексей: 'Лёша', Анастасия: 'Настя', Анатолий: 'Толя',
  Андрей: 'Андрей', Анна: 'Аня', Валерия: 'Лера', Варвара: 'Варя', Виктория: 'Вика',
  Владимир: 'Вова', Владислав: 'Влад', Всеволод: 'Сева', Вячеслав: 'Слава', Григорий: 'Гриша',
  Даниил: 'Даня', Данила: 'Даня', Дарья: 'Даша', Дмитрий: 'Дима', Евгений: 'Женя', Евгения: 'Женя',
  Екатерина: 'Катя', Елена: 'Лена', Елизавета: 'Лиза', Ирина: 'Ира', Иван: 'Ваня',
  Константин: 'Костя', Ксения: 'Ксюша', Леонид: 'Лёня', Людмила: 'Люда', Маргарита: 'Рита',
  Мария: 'Маша', Михаил: 'Миша', Надежда: 'Надя', Наталья: 'Наташа', Николай: 'Коля',
  Ольга: 'Оля', Павел: 'Паша', Роман: 'Рома', Светлана: 'Света', Сергей: 'Серёжа',
  София: 'Соня', Софья: 'Соня', Станислав: 'Стас', Степан: 'Стёпа', Татьяна: 'Таня',
  Фёдор: 'Федя', Федор: 'Федя', Юлия: 'Юля', Юрий: 'Юра', Ярослав: 'Слава',
};

// Мужские имена и уменьшительные на -а/-я.
const MALE_A = new Set([
  'Илья', 'Никита', 'Кузьма', 'Фома', 'Савва', 'Лука', 'Данила', 'Саша', 'Лёша', 'Толя', 'Сева',
  'Слава', 'Гриша', 'Даня', 'Дима', 'Женя', 'Ваня', 'Костя', 'Лёня', 'Миша', 'Коля', 'Паша', 'Рома',
  'Серёжа', 'Стёпа', 'Федя', 'Юра', 'Вова', 'Митя', 'Петя', 'Лёва', 'Гоша', 'Тима', 'Боря',
]);

/** Имя из «Фамилия Имя [Отчество]»; одно слово — оно и есть имя. */
export function firstNameOf(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
  return parts.length > 1 ? parts[1] : parts[0] || '';
}

/** Обращение: поле ученика `short_name`, иначе словарь, иначе имя. */
export function addressOf(student) {
  const own = String(student?.short_name || '').trim();
  if (own) return own;
  const first = firstNameOf(student?.name);
  return DIMINUTIVES[first] || first;
}

/**
 * Пол для рода глаголов («работал/работала»): по фамилии, если она явно
 * склоняется, иначе по имени. Учитель поправит в окне, если ошиблись.
 * → 'f' | 'm'
 */
export function genderOf(student) {
  const parts = String(student?.name || '').trim().split(/\s+/);
  const surname = parts.length > 1 ? parts[0] : '';
  if (/(ова|ева|ёва|ина|ына|ская|цкая|ая)$/i.test(surname)) return 'f';
  if (/(ов|ев|ёв|ин|ын|ский|цкий|ой|ый|ий)$/i.test(surname)) return 'm';
  const first = String(student?.short_name || '').trim() || firstNameOf(student?.name);
  if (MALE_A.has(first)) return 'm';
  return /[ая]$/i.test(first) ? 'f' : 'm';
}

/** Подставить обращение вместо токена. */
export function fillName(text, address) {
  return String(text || '').split(NAME_TOKEN).join(address || '');
}

export const RATINGS = ['', 'I', 'II', 'III'];
const RATING_WORDS = { I: 'Первый', II: 'Второй', III: 'Третий' };

// Образцы стиля кафедры (обратная связь по интенсиву «Производная», имена
// заменены токеном). Учитель правит их в окне «Обратная связь» — сохраняются
// в `teachers.feedback_examples`.
export const DEFAULT_EXAMPLES = [
  'зачёт 4+ / итог 4: {ИМЯ}, результаты интенсива, к сожалению, не соответствуют уровню твоих возможностей. В материале разбираешься хорошо, но торопишься, небрежно записываешь решения и в результате допускаешь много ошибок.',
  'зачёт н / итог w: {ИМЯ}, хорошо работал в начале интенсива, потом, к сожалению, заболел и пропустил часть тем и зачётную работу. Разбирайся, готовься и сдавай зачёт.',
  'зачёт 4+ / итог 4: {ИМЯ}, в течение интенсива ты работал очень неровно, явно провалил последний день. Но сумел собраться к зачёту и показал достойный результат. Для высоких результатов тебе не хватает стабильности.',
  'зачёт 4+ / итог 5−: {ИМЯ}, молодец, отличная работа в течение интенсива и достаточно успешная — на зачётной работе. Обрати внимание на задания на геометрический смысл производной.',
  'зачёт 4 / итог 4+: {ИМЯ}, отмечаем стабильно хорошую работу в течение интенсива и во время зачёта. Молодец.',
  'зачёт 3 / итог 3+: {ИМЯ}, тебе очень непросто было на этом интенсиве в сильной группе, но мы отмечаем твои старательность и трудолюбие. Тебе надо дополнительно разобраться с заданиями на геометрический смысл производной и на технику дифференцирования.',
  'зачёт 5 / итог 5, рейтинг I: {ИМЯ}, отмечаем отличную работу и на протяжении всего интенсива, и во время зачётной работы. Молодец. Первый рейтинг.',
  'зачёт 3 / итог 4−: {ИМЯ}, ты хорошо работал в течение интенсива, особенно отмечаем твою работу в последний день. К сожалению, на зачёте ты показал результат явно ниже своего уровня. Тебе надо доразобраться с техникой дифференцирования и заданиями на геометрический смысл производной.',
  'зачёт 5 / итог 5, рейтинг II: {ИМЯ}, отмечаем твоё трудолюбие и как результат — прогресс. Великолепно разобрался в новом материале и на зачёте показал стопроцентный результат практически по всем жанрам. Молодец. Второй рейтинг.',
  'зачёт 5 / итог 4+: {ИМЯ}, лучший результат в классе на зачётной работе. Молодец. К сожалению, общее впечатление от интенсива испортил твой результат в последний день. Обрати внимание.',
  'зачёт 4− / итог 4−: {ИМЯ}, отмечаем, что начало было для тебя непростым, но ты смогла разобраться в материале и показать на зачёте хороший результат.',
  'зачёт 2 / итог —: {ИМЯ}, тебе было очень сложно в сильной группе в течение всего интенсива. С зачётной работой по итогам ты не справился. Готовься и пересдавай.',
].join('\n');

// Служебные заметки, которые описанием работы не являются (перенос с
// бумажного листа 26.09.2026 и т.п.).
const SERVICE_NOTE = /^(с бумажного листа|подпись на листе|максимум на листе|перенесено)/i;
const HOMEWORK = /(^|[^а-яё])(д\/?з|дз|домашн)/i;

function describe(col) {
  const note = String(col?.note || '').trim();
  return note && !SERVICE_NOTE.test(note) ? note : undefined;
}

/** Процент выполнения клетки (баллы/проценты) или null. */
function pctOf(col, cell) {
  if (!cell || cell.value == null) return null;
  const scale = columnScale(col);
  if (scale === 'percent') return cell.value;
  if (scale === 'points') {
    const max = Number(col.max_score) || 0;
    return max > 0 ? (cell.value * 100) / max : null;
  }
  return null;
}

function resultText(col, cell) {
  if (!cell) return 'нет отметки';
  if (cell.wait) return 'вейтинг: пропустил(а), ждём пересдачи';
  if (cell.skip) return 'не писал(а) по уважительной причине';
  if (cell.absent) return 'не был(а) на уроке';
  const pct = pctOf(col, cell);
  if (pct != null) return `${Math.round(pct)}%`;
  if (cell.text && cell.kind !== 'hint') return cell.text;
  return 'нет отметки';
}

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

// Дни интенсива словами: модели не нужны даты — на кафедре пишут «в первый
// день», «в последний день».
const ORDINAL = ['первый', 'второй', 'третий', 'четвёртый', 'пятый', 'шестой', 'седьмой'];
const ORDINAL_GEN = ['первого', 'второго', 'третьего', 'четвёртого', 'пятого', 'шестого', 'седьмого'];
function dayName(i, n) {
  if (n > 1 && i === n - 1) return 'последний';
  return ORDINAL[i] || `${i + 1}-й`;
}
function dayNameGen(i, n) {
  if (n > 1 && i === n - 1) return 'последнего';
  return ORDINAL_GEN[i] || `${i + 1}-го`;
}

/** Итог требует пересдачи: вейтинг или неудовлетворительно. */
export function needsRetake(totalStored) {
  const s = String(totalStored || '').trim();
  return s === 'w' || /^[12]/.test(s);
}
const pct = (x) => `${Math.round(x)}%`;

/**
 * Данные одного ученика для LLM — без имени.
 * columns — все колонки интенсива (с ролями), rows — строки сетки по этим
 * колонкам для всего класса (`buildGrid`), studentId — чей черновик.
 * options: { gender: 'm'|'f', rating: ''|'I'|'II'|'III', title }
 */
export function buildFeedbackData(columns, rows, studentId, { gender = 'm', rating = '', title = '' } = {}) {
  const row = rows.find((r) => r.student.id === studentId);
  if (!row) return null;
  const current = rows.filter((r) => !r.student.former);
  const f = gender === 'f';

  const groupAvg = (c) => mean(current.map((r) => pctOf(columns[c], r.cells[c])).filter((x) => x != null));

  const days = new Map();
  let finalInfo = null;
  let total = null;
  let totalStored = '';
  const strengths = [];
  const weaknesses = [];
  const works = [];

  columns.forEach((col, c) => {
    const cell = row.cells[c];
    if (col.role === 'total') {
      if (cell?.stored) { total = cell.text; totalStored = cell.stored; }
      return;
    }
    if (col.role === 'final') {
      const my = pctOf(col, cell);
      const avg = groupAvg(c);
      const scores = current.map((r) => pctOf(col, r.cells[c])).filter((x) => x != null).sort((a, b) => b - a);
      const place = my != null ? scores.findIndex((x) => x <= my + 1e-9) + 1 : null;
      finalInfo = {
        что_проверял: describe(col),
        результат: resultText(col, cell),
        ...(avg != null ? { среднее_по_группе: pct(avg) } : {}),
        ...(place ? { место_в_группе: `${place} из ${scores.length}` } : {}),
        _pct: my,
        _avg: avg,
        _place: place,
      };
      return;
    }
    const d = col.day || '';
    if (!days.has(d)) days.set(d, { _day: d, оценка_за_день: undefined, работы: [], _absent: 0, _marked: 0 });
    const bucket = days.get(d);
    if (col.role === 'day') {
      if (cell?.stored) bucket.оценка_за_день = cell.text;
      if (cell?.absent) bucket._absent += 1;
      else if (cell?.stored) bucket._marked += 1;
      bucket._grade = cell?.grade ?? null;
      return;
    }
    const my = pctOf(col, cell);
    const avg = groupAvg(c);
    bucket.работы.push({
      что_проверяла: describe(col) || 'не описано',
      результат: resultText(col, cell),
      ...(avg != null ? { среднее_по_группе: pct(avg) } : {}),
    });
    if (cell?.absent) bucket._absent += 1;
    else if (cell?.stored || cell?.kind === 'online') bucket._marked += 1;
    works.push({ col, cell, my, avg, day: d });
  });

  const dayList = [...days.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, b]) => b);
  const nDays = dayList.length;
  const dayIndex = new Map(dayList.map((b, i) => [b._day, i]));
  dayList.forEach((b, i) => {
    b.день = dayName(i, nDays);
    // Не был: есть «н» и нет ни одной отметки (пустое д/з пропуск не отменяет).
    b.не_был_на_уроке = b._absent > 0 && b._marked === 0;
  });

  // ── Сильные стороны: с них модель обязана начать ──
  // Обозначения работ («Ф-ч», «Экв.») — сокращения учителя: модель их
  // расшифровывает наугад, поэтому в текст для неё идёт только описание из
  // заметки колонки, иначе — «работа второго дня».
  const label = (w) => {
    const i = dayIndex.get(w.day) ?? 0;
    const desc = describe(w.col);
    return desc ? `«${desc}» (${dayName(i, nDays)} день)` : `одна из работ ${dayNameGen(i, nDays)} дня`;
  };
  if (finalInfo?._place === 1 && finalInfo._pct != null) strengths.push('лучший результат в группе на зачётной работе');
  else if (finalInfo?._pct != null && finalInfo._pct >= 85) strengths.push('зачётная работа написана очень сильно');
  else if (finalInfo?._pct != null && finalInfo._avg != null && finalInfo._pct >= finalInfo._avg + 10) {
    strengths.push('зачёт написан выше среднего по группе');
  }
  const perfect = works.filter((w) => w.my != null && w.my >= 99.5);
  if (perfect.length) strengths.push(`без ошибок: ${perfect.slice(0, 4).map(label).join(', ')}`);
  const above = works.filter((w) => w.my != null && w.my < 99.5 && w.avg != null && w.my >= w.avg + 15);
  if (above.length) strengths.push(`заметно выше среднего по группе: ${above.slice(0, 3).map(label).join(', ')}`);
  const hw = works.filter((w) => HOMEWORK.test(w.col.title) && w.my != null);
  if (hw.length && hw.every((w) => w.my >= 85)) strengths.push('домашние задания выполнены хорошо');
  else {
    const goodHw = hw.filter((w) => w.my >= 85);
    if (goodHw.length) {
      strengths.push(`хорошо выполненное домашнее задание (${goodHw.map((w) => `${dayName(dayIndex.get(w.day) ?? 0, nDays)} день`).join(', ')})`);
    }
  }
  const graded = dayList.filter((b) => b._grade != null);
  if (graded.length) {
    const best = graded.reduce((a, b) => (b._grade > a._grade ? b : a));
    if (best._grade >= 4) strengths.push(`лучший день интенсива — ${best.день}`);
    if (graded.length >= 2 && graded[graded.length - 1]._grade > graded[0]._grade) {
      strengths.push('прогресс к концу интенсива');
    }
  }
  const missedDays = dayList.filter((b) => b.не_был_на_уроке).length;
  if (missedDays && finalInfo && finalInfo._pct != null) {
    strengths.push(`написал${f ? 'а' : ''} зачётную работу, хотя пропустил${f ? 'а' : ''} часть занятий`);
  }
  if (!strengths.length) {
    const best = works.filter((w) => w.my != null).sort((a, b) => b.my - a.my)[0];
    if (best) strengths.push(`лучше всего получилась ${label(best)}`);
    else if (hw.length) strengths.push('сдавал(а) домашние задания');
  }

  // ── Что доработать ──
  const weak = works.filter((w) => w.my != null && (w.my <= 50 || (w.avg != null && w.my <= w.avg - 20)));
  if (weak.length) weaknesses.push(`слабо: ${weak.slice(0, 4).map(label).join(', ')}`);
  if (finalInfo?._pct != null && finalInfo._pct < 50) weaknesses.push('зачётная работа не удалась');
  else if (finalInfo?._pct != null && finalInfo._avg != null && finalInfo._pct <= finalInfo._avg - 15) {
    weaknesses.push('зачёт написан ниже среднего по группе');
  }
  if (graded.length >= 2 && graded[graded.length - 1]._grade < graded[0]._grade) {
    weaknesses.push('к концу интенсива результаты снизились');
  }
  const noHw = works.filter((w) => HOMEWORK.test(w.col.title) && !w.cell?.stored && !w.cell?.absent);
  if (noHw.length) {
    weaknesses.push(`нет отметки за домашнюю работу (${noHw.map((w) => `${dayName(dayIndex.get(w.day) ?? 0, nDays)} день`).join(', ')})`);
  }
  if (missedDays) weaknesses.push(`пропущено дней интенсива: ${missedDays}`);

  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([k, v]) => !k.startsWith('_') && v !== undefined));
  return {
    пол: f ? 'ученица' : 'ученик',
    ...(title ? { тема_интенсива: title } : {}),
    дни: dayList.map((b) => clean({ ...b, работы: b.работы.map(clean) })),
    ...(finalInfo ? { зачёт: clean(finalInfo) } : {}),
    итог: total || 'не выставлен',
    пересдача: needsRetake(totalStored) ? 'да' : 'нет',
    рейтинг: rating && RATING_WORDS[rating] ? `${RATING_WORDS[rating]} рейтинг` : 'нет',
    сильные_стороны: strengths,
    слабые_места: weaknesses,
  };
}

/** Колонки интенсива по порядку и есть ли у него итог (куда сохранять). */
export function blockColumnsOf(columns, blockId) {
  return columns.filter((c) => c.blockId === blockId && !c.hidden);
}
