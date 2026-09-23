// «Графики и диаграммы» — база №3 (определение величины по графику или
// диаграмме) и №7 (соответствие «интервал ↔ характер изменения»). Это задачи
// «из жизни»: температура за трое суток, разогрев двигателя, крутящий момент,
// среднемесячная температура и осадки. Производной здесь нет — её задания
// живут в соседнем генераторе `derivativeGraphTasks.js`.
//
// Как и там, чертёж и ответ идут из ОДНИХ данных: сцена — это набор чисел,
// из него строится модель чертежа (`utils/chartSvg.js`) и считается ответ.
// Вопросы задаются только о том, что читается по клеткам точно: значения
// стоят на линиях сетки, «достигла X °C» спрашивается в узле, где кривая
// проходит X ровно один раз.
//
// Данные вымышленные, поэтому город в условии — «город N»: реальный город с
// выдуманной температурой выдавал бы себя за справку.
//
// Задание:
//   question    — условие (формулы в $…$),
//   chart       — модель чертежа для chartSvg (JSON, сохраняется с листом),
//   matching    — соответствие: { points, leftTitle, valuesTitle, values, plain },
//   note        — строка под списками,
//   resultLatex — ответ для ключа, answerValue — он же числом.

import { randInt, chance } from './linearExpr';
import { shuffleArray } from './shuffle';
import { generateByCategories } from './questionPlan';

const pick = (list) => list[randInt(0, list.length - 1)];

// Ответ как в бланке: минус и десятичная запятая (в KaTeX — в скобках).
const texNum = (v) => String(Math.round(v * 1000) / 1000).replace('.', '{,}');
const answer = (v) => ({ resultLatex: texNum(v), answerValue: Math.round(v * 1000) / 1000 });

const MONTHS_NOM = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_PREP = ['январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** 1 минуту, 2 минуты, 5 минут */
function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
const minutes = (n) => `${n} ${plural(n, 'минуту', 'минуты', 'минут')}`;

const MATCH_NOTE = 'Запишите в ответ цифры, расположив их в порядке, соответствующем буквам: А Б В Г.';

// Окно оси y: от ближайшей подписанной линии ниже минимума до такой же выше
// максимума, ноль — всегда в окне у величин со знаком.
function yWindow(lo, hi, labelEvery, { withZero = true } = {}) {
  let min = Math.floor(lo / labelEvery) * labelEvery;
  let max = Math.ceil(hi / labelEvery) * labelEvery;
  if (min === lo) min -= labelEvery;
  if (max === hi) max += labelEvery;
  if (withZero) { min = Math.min(min, 0); max = Math.max(max, 0); }
  return { min, max };
}

// ───────────────────────── температура за трое суток ─────────────────────────

// Сезон задаёт уровень и размах суточного хода. Зимой — минусы: ответ со
// знаком и ось с нулём посередине — это отдельный навык чтения графика.
const SEASONS = [
  { months: [11, 0, 1], base: [-14, -4], amp: [2, 4] },
  { months: [2, 3, 9, 10], base: [-2, 8], amp: [3, 5] },
  { months: [4, 5, 6, 7, 8], base: [12, 20], amp: [4, 7] },
];
// Суточный ход: ночью ниже, минимум к утру, максимум днём.
const DAY_SHAPE = [-0.5, -1, 1, 0.3]; // 0, 6, 12, 18 ч

function temp3Scene() {
  const season = pick(SEASONS);
  const month = pick(season.months);
  const day0 = randInt(1, 26);
  const amp = randInt(...season.amp);
  let base = randInt(...season.base);
  const vals = [];
  for (let d = 0; d < 3; d += 1) {
    if (d) base += randInt(-3, 3);
    DAY_SHAPE.forEach((k) => vals.push(Math.round(base + amp * k + randInt(-1, 1))));
  }
  vals.push(Math.round(base + amp * DAY_SHAPE[0] + randInt(-1, 1)));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const y = yWindow(lo, hi, 2, { withZero: false });
  if (y.max - y.min > 18) return null;

  const days = [0, 1, 2].map((d) => `${day0 + d} ${MONTHS_GEN[month]}`);
  const chart = {
    type: 'line',
    x: {
      min: 0,
      max: 72,
      grid: 6,
      ticks: Array.from({ length: 13 }, (_, i) => ({ v: i * 6, label: String((i * 6) % 24) })),
      groups: days.map((label, d) => ({ from: d * 24, to: d * 24 + 24, label })),
      unit: 'ч',
    },
    y: {
      min: y.min, max: y.max, grid: 1, labelEvery: 2, unit: '°C',
    },
    series: [{ points: vals.map((v, i) => [i * 6, v]), dots: true }],
  };
  return { vals, days, chart };
}

const TEMP3_INTRO = 'На рисунке показано изменение температуры воздуха на протяжении трёх суток. По горизонтали указывается дата и время суток (в часах), по вертикали — значение температуры в градусах Цельсия.';

function askTemp3(cat) {
  const s = temp3Scene();
  if (!s) return null;
  const d = randInt(0, 2);
  const day = s.vals.slice(d * 4, d * 4 + 4);
  const next = s.vals[d * 4 + 4];
  const max = Math.max(...day);
  const min = Math.min(...day);
  // Полночь следующих суток — на границе: вне размаха дня она спорна
  // (одни отнесут её к этим суткам, другие — нет), поэтому держим её внутри.
  if (next > max || next < min) return null;
  const date = s.days[d];

  if (cat === 'temp_day_max') {
    return {
      chart: s.chart,
      question: `${TEMP3_INTRO} Определите по рисунку наибольшую температуру воздуха ${date}. Ответ дайте в градусах Цельсия.`,
      ...answer(max),
    };
  }
  if (cat === 'temp_day_min') {
    return {
      chart: s.chart,
      question: `${TEMP3_INTRO} Определите по рисунку наименьшую температуру воздуха ${date}. Ответ дайте в градусах Цельсия.`,
      ...answer(min),
    };
  }
  if (cat === 'temp_day_range') {
    if (max === min) return null;
    return {
      chart: s.chart,
      question: `${TEMP3_INTRO} Определите по рисунку разность между наибольшей и наименьшей температурой воздуха ${date}. Ответ дайте в градусах Цельсия.`,
      ...answer(max - min),
    };
  }
  // temp_at_time
  const k = randInt(0, 3);
  return {
    chart: s.chart,
    question: `${TEMP3_INTRO} Определите по рисунку температуру воздуха ${date} в ${String(k * 6).padStart(2, '0')}:00. Ответ дайте в градусах Цельсия.`,
    ...answer(day[k]),
  };
}

// ─────────────────────── среднемесячные значения (столбики) ───────────────────────

/**
 * Год среднемесячных значений: температура (со знаком, минимум зимой) или
 * осадки (неотрицательные, больше летом). Значения кратны шагу сетки —
 * вершина столбика стоит ровно на линии.
 */
function monthlyScene(kind = chance(0.6) ? 'temp' : 'rain') {
  const year = randInt(1995, 2023);
  let vals;
  let y;
  if (kind === 'temp') {
    const avg = randInt(0, 8);
    const amp = randInt(9, 15);
    const shift = randInt(0, 1);
    vals = MONTHS_NOM.map((_, m) => 2 * Math.round(
      (avg - amp * Math.cos((2 * Math.PI * (m - shift)) / 12) + randInt(-2, 2)) / 2,
    ));
    // Ноль — пустое место вместо столбика: читается как «нет данных».
    // Весной (температура растёт) сдвигаем вверх, осенью — вниз.
    vals = vals.map((v, m) => (v !== 0 ? v : (m >= 1 && m <= 6 ? 2 : -2)));
    y = { ...yWindow(Math.min(...vals), Math.max(...vals), 4), grid: 2, labelEvery: 4, unit: '°C' };
  } else {
    const base = randInt(35, 55);
    const amp = randInt(15, 35);
    vals = MONTHS_NOM.map((_, m) => Math.max(10, 10 * Math.round(
      (base - amp * Math.cos((2 * Math.PI * m) / 12) + randInt(-15, 15)) / 10,
    )));
    const top = yWindow(0, Math.max(...vals), 20);
    y = {
      min: 0, max: top.max, grid: 10, labelEvery: 20, unit: 'мм',
    };
  }
  const chart = {
    type: 'bar',
    x: {
      min: 0.4, max: 12.6, ticks: MONTHS_SHORT.map((label, i) => ({ v: i + 1, label })),
    },
    y,
    bars: vals.map((v, i) => ({ x: i + 1, v })),
    barWidth: 0.55,
  };
  return {
    kind, year, vals, chart,
  };
}

const monthlyIntro = (s) => (s.kind === 'temp'
  ? `На диаграмме показана среднемесячная температура воздуха в городе N за каждый месяц ${s.year} года. По горизонтали указываются месяцы, по вертикали — температура в градусах Цельсия.`
  : `На диаграмме показано количество осадков, выпавших в городе N за каждый месяц ${s.year} года. По горизонтали указываются месяцы, по вертикали — количество осадков в миллиметрах.`);

const UNIT_TAIL = { temp: 'Ответ дайте в градусах Цельсия.', rain: 'Ответ дайте в миллиметрах.' };

function askBar(cat) {
  const s = monthlyScene();
  const { vals, kind, year } = s;
  const intro = monthlyIntro(s);
  const T = kind === 'temp';
  const what = (adj) => (T ? `${adj} среднемесячную температуру` : `${adj} месячное количество осадков`);
  const task = (text, v) => ({ chart: s.chart, question: `${intro} ${text}`, ...answer(v) });

  if (cat === 'bar_max') {
    return task(`Определите по диаграмме ${what(T ? 'наибольшую' : 'наибольшее')} в ${year} году. ${UNIT_TAIL[kind]}`, Math.max(...vals));
  }
  if (cat === 'bar_min') {
    return task(`Определите по диаграмме ${what(T ? 'наименьшую' : 'наименьшее')} в ${year} году. ${UNIT_TAIL[kind]}`, Math.min(...vals));
  }
  if (cat === 'bar_half') {
    const second = chance(0.5);
    const part = second ? vals.slice(6) : vals.slice(0, 6);
    const isMax = chance(0.5);
    const adj = isMax ? (T ? 'наибольшую' : 'наибольшее') : (T ? 'наименьшую' : 'наименьшее');
    const half = second ? 'во второй половине' : 'в первой половине';
    // Экстремум полугодия не должен совпасть с годовым: иначе вопрос
    // решается без «полугодия», и половина типа теряет смысл.
    const v = isMax ? Math.max(...part) : Math.min(...part);
    const yearV = isMax ? Math.max(...vals) : Math.min(...vals);
    if (v === yearV) return null;
    return task(`Определите по диаграмме ${what(adj)} ${half} ${year} года. ${UNIT_TAIL[kind]}`, v);
  }
  if (cat === 'bar_range') {
    return task(`Определите по диаграмме разность между ${T ? 'наибольшей и наименьшей среднемесячными температурами' : 'наибольшим и наименьшим месячным количеством осадков'} в ${year} году. ${UNIT_TAIL[kind]}`, Math.max(...vals) - Math.min(...vals));
  }
  if (cat === 'bar_diff') {
    const [a, b] = shuffleArray([...Array(12).keys()]).slice(0, 2);
    if (vals[a] === vals[b]) return null;
    const [lo, hi] = vals[a] < vals[b] ? [a, b] : [b, a];
    const text = T
      ? `Определите по диаграмме, на сколько градусов Цельсия ${MONTHS_NOM[lo]} был в среднем холоднее, чем ${MONTHS_NOM[hi]}.`
      : `Определите по диаграмме, на сколько миллиметров больше осадков выпало в ${MONTHS_PREP[hi]}, чем в ${MONTHS_PREP[lo]}.`;
    return task(text, vals[hi] - vals[lo]);
  }
  // bar_count
  if (T) {
    const hasZero = vals.includes(0);
    const opts = [];
    if (!hasZero && vals.some((v) => v < 0)) {
      opts.push({ text: 'положительной', count: vals.filter((v) => v > 0).length });
      opts.push({ text: 'отрицательной', count: vals.filter((v) => v < 0).length });
    }
    [5, 10, 15, 20].filter((X) => !vals.includes(X)).forEach((X) => {
      opts.push({ text: `выше ${X}\u00A0°C`, count: vals.filter((v) => v > X).length });
    });
    const ok = opts.filter((o) => o.count >= 2 && o.count <= 10);
    if (!ok.length) return null;
    const o = pick(ok);
    return task(`Определите по диаграмме, сколько было месяцев, когда среднемесячная температура была ${o.text}.`, o.count);
  }
  const X = pick([30, 40, 50, 60, 70]);
  const more = chance(0.5);
  const count = vals.filter((v) => (more ? v > X : v < X)).length;
  if (count < 2 || count > 10) return null;
  return task(`Определите по диаграмме, сколько было месяцев, когда выпадало ${more ? 'более' : 'менее'} ${X} миллиметров осадков.`, count);
}

// ───────────────────────────── разогрев двигателя ─────────────────────────────

// Шаги по минутам: сначала греется быстро, потом медленнее — как настоящий
// график «Решу». Всё кратно 10: температура в каждой минуте стоит на линии.
function heatScene() {
  // Двигатель греется d минут, потом выходит на полку. Подъём (в десятках
  // градусов) раскладываем на d шагов по убыванию: сначала быстро, потом всё
  // медленнее — шаги не растут, поэтому лесенки «полка — подъём» не бывает.
  const T0 = pick([10, 20, 30]);
  const Tf = pick([70, 80, 90, 100]);
  const d = randInt(6, 9);
  const units = (Tf - T0) / 10;
  if (units < d) return null;
  const steps = new Array(d).fill(1);
  for (let k = d; k < units; k += 1) steps[randInt(0, d - 1)] += 1;
  steps.sort((a, b) => b - a);
  const vals = [T0];
  for (let t = 1; t <= 10; t += 1) vals.push(vals[t - 1] + (t <= d ? steps[t - 1] * 10 : 0));
  const chart = {
    type: 'line',
    x: {
      min: 0, max: 10, grid: 1, ticks: vals.map((_, t) => ({ v: t, label: String(t) })), unit: 'мин',
    },
    y: {
      min: 0, max: 100, grid: 10, labelEvery: 10, unit: '°C',
    },
    series: [{ points: vals.map((v, t) => [t, v]), smooth: true }],
  };
  // Значение читается однозначно, только если кривая проходит его в одной
  // точке: на «полке» (тот же градус две минуты подряд) ответов было бы много.
  const once = vals
    .map((v, t) => ({ t, v }))
    .filter(({ v }) => vals.filter((w) => w === v).length === 1);
  return { vals, chart, once };
}

const HEAT_INTRO = 'На графике показан процесс разогрева двигателя легкового автомобиля. На оси абсцисс откладывается время в минутах, прошедшее от запуска двигателя, на оси ординат — температура двигателя в градусах Цельсия.';

function askHeat(cat) {
  const s = heatScene();
  if (!s) return null;
  if (cat === 'heat_value') {
    const t = randInt(2, 9);
    return {
      chart: s.chart,
      question: `${HEAT_INTRO} Определите по графику, до какой температуры нагрелся двигатель за первые ${minutes(t)} после запуска. Ответ дайте в градусах Цельсия.`,
      ...answer(s.vals[t]),
    };
  }
  if (cat === 'heat_reach') {
    const c = s.once.filter(({ t }) => t >= 2);
    if (!c.length) return null;
    const p = pick(c);
    return {
      chart: s.chart,
      question: `${HEAT_INTRO} Определите по графику, через сколько минут после запуска температура двигателя достигла ${p.v}\u00A0°C.`,
      ...answer(p.t),
    };
  }
  // heat_time: от A до B
  const pairs = [];
  s.once.forEach((a) => s.once.forEach((b) => {
    if (b.t > a.t && b.v - a.v >= 20 && b.t - a.t >= 2) pairs.push([a, b]);
  }));
  if (!pairs.length) return null;
  const [a, b] = pick(pairs);
  return {
    chart: s.chart,
    question: `${HEAT_INTRO} Определите по графику, сколько минут двигатель нагревался от температуры ${a.v}\u00A0°C до температуры ${b.v}\u00A0°C.`,
    ...answer(b.t - a.t),
  };
}

// ──────────────────────────── крутящий момент ────────────────────────────

// Узлы через 500 об/мин: подъём до «полки», полка, спад. Момент кратен 20.
function torqueScene() {
  const xs = [];
  for (let n = 1000; n <= 6500; n += 500) xs.push(n);
  const peak = pick([120, 140, 160]);
  let v = pick([20, 40]);
  const vals = [];
  let phase = 'up';
  let hold = randInt(1, 3);
  let upStep = pick([20, 40, 40]);
  let downStep = 20;
  for (let i = 0; i < xs.length; i += 1) {
    vals.push(v);
    // Подъём круто и с замедлением к полке, спад — наоборот, с ускорением:
    // так выглядит настоящая кривая момента (и без изломов у сплайна).
    if (phase === 'up') {
      v = Math.min(peak, v + upStep);
      if (chance(0.35)) upStep = 20;
      if (v === peak) phase = 'top';
    } else if (phase === 'top') {
      hold -= 1;
      if (hold <= 0) phase = 'down';
    } else {
      v -= downStep;
      if (chance(0.35)) downStep = 40;
    }
  }
  if (phase === 'up' || Math.min(...vals.slice(vals.indexOf(peak))) < 20) return null;
  const chart = {
    type: 'line',
    x: {
      min: 0,
      max: 7000,
      grid: 500,
      ticks: [1000, 2000, 3000, 4000, 5000, 6000, 7000].map((n) => ({ v: n, label: String(n) })),
      unit: 'об/мин',
    },
    y: {
      min: 0, max: peak + 20, grid: 20, labelEvery: 20, unit: 'Н·м',
    },
    series: [{ points: vals.map((m, i) => [xs[i], m]), smooth: true }],
  };
  // «Наименьшие обороты, при которых момент не меньше X» — первый узел
  // подъёма со значением X: левее кривая строго ниже X.
  const up = [];
  for (let i = 1; i < vals.length && vals[i - 1] < peak; i += 1) {
    if (vals[i] > vals[i - 1]) up.push({ n: xs[i], m: vals[i] });
  }
  return { chart, up };
}

const TORQUE_INTRO = 'На графике изображена зависимость крутящего момента автомобильного двигателя от числа его оборотов в минуту. На оси абсцисс откладывается число оборотов в минуту, на оси ординат — крутящий момент в Н·м.';

function askTorque(cat) {
  const s = torqueScene();
  if (!s || !s.up.length) return null;
  const p = pick(s.up);
  if (cat === 'torque_speed') {
    return {
      chart: s.chart,
      question: `${TORQUE_INTRO} Скорость автомобиля (в км/ч) приближённо выражается формулой $v = 0{,}036n$, где $n$ — число оборотов двигателя в минуту. С какой наименьшей скоростью должен двигаться автомобиль, чтобы крутящий момент был не меньше ${p.m}\u00A0Н·м? Ответ дайте в километрах в час.`,
      ...answer(0.036 * p.n),
    };
  }
  return {
    chart: s.chart,
    question: `${TORQUE_INTRO} Чтобы автомобиль начал движение, крутящий момент должен быть не менее ${p.m}\u00A0Н·м. Какое наименьшее число оборотов двигателя в минуту достаточно, чтобы автомобиль начал движение?`,
    ...answer(p.n),
  };
}

// ──────────────────────────── химическая реакция ────────────────────────────

// Масса реагента убывает всё медленнее; значения чётные — на линиях сетки.
function reactionScene() {
  const m0 = pick([20, 22, 24, 26, 28, 30]);
  let dec = pick([6, 8]);
  const vals = [m0];
  for (let t = 1; t <= 7; t += 1) {
    vals.push(vals[t - 1] - dec);
    dec = Math.max(0, dec - pick([0, 2, 2]));
  }
  if (vals[7] < 2) return null;
  const chart = {
    type: 'line',
    x: {
      min: 0, max: 7, grid: 1, ticks: vals.map((_, t) => ({ v: t, label: String(t) })), unit: 'мин',
    },
    y: {
      min: 0, max: Math.ceil((m0 + 1) / 4) * 4, grid: 2, labelEvery: 4, unit: 'г',
    },
    series: [{ points: vals.map((v, t) => [t, v]), smooth: true }],
  };
  return { vals, chart };
}

function askReaction() {
  const s = reactionScene();
  if (!s) return null;
  const t = randInt(1, 6);
  const used = s.vals[0] - s.vals[t];
  if (used <= 0) return null;
  return {
    chart: s.chart,
    question: `В ходе химической реакции количество исходного вещества (реагента), которое ещё не вступило в реакцию, со временем постепенно уменьшается. На рисунке эта зависимость представлена графиком. На оси абсцисс откладывается время в минутах, прошедшее с момента начала реакции, на оси ординат — масса оставшегося реагента, который ещё не вступил в реакцию (в граммах). Определите по графику, сколько граммов реагента вступило в реакцию за ${minutes(t)}.`,
    ...answer(used),
  };
}

// ─────────────── соответствие «интервал ↔ скорость изменения» (№7) ───────────────

/**
 * Ломаная из отрезков, у четырёх из которых — заданная роль: быстрее всего
 * росла, медленнее всего росла, падала, не менялась (или четыре варианта
 * «росла/снижалась быстрее/медленнее» у суточной температуры). «Быстрее
 * всего» сравнивается среди перечисленных интервалов — так и в КИМ.
 */
const RATE_SCENARIOS = [
  {
    key: 'car',
    segments: 6,
    width: 1,
    start: () => 0,
    bounds: [0, 120],
    roles: {
      fast: [40, 50, 60], slow: [10, 20], down: [-20, -30, -40], zero: [0],
    },
    other: [-20, -10, 0, 10, 20, 30],
    // С места автомобиль трогается разгоном: первый час не «стоял и не тормозил»
    firstUp: true,
    label: (i) => `${['первый', 'второй', 'третий', 'четвёртый', 'пятый', 'шестой'][i]} час пути`,
    text: {
      fast: 'скорость автомобиля росла быстрее всего',
      slow: 'скорость автомобиля росла медленнее всего',
      down: 'скорость автомобиля уменьшалась',
      zero: 'автомобиль ехал с постоянной скоростью',
    },
    leftTitle: 'ИНТЕРВАЛЫ ВРЕМЕНИ',
    valuesTitle: 'ХАРАКТЕРИСТИКИ ДВИЖЕНИЯ',
    question: 'На графике изображена зависимость скорости движения легкового автомобиля на пути между двумя городами от времени. На вертикальной оси отмечена скорость в км/ч, на горизонтальной — время в часах, прошедшее с начала движения автомобиля. Пользуясь графиком, поставьте в соответствие каждому интервалу времени характеристику движения автомобиля на этом интервале.',
    axis: (vals) => ({
      x: {
        min: 0, max: 6, grid: 1, ticks: vals.map((_, i) => ({ v: i, label: String(i) })), unit: 'ч',
      },
      y: {
        min: 0, max: Math.ceil((Math.max(...vals) + 1) / 20) * 20, grid: 10, labelEvery: 20, unit: 'км/ч',
      },
    }),
    dots: false,
  },
  {
    key: 'heat',
    segments: 6,
    width: 2,
    start: () => pick([10, 20, 30]),
    bounds: [0, 100],
    roles: {
      fast: [30, 40], slow: [10], down: [-10, -20], zero: [0],
    },
    other: [0, 10, 20],
    label: (i) => `${i * 2}–${i * 2 + 2} мин`,
    text: {
      fast: 'температура росла быстрее всего',
      slow: 'температура росла медленнее всего',
      down: 'температура падала',
      zero: 'температура не менялась',
    },
    leftTitle: 'ИНТЕРВАЛЫ ВРЕМЕНИ',
    valuesTitle: 'ХАРАКТЕРИСТИКИ ПРОЦЕССА',
    question: 'На графике показан процесс разогрева двигателя легкового автомобиля. На оси абсцисс откладывается время в минутах, прошедшее с момента запуска двигателя, на оси ординат — температура двигателя в градусах Цельсия. Пользуясь графиком, поставьте в соответствие каждому интервалу времени характеристику процесса разогрева двигателя на этом интервале.',
    axis: (vals) => ({
      x: {
        min: 0,
        max: 12,
        grid: 1,
        ticks: vals.map((_, i) => ({ v: i * 2, label: String(i * 2) })),
        unit: 'мин',
      },
      y: {
        min: 0, max: 100, grid: 10, labelEvery: 10, unit: '°C',
      },
    }),
    dots: false,
  },
  {
    key: 'day',
    segments: 8,
    width: 3,
    start: () => randInt(-2, 12),
    bounds: [-30, 40],
    // Ночью и вечером холодает, днём теплеет: роль берётся из своей группы,
    // иначе «температура росла» пришлась бы на три часа ночи.
    groups: { down: [0, 1, 5, 6, 7], up: [2, 3, 4] },
    roles: {
      upFast: [4, 5, 6], upSlow: [1, 2], downFast: [-4, -5], downSlow: [-1],
    },
    otherUp: [1, 2, 3, 4],
    otherDown: [-1, -2, -3],
    label: (i) => `${String(i * 3).padStart(2, '0')}:00–${String(i * 3 + 3).padStart(2, '0')}:00`,
    text: {
      upFast: 'температура росла быстрее всего',
      upSlow: 'температура росла медленнее всего',
      downFast: 'температура снижалась быстрее всего',
      downSlow: 'температура снижалась медленнее всего',
    },
    leftTitle: 'ПРОМЕЖУТКИ ВРЕМЕНИ',
    valuesTitle: 'ХАРАКТЕР ИЗМЕНЕНИЯ ТЕМПЕРАТУРЫ',
    question: 'На рисунке показано изменение температуры воздуха на протяжении суток. По горизонтали указывается время суток, по вертикали — значение температуры в градусах Цельсия. Пользуясь рисунком, установите соответствие между промежутками времени и характером изменения температуры.',
    axis: (vals) => ({
      x: {
        min: 0,
        max: 24,
        grid: 3,
        ticks: vals.map((_, i) => ({ v: i * 3, label: `${i * 3}:00` })),
      },
      y: {
        min: Math.floor((Math.min(...vals) - 1) / 2) * 2,
        max: Math.ceil((Math.max(...vals) + 1) / 2) * 2,
        grid: 1,
        labelEvery: 2,
        unit: '°C',
      },
    }),
    dots: true,
  },
];

function rateSlopes(sc) {
  const slopes = new Array(sc.segments).fill(null);
  const roleOf = new Array(sc.segments).fill(null);
  if (sc.groups) {
    const downs = shuffleArray([...sc.groups.down]).slice(0, 2);
    const ups = shuffleArray([...sc.groups.up]).slice(0, 2);
    [['downFast', downs[0]], ['downSlow', downs[1]], ['upFast', ups[0]], ['upSlow', ups[1]]]
      .forEach(([role, i]) => { roleOf[i] = role; slopes[i] = pick(sc.roles[role]); });
    for (let i = 0; i < sc.segments; i += 1) {
      if (slopes[i] === null) slopes[i] = sc.groups.up.includes(i) ? pick(sc.otherUp) : pick(sc.otherDown);
    }
  } else {
    const idx = shuffleArray([...Array(sc.segments).keys()]).slice(0, 4);
    const roles = shuffleArray(Object.keys(sc.roles));
    idx.forEach((i, k) => { roleOf[i] = roles[k]; slopes[i] = pick(sc.roles[roles[k]]); });
    for (let i = 0; i < sc.segments; i += 1) if (slopes[i] === null) slopes[i] = pick(sc.other);
    if (sc.firstUp && !(slopes[0] > 0)) return null;
  }
  return { slopes, roleOf };
}

function askRateMatch() {
  const sc = pick(RATE_SCENARIOS);
  const r = rateSlopes(sc);
  if (!r) return null;
  const vals = [sc.start()];
  r.slopes.forEach((d) => vals.push(vals[vals.length - 1] + d));
  if (Math.min(...vals) < sc.bounds[0] || Math.max(...vals) > sc.bounds[1]) return null;
  // «Ехал с постоянной скоростью» при нулевой скорости — это «стоял»
  if (sc.key === 'car' && r.roleOf.some((role, i) => role === 'zero' && vals[i] === 0)) return null;
  const { x, y } = sc.axis(vals);
  const chart = {
    type: 'line',
    x,
    y,
    series: [{ points: vals.map((v, i) => [i * sc.width, v]), dots: sc.dots }],
  };

  const listed = r.roleOf.map((role, i) => ({ role, i })).filter((p) => p.role);
  const values = shuffleArray(listed.map((p) => sc.text[p.role]));
  const digits = listed.map((p) => values.indexOf(sc.text[p.role]) + 1).join('');
  return {
    chart,
    question: sc.question,
    matching: {
      points: listed.map((p) => sc.label(p.i)),
      leftTitle: sc.leftTitle,
      valuesTitle: sc.valuesTitle,
      values,
      plain: true,
    },
    note: MATCH_NOTE,
    resultLatex: digits,
    answerValue: Number(digits),
  };
}

// ─────────────── соответствие «квартал ↔ характеристика» (№7) ───────────────

const QUARTERS = ['1-й квартал года', '2-й квартал года', '3-й квартал года', '4-й квартал года'];

/**
 * Характеристики квартала. Каждая — утверждение про три месяца (или про их
 * место в году); задание собирается из четырёх таких, что каждое верно ровно
 * для одного квартала и кварталы у них разные — иначе ответ не единственный.
 */
function quarterPredicates(s) {
  const q = [0, 1, 2, 3].map((i) => s.vals.slice(i * 3, i * 3 + 3));
  const max = Math.max(...s.vals);
  const min = Math.min(...s.vals);
  const T = s.kind === 'temp';
  const noun = T ? 'среднемесячная температура' : 'количество осадков';
  const list = [
    { text: T ? 'в квартале есть самый тёплый месяц года' : 'в квартале есть месяц с наибольшим количеством осадков за год', test: (a) => a.includes(max) },
    { text: T ? 'в квартале есть самый холодный месяц года' : 'в квартале есть месяц с наименьшим количеством осадков за год', test: (a) => a.includes(min) },
    { text: `${noun} росла${T ? '' : 'о'} от месяца к месяцу`, test: (a) => a[0] < a[1] && a[1] < a[2] },
    { text: `${noun} ${T ? 'снижалась' : 'уменьшалось'} от месяца к месяцу`, test: (a) => a[0] > a[1] && a[1] > a[2] },
  ];
  if (T) {
    list.push({ text: 'среднемесячная температура каждого месяца была отрицательной', test: (a) => a.every((v) => v < 0) });
    [10, 15, 20].forEach((X) => list.push({
      text: `среднемесячная температура каждого месяца была выше ${X}\u00A0°C`, test: (a) => a.every((v) => v > X),
    }));
  } else {
    [40, 60, 80].forEach((X) => list.push({
      text: `в каждом месяце выпадало более ${X}\u00A0мм осадков`, test: (a) => a.every((v) => v > X),
    }));
    [30, 40, 50].forEach((X) => list.push({
      text: `в каждом месяце выпадало менее ${X}\u00A0мм осадков`, test: (a) => a.every((v) => v < X),
    }));
  }
  return list
    .map((p) => ({ ...p, hits: q.map(p.test) }))
    .filter((p) => p.hits.filter(Boolean).length === 1)
    .map((p) => ({ text: p.text, quarter: p.hits.indexOf(true) }));
}

function askQuarterMatch() {
  const s = monthlyScene();
  const byQuarter = [0, 1, 2, 3].map((k) => quarterPredicates(s).filter((p) => p.quarter === k));
  if (byQuarter.some((list) => !list.length)) return null;
  const chosen = byQuarter.map((list) => pick(list));
  const values = shuffleArray(chosen.map((p) => p.text));
  const digits = chosen.map((p) => values.indexOf(p.text) + 1).join('');
  return {
    chart: s.chart,
    question: `${monthlyIntro(s)} Пользуясь диаграммой, поставьте в соответствие каждому из указанных периодов времени характеристику ${s.kind === 'temp' ? 'температуры' : 'осадков'} в этот период.`,
    matching: {
      points: [...QUARTERS],
      leftTitle: 'ПЕРИОДЫ ВРЕМЕНИ',
      valuesTitle: s.kind === 'temp' ? 'ХАРАКТЕРИСТИКИ ТЕМПЕРАТУРЫ' : 'ХАРАКТЕРИСТИКИ ОСАДКОВ',
      values,
      plain: true,
    },
    note: MATCH_NOTE,
    resultLatex: digits,
    answerValue: Number(digits),
  };
}

// ─────────────────────────────── каталог типов ───────────────────────────────

export const CATEGORY_LABELS_CHART = {
  temp_day_max: 'Температура за сутки: наибольшая',
  temp_day_min: 'Температура за сутки: наименьшая',
  temp_at_time: 'Температура в заданный час',
  temp_day_range: 'Температура: разность за сутки',
  heat_time: 'Разогрев: минут от A до B °C',
  heat_value: 'Разогрев: температура через t мин',
  heat_reach: 'Разогрев: когда достигла X °C',
  torque_rpm: 'Крутящий момент: наименьшие обороты',
  torque_speed: 'Крутящий момент: наименьшая скорость',
  reaction_used: 'Реакция: сколько граммов вступило',
  bar_max: 'Наибольшее значение',
  bar_min: 'Наименьшее значение',
  bar_half: 'Экстремум за полугодие',
  bar_count: 'Сколько месяцев выше/ниже порога',
  bar_range: 'Разность наибольшего и наименьшего',
  bar_diff: 'На сколько один месяц больше другого',
  match_rate: 'Интервалы ↔ скорость изменения',
  match_quarters: 'Кварталы ↔ характеристики',
};

export const CATEGORY_GROUPS_CHART = [
  {
    label: 'Графики',
    hint: 'База №3',
    keys: [
      'temp_day_max', 'temp_day_min', 'temp_at_time', 'temp_day_range',
      'heat_time', 'heat_value', 'heat_reach',
      'torque_rpm', 'torque_speed', 'reaction_used',
    ],
  },
  {
    label: 'Диаграммы',
    hint: 'База №3',
    keys: ['bar_max', 'bar_min', 'bar_half', 'bar_count', 'bar_range', 'bar_diff'],
  },
  {
    label: 'Соответствие',
    hint: 'База №7',
    keys: ['match_rate', 'match_quarters'],
  },
];

const ALL_CATS = CATEGORY_GROUPS_CHART.flatMap((g) => g.keys);
export const CHART_CATEGORIES = ALL_CATS;

// По умолчанию — по одному-два типа каждого вида: лист на шесть заданий
// (одна страница) получается разнообразным без ручного выбора.
const DEFAULT_ON = [
  'temp_day_max', 'heat_time', 'torque_rpm', 'reaction_used',
  'bar_min', 'bar_count', 'bar_diff',
  'match_rate', 'match_quarters',
];

export const DEFAULT_SETTINGS_CHART = {
  variantsCount: 2,
  questionsCount: 6,
  categories: Object.fromEntries(ALL_CATS.map((k) => [k, DEFAULT_ON.includes(k)])),
  categoryCounts: {},
  showAnswerSpace: true,
  columnsCount: 2,
  figureSize: 'm',
  // Ответ по картинке на глаз не проверишь — ключ учителя включён сразу и
  // печатается чёрным (как у листа «Производная и график»).
  showTeacherKey: true,
  keyColor: false,
};

const ASK_TRIES = 12;

/** Одно задание категории или null, если случайные данные так и не подошли. */
export function makeChartTask(cat) {
  const build = () => (cat.startsWith('temp_') ? askTemp3(cat)
    : cat.startsWith('heat_') ? askHeat(cat)
      : cat.startsWith('torque_') ? askTorque(cat)
        : cat === 'reaction_used' ? askReaction()
          : cat.startsWith('bar_') ? askBar(cat)
            : cat === 'match_rate' ? askRateMatch()
              : cat === 'match_quarters' ? askQuarterMatch()
                : null);
  for (let i = 0; i < ASK_TRIES; i += 1) {
    const task = build();
    if (task) return { ...task, cat };
  }
  return null;
}

/** Чистая генерация листа (сохранённые листы зовут её же). */
export function generateChartVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_CHART, ...settings };
  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => ALL_CATS.includes(k),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: 60,
    make: (cat) => makeChartTask(cat),
  });
}

// Для тестов: сцены без вопроса
export const __scenes = {
  temp3Scene, monthlyScene, heatScene, torqueScene, reactionScene, RATE_SCENARIOS,
};
