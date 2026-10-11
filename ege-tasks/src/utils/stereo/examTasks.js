// Задачи первой части ЕГЭ по стереометрии — по типам экзамена, а не по
// «формуле + телу». Каталог собран по банку («Решу ЕГЭ»): у каждого типа
// свой сюжет и своё тело, учитель выбирает только номер и тип.
//
//   База №11 «Прикладная стереометрия» — сосуды, детали, кружки, шары-гири,
//     составные многогранники, «отпилили вершины», копии пирамид;
//   База №13 «Задачи по стереометрии» — параллелепипед, призма, пирамида,
//     цилиндр, конус, шар;
//   Профиль №3 «Стереометрия» — то же глубже + комбинации тел, элементы
//     составных многогранников.
//
// Тип отдаёт план задания (как formulaTasks): тело, подписи длин, шаги
// чертежа, искомый отрезок, вопрос, ответ, решение. Ответ — конечная дробь;
// подпись у ребра сверяется с его длиной на чертеже (buildFormulaTask).

import { buildBody } from './bodies';
import { buildFormulaTask, finiteDecimal } from './formulaTasks';
import { stepsTask } from './stepsTasks';
import { comboTask } from './revTasks';
import { rng } from './sectionTasks';
import { addPart, stereoBlockMarkdown, stereoDrawingSvg } from './dsl';
import { DEFAULT_CAMERA } from './camera';

const pickInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const numText = (x) => String(Math.round(x * 1000) / 1000).replace('.', ',');
const numTex = (x) => numText(x).replace(',', '{,}');

/** n = k²·m → { k, m } (m без квадратов). */
function rootParts(n) {
  let k = 1;
  let m = Math.round(n);
  for (let p = 2; p * p <= m; p += 1) while (m % (p * p) === 0) { m /= p * p; k *= p; }
  return { k, m };
}

/** Данное: значение, LaTeX и подпись на чертеже. */
const G = {
  int: (n) => ({ v: n, tex: numTex(n), label: numText(n) }),
  surd: (k, m) => ({
    v: k * Math.sqrt(m), tex: `${k === 1 ? '' : numTex(k)}\\sqrt{${m}}`, label: `${k === 1 ? '' : numText(k)}√${m}`,
  }),
  /** √n в простейшем виде (целое, если n — квадрат). */
  root: (n) => {
    const { k, m } = rootParts(n);
    return m === 1 ? G.int(k) : G.surd(k, m);
  },
};

/** «в 2 раза», «в 5 раз», «в 1,5 раза». */
const times = (k) => {
  const n = Math.abs(Math.round(k)) % 100;
  const raza = !Number.isInteger(k) || (n % 10 >= 2 && n % 10 <= 4 && !(n >= 12 && n <= 14));
  return `в $${numTex(k)}$ ${raza ? 'раза' : 'раз'}`;
};

const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20], [7, 24, 25]];
const QUADS = [[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [4, 4, 7, 9], [2, 6, 9, 11], [6, 6, 7, 11], [3, 4, 12, 13], [2, 10, 11, 15], [8, 9, 12, 17], [4, 8, 8, 12], [3, 6, 6, 9], [2, 4, 4, 6]];
const shuffled = (rand, t) => (rand() < 0.5 ? t : [t[1], t[0], t[2]]);
const BOX = 'ABCDA_1B_1C_1D_1';
const HEIGHT = (from = 'S') => ({ id: 'h', type: 'perp', from, plane: ['A', 'B', 'C'], name: 'O' });
const BYPI = (w) => `В ответе укажите $\\dfrac{${w}}{\\pi}$.`;

/** Два тела рядом (донышки на одном уровне). */
const side = (a, b) => addPart(a, b, { kind: 'right' });

// ─── База №13 ───────────────────────────────────────────────────────────────

const B13 = {
  b13_boxFaceDiag: {
    group: 'Параллелепипед', label: 'Два ребра и диагональ боковой грани → объём или площадь поверхности',
    facet: 'Прямоугольный параллелепипед',
    gen: (rand) => {
      const [a, b, c] = [pickInt(rand, 2, 8), pickInt(rand, 2, 7), pickInt(rand, 2, 7)];
      const d = G.root(b * b + c * c);
      const vol = rand() < 0.5;
      return {
        spec: { kind: 'box', a, b, c },
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['B', 'C'], g: G.int(b) }, { ref: ['B', 'C1'], g: d }],
        question: `В прямоугольном параллелепипеде $${BOX}$ рёбра $AB$, $BC$ и диагональ боковой грани $BC_1$ равны соответственно $${a}$, $${b}$ и $${d.tex}$. Найдите ${vol ? 'объём' : 'площадь поверхности'} параллелепипеда.`,
        answer: vol ? a * b * c : 2 * (a * b + b * c + a * c),
        solution: [
          `Из прямоугольного треугольника $BCC_1$: $CC_1 = \\sqrt{BC_1^2 - BC^2} = \\sqrt{${b * b + c * c} - ${b * b}} = ${c}$.`,
          vol ? `$V = ${a}\\cdot ${b}\\cdot ${c} = ${a * b * c}$.` : `$S = 2(${a}\\cdot ${b} + ${b}\\cdot ${c} + ${a}\\cdot ${c}) = ${2 * (a * b + b * c + a * c)}$.`,
        ],
      };
    },
  },
  b13_boxTwoEdges: {
    group: 'Параллелепипед', label: 'Два ребра из одной вершины и объём → площадь поверхности',
    facet: 'Прямоугольный параллелепипед',
    gen: (rand) => {
      const [a, b, c] = [pickInt(rand, 1, 8), pickInt(rand, 2, 8), pickInt(rand, 2, 9)];
      return {
        spec: { kind: 'box', a, b, c }, labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'D'], g: G.int(b) }],
        question: `Два ребра прямоугольного параллелепипеда, выходящие из одной вершины, равны $${a}$ и $${b}$. Объём параллелепипеда равен $${a * b * c}$. Найдите площадь его поверхности.`,
        answer: 2 * (a * b + b * c + a * c),
        solution: [`Третье ребро $c = \\dfrac{${a * b * c}}{${a}\\cdot ${b}} = ${c}$.`, `$S = 2(ab + bc + ac) = ${2 * (a * b + b * c + a * c)}$.`],
      };
    },
  },
  b13_pyramidInBox: {
    group: 'Параллелепипед', label: 'Объём параллелепипеда → объём пирамиды из его вершин',
    facet: 'Объём пирамиды',
    gen: (rand) => {
      const kind = pick(rand, ['ABDA1', 'ABCB1', 'AD1CB1']);
      const third = kind === 'AD1CB1';
      const V = (third ? 3 : 6) * pickInt(rand, 1, 12) * (rand() < 0.3 ? 0.5 : 1);
      const names = kind.match(/[A-Z]1?/g);
      const segs = [];
      for (let i = 0; i < names.length; i += 1) for (let j = i + 1; j < names.length; j += 1) segs.push([names[i], names[j]]);
      const tex = names.map((n) => n.replace('1', '_1')).join('');
      return {
        spec: { kind: 'box', a: 4, b: 3, c: 3.4 }, labels: [], skipShape: true,
        extra: segs.map((s, i) => ({ id: `s${i}`, type: 'segment', ref: s })),
        question: `Объём параллелепипеда $${BOX}$ равен $${numTex(V)}$. Найдите объём треугольной пирамиды $${tex}$.`,
        answer: third ? V / 3 : V / 6,
        solution: third
          ? ['Пирамида получается из параллелепипеда отрезанием четырёх «угловых» пирамид, объём каждой — $\\dfrac16 V$.', `$V_{\\text{пир}} = V - 4\\cdot\\dfrac16 V = \\dfrac13 V = ${numTex(V / 3)}$.`]
          : [`Основание пирамиды — половина грани параллелепипеда, высота — его ребро: $V_{\\text{пир}} = \\dfrac13\\cdot\\dfrac12 S\\cdot h = \\dfrac16 V = ${numTex(V / 6)}$.`],
      };
    },
  },
  b13_rightPrism: {
    group: 'Призма', label: 'Прямая призма с прямоугольным треугольником в основании → объём',
    facet: 'Прямая призма',
    gen: (rand) => {
      const [a, b] = [pickInt(rand, 2, 8), pickInt(rand, 2, 8)];
      const h = pickInt(rand, 2, 9);
      const viaHyp = rand() < 0.5;
      const hyp = G.root(a * a + b * b);
      return {
        spec: { kind: 'prism', base: 'poly', poly: [[0, 0], [a, 0], [0, b]], h },
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, viaHyp ? { ref: ['B', 'C'], g: hyp } : { ref: ['A', 'C'], g: G.int(b) }, { ref: ['A', 'A1'], g: G.int(h) }],
        question: viaHyp
          ? `В основании прямой призмы лежит прямоугольный треугольник, один из катетов которого равен $${a}$, а гипотенуза равна $${hyp.tex}$. Найдите объём призмы, если её высота равна $${h}$.`
          : `Основанием прямой треугольной призмы служит прямоугольный треугольник с катетами $${a}$ и $${b}$, боковое ребро равно $${h}$. Найдите объём призмы.`,
        answer: (a * b * h) / 2,
        solution: [
          ...(viaHyp ? [`Второй катет: $\\sqrt{${a * a + b * b} - ${a * a}} = ${b}$.`] : []),
          `$V = S_{\\text{осн}}\\cdot h = \\dfrac12\\cdot ${a}\\cdot ${b}\\cdot ${h} = ${numTex((a * b * h) / 2)}$.`,
        ],
      };
    },
  },
  b13_pyramidLateral: {
    group: 'Пирамида', label: 'Правильная пирамида: сторона основания и боковое ребро → площадь боковой поверхности',
    facet: 'Правильная пирамида',
    gen: (rand) => {
      const n = pick(rand, [3, 4, 6]);
      const [half, f, l] = shuffled(rand, pick(rand, TRIPLES));
      const a = 2 * half;
      const R = n === 3 ? a / Math.sqrt(3) : n === 4 ? a / Math.SQRT2 : a;
      if (l <= R * 1.08) return null;
      const word = { 3: 'треугольной', 4: 'четырёхугольной', 6: 'шестиугольной' }[n];
      return {
        spec: { kind: 'pyramid', n, a, h: Math.sqrt(l * l - R * R), apex: 'S' },
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['S', 'A'], g: G.int(l) }],
        question: `Стороны основания правильной ${word} пирамиды равны $${a}$, боковые рёбра равны $${l}$. Найдите площадь боковой поверхности этой пирамиды.`,
        answer: (n * a * f) / 2,
        solution: [
          `Боковая грань — равнобедренный треугольник; его высота (апофема) $\\sqrt{${l * l} - ${half * half}} = ${f}$.`,
          `$S_{\\text{бок}} = ${n}\\cdot\\dfrac12\\cdot ${a}\\cdot ${f} = ${numTex((n * a * f) / 2)}$.`,
        ],
      };
    },
  },
  b13_regPyramidVolume: {
    group: 'Пирамида', label: 'Объём правильной пирамиды (сторона и высота / боковое ребро)',
    facet: 'Объём пирамиды',
    gen: (rand) => {
      if (rand() < 0.5) {
        const a = pickInt(rand, 2, 12);
        const k = pickInt(rand, 1, 5);
        const hG = G.surd(k, 3);
        return {
          spec: { kind: 'pyramid', n: 3, a, h: hG.v, apex: 'S' }, extra: [HEIGHT()],
          labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['S', 'O'], g: hG }],
          question: `Найдите объём правильной треугольной пирамиды, стороны основания которой равны $${a}$, а высота равна $${hG.tex}$.`,
          answer: (a * a * k) / 4,
          solution: [`$V = \\dfrac13\\cdot\\dfrac{a^2\\sqrt3}{4}\\cdot h = \\dfrac13\\cdot\\dfrac{${a * a}\\sqrt3}{4}\\cdot ${hG.tex} = ${numTex((a * a * k) / 4)}$.`],
        };
      }
      const a = 2 * pickInt(rand, 1, 5);
      const h = pickInt(rand, 1, 9);
      if ((a * a * h) % 3) return null;
      const l = G.root(h * h + (a * a) / 2);
      return {
        spec: { kind: 'pyramid', n: 4, a, h, apex: 'S' },
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['S', 'A'], g: l }],
        question: `Найдите объём правильной четырёхугольной пирамиды, сторона основания которой равна $${a}$, а боковое ребро равно $${l.tex}$.`,
        answer: (a * a * h) / 3,
        solution: [
          `Высота падает в центр квадрата, половина диагонали $\\dfrac{a\\sqrt2}{2}$: $h^2 = ${numTex(h * h + (a * a) / 2)} - ${(a * a) / 2} = ${h * h}$, $h = ${h}$.`,
          `$V = \\dfrac13 a^2 h = \\dfrac13\\cdot ${a * a}\\cdot ${h} = ${numTex((a * a * h) / 3)}$.`,
        ],
      };
    },
  },
  b13_specialPyramid: {
    group: 'Пирамида', label: 'Ребро ⊥ основанию или три взаимно перпендикулярных ребра → объём',
    facet: 'Объём пирамиды',
    gen: (rand) => {
      if (rand() < 0.5) {
        const a = pickInt(rand, 2, 10);
        const k = pickInt(rand, 1, 4);
        const hG = G.surd(k, 3);
        return {
          spec: { kind: 'pyramid', n: 3, a, h: hG.v, apex: 'S', over: [0] },
          labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['S', 'A'], g: hG }],
          question: `В основании пирамиды $SABC$ лежит правильный треугольник $ABC$ со стороной $${a}$, а боковое ребро $SA$ перпендикулярно основанию и равно $${hG.tex}$. Найдите объём пирамиды $SABC$.`,
          answer: (a * a * k) / 4,
          solution: [`$SA$ — высота: $V = \\dfrac13\\cdot\\dfrac{${a * a}\\sqrt3}{4}\\cdot ${hG.tex} = ${numTex((a * a * k) / 4)}$.`],
        };
      }
      const [a, b, c] = [pickInt(rand, 2, 9), pickInt(rand, 2, 12), pickInt(rand, 2, 9)];
      return {
        spec: { kind: 'hull', pts: [[0, 0, 0], [a, 0, 0], [0, b, 0], [0, 0, c]], labels: ['A', 'B', 'C', 'D'] },
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'C'], g: G.int(b) }, { ref: ['A', 'D'], g: G.int(c) }],
        question: `В треугольной пирамиде $ABCD$ рёбра $AB$, $AC$ и $AD$ взаимно перпендикулярны. Найдите объём этой пирамиды, если $AB = ${a}$, $AC = ${b}$ и $AD = ${c}$.`,
        answer: (a * b * c) / 6,
        solution: [`Основание — прямоугольный треугольник $ABC$, высота — $AD$: $V = \\dfrac13\\cdot\\dfrac12\\cdot ${a}\\cdot ${b}\\cdot ${c} = ${numTex((a * b * c) / 6)}$.`],
      };
    },
  },
  b13_pyramidHeight: {
    group: 'Пирамида', label: 'Основание — прямоугольник, объём → высота',
    facet: 'Объём пирамиды',
    gen: (rand) => {
      const [a, b] = [pickInt(rand, 2, 9), pickInt(rand, 2, 9)];
      const h = pickInt(rand, 2, 10);
      const V = (a * b * h) / 3;
      if (!finiteDecimal(V)) return null;
      return {
        spec: { kind: 'pyramid', n: 4, base: 'rect', a, b, h, apex: 'S' }, extra: [HEIGHT()], ask: ['S', 'O'],
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'D'], g: G.int(b) }],
        question: `Основанием четырёхугольной пирамиды является прямоугольник со сторонами $${a}$ и $${b}$. Найдите высоту этой пирамиды, если её объём равен $${numTex(V)}$.`,
        answer: h, solution: [`$V = \\dfrac13 S h$, $h = \\dfrac{3V}{S} = \\dfrac{${numTex(3 * V)}}{${a * b}} = ${h}$.`],
      };
    },
  },
  b13_twoCylinders: {
    group: 'Цилиндр', label: 'Два цилиндра: во сколько раз объём одного больше',
    facet: 'Цилиндр',
    gen: (rand) => {
      const [r1, h1, r2, h2] = [pickInt(rand, 1, 6), pickInt(rand, 1, 6), pickInt(rand, 1, 8), pickInt(rand, 1, 8)];
      const k = (r2 * r2 * h2) / (r1 * r1 * h1);
      if (k <= 1 || !finiteDecimal(k)) return null;
      return {
        spec: side({ kind: 'cylinder', r: r1, h: h1 }, { kind: 'cylinder', r: r2, h: h2 }), skipShape: true,
        labels: [{ ref: ['O', 'A'], g: G.int(r1) }, { ref: ['A', 'A1'], g: G.int(h1) }, { ref: ['O2', 'A2'], g: G.int(r2) }, { ref: ['A2', 'A12'], g: G.int(h2) }],
        question: `Даны два цилиндра. Радиус основания и высота первого равны соответственно $${r1}$ и $${h1}$, а второго — $${r2}$ и $${h2}$. Во сколько раз объём второго цилиндра больше объёма первого?`,
        answer: k, solution: [`$\\dfrac{V_2}{V_1} = \\dfrac{\\pi\\cdot ${r2}^2\\cdot ${h2}}{\\pi\\cdot ${r1}^2\\cdot ${h1}} = ${numTex(k)}$.`],
      };
    },
  },
  b13_cylSection: {
    group: 'Цилиндр', label: 'Сечение, параллельное оси, на расстоянии от неё → площадь',
    facet: 'Цилиндр',
    gen: (rand) => {
      const [d, half, r] = shuffled(rand, pick(rand, TRIPLES.filter((t) => t[2] <= 17)));
      const h = pickInt(rand, 3, 20);
      const alpha = (Math.acos(d / r) * 180) / Math.PI;
      const ang = (x) => Math.round(x * 1000) / 1000;
      return {
        spec: { kind: 'cylinder', r, h }, skipShape: true,
        extra: [
          { id: 'p', type: 'pointOnCircle', name: 'P', center: 'O', angle: ang(-90 - alpha) },
          { id: 'q', type: 'pointOnCircle', name: 'Q', center: 'O', angle: ang(-90 + alpha) },
          { id: 'p1', type: 'pointOnCircle', name: 'P1', center: 'O1', angle: ang(-90 - alpha) },
          { id: 'q1', type: 'pointOnCircle', name: 'Q1', center: 'O1', angle: ang(-90 + alpha) },
          { id: 'f', type: 'fill', pts: ['P', 'Q', 'Q1', 'P1'] },
          { id: 's1', type: 'segment', ref: ['P', 'Q'] }, { id: 's2', type: 'segment', ref: ['P1', 'Q1'] },
          { id: 's3', type: 'segment', ref: ['P', 'P1'] }, { id: 's4', type: 'segment', ref: ['Q', 'Q1'] },
          { id: 'm', type: 'pointOnLine', name: 'M', ref: ['P', 'Q'], t: 0.5, ratio: [1, 1] },
        ],
        labels: [{ ref: ['O', 'M'], g: G.int(d) }, { ref: ['Q', 'Q1'], g: G.int(h) }],
        hide: ['P', 'Q', 'P1', 'Q1', 'M'],
        question: `Радиус основания цилиндра равен $${r}$, а его образующая равна $${h}$. Сечение, параллельное оси цилиндра, удалено от неё на расстояние, равное $${d}$. Найдите площадь этого сечения.`,
        answer: 2 * half * h,
        solution: [`Сечение — прямоугольник; его сторона в основании — хорда: $2\\sqrt{${r * r} - ${d * d}} = ${2 * half}$.`, `$S = ${2 * half}\\cdot ${h} = ${2 * half * h}$.`],
      };
    },
  },
  b13_twoCones: {
    group: 'Конус', label: 'Два конуса: во сколько раз объём или боковая поверхность больше',
    facet: 'Конус',
    gen: (rand) => {
      const vol = rand() < 0.5;
      const [r1, x1, r2, x2] = [pickInt(rand, 1, 6), pickInt(rand, 2, 8), pickInt(rand, 2, 8), pickInt(rand, 2, 9)];
      const k = vol ? (r2 * r2 * x2) / (r1 * r1 * x1) : (r2 * x2) / (r1 * x1);
      if (k <= 1 || !finiteDecimal(k)) return null;
      if (!vol && (x1 <= r1 || x2 <= r2)) return null; // образующая длиннее радиуса
      const h1 = vol ? x1 : Math.sqrt(x1 * x1 - r1 * r1);
      const h2 = vol ? x2 : Math.sqrt(x2 * x2 - r2 * r2);
      return {
        spec: side({ kind: 'cone', r: r1, h: h1 }, { kind: 'cone', r: r2, h: h2 }), skipShape: true,
        labels: vol
          ? [{ ref: ['O', 'A'], g: G.int(r1) }, { ref: ['S', 'O'], g: G.int(x1) }, { ref: ['O2', 'A2'], g: G.int(r2) }, { ref: ['S2', 'O2'], g: G.int(x2) }]
          : [{ ref: ['O', 'A'], g: G.int(r1) }, { ref: ['S', 'A'], g: G.int(x1) }, { ref: ['O2', 'A2'], g: G.int(r2) }, { ref: ['S2', 'A2'], g: G.int(x2) }],
        question: vol
          ? `Даны два конуса. Радиус основания и высота первого конуса равны соответственно $${r1}$ и $${x1}$, а второго — $${r2}$ и $${x2}$. Во сколько раз объём второго конуса больше объёма первого?`
          : `Даны два конуса. Радиус основания и образующая первого конуса равны соответственно $${r1}$ и $${x1}$, а второго — $${r2}$ и $${x2}$. Во сколько раз площадь боковой поверхности второго конуса больше площади боковой поверхности первого?`,
        answer: k,
        solution: [vol
          ? `$V = \\dfrac13\\pi r^2 h$: $\\dfrac{${r2}^2\\cdot ${x2}}{${r1}^2\\cdot ${x1}} = ${numTex(k)}$.`
          : `$S_{\\text{бок}} = \\pi r l$: $\\dfrac{${r2}\\cdot ${x2}}{${r1}\\cdot ${x1}} = ${numTex(k)}$.`],
      };
    },
  },
  b13_coneRadius: {
    group: 'Конус', label: 'Объём и высота конуса → радиус основания',
    facet: 'Конус',
    gen: (rand) => {
      const r = pickInt(rand, 1, 9);
      const h = pickInt(rand, 1, 9);
      const V = (r * r * h) / 3;
      if (!finiteDecimal(V)) return null;
      return {
        spec: { kind: 'cone', r, h }, ask: ['O', 'A'], labels: [{ ref: ['S', 'O'], g: G.int(h) }],
        question: `Объём конуса равен $${numTex(V)}\\pi$, а его высота равна $${h}$. Найдите радиус основания конуса.`,
        answer: r, solution: [`$\\dfrac13\\pi r^2\\cdot ${h} = ${numTex(V)}\\pi$, $r^2 = ${r * r}$, $r = ${r}$.`],
      };
    },
  },
  b13_coneCut: {
    group: 'Конус', label: 'Плоскость, параллельная основанию, делит высоту → объём отсечённого конуса',
    facet: 'Конус',
    gen: (rand) => {
      const [p, q] = pick(rand, [[1, 1], [1, 2], [2, 1], [1, 3]]);
      const n = p + q;
      const V = n ** 3 * pickInt(rand, 1, 5);
      const small = (V * p ** 3) / n ** 3;
      const mid = p === q;
      return {
        spec: { kind: 'cone', r: 3, h: 4 }, skipShape: true,
        extra: [
          { id: 'k', type: 'pointOnLine', name: 'K', ref: ['S', 'O'], t: p / n, ...(mid ? { ratio: [1, 1] } : { ratio: [p, q] }) },
          { id: 'sec', type: 'perpPlane', from: 'K', ref: ['S', 'O'], style: 'section' },
          { id: 'so', type: 'segment', ref: ['S', 'O'] },
        ],
        hide: ['K'],
        question: mid
          ? `Объём конуса равен $${V}$. Через середину высоты конуса проведена плоскость, параллельная основанию. Найдите объём конуса, отсекаемого от данного конуса проведённой плоскостью.`
          : `Объём конуса равен $${V}$. Через точку, делящую высоту конуса в отношении $${p} : ${q}$, считая от вершины, проведена плоскость, параллельная основанию. Найдите объём конуса, отсекаемого от данного конуса проведённой плоскостью.`,
        answer: small,
        solution: [`Отсечённый конус подобен данному с коэффициентом $\\dfrac{${p}}{${n}}$, объёмы относятся как куб коэффициента: $${V}\\cdot\\left(\\dfrac{${p}}{${n}}\\right)^3 = ${numTex(small)}$.`],
      };
    },
  },
  b13_twoSpheres: {
    group: 'Шар', label: 'Два шара: во сколько раз объём или площадь поверхности больше',
    facet: 'Шар',
    gen: (rand) => {
      const r2 = pickInt(rand, 1, 4);
      const k = pickInt(rand, 2, 4);
      const r1 = r2 * k;
      const vol = rand() < 0.6;
      return {
        spec: side({ kind: 'sphere', r: r1 }, { kind: 'sphere', r: r2 }), skipShape: true,
        labels: [{ ref: ['O', 'A'], g: G.int(r1) }, { ref: ['O2', 'A2'], g: G.int(r2) }],
        question: `Даны два шара с радиусами $${r1}$ и $${r2}$. Во сколько раз ${vol ? 'объём большего шара больше объёма меньшего' : 'площадь поверхности первого шара больше площади поверхности второго'}?`,
        answer: vol ? k ** 3 : k * k,
        solution: [vol ? `Объёмы относятся как кубы радиусов: $${k}^3 = ${k ** 3}$.` : `Площади поверхностей относятся как квадраты радиусов: $${k}^2 = ${k * k}$.`],
      };
    },
  },
};

// ─── База №11 ───────────────────────────────────────────────────────────────

const B11 = {
  b11_pour: {
    group: 'Сосуды', label: 'Воду перелили в сосуд шире → новый уровень',
    facet: 'Объём цилиндра',
    gen: (rand) => {
      const k = pickInt(rand, 2, 5);
      const h = k * k * pickInt(rand, 2, 12);
      const cyl = rand() < 0.6;
      const viaDiam = cyl && rand() < 0.4;
      const spec = cyl ? { kind: 'cylinder', r: 2, h: 5 } : { kind: 'prism', n: rand() < 0.5 ? 4 : 3, a: 3, h: 5 };
      const vessel = cyl ? 'сосуде цилиндрической формы' : `сосуде, имеющем форму правильной ${spec.n === 4 ? 'четырёхугольной' : 'треугольной'} призмы,`;
      const wider = cyl ? (viaDiam ? `диаметр основания ${times(k)} больше` : `радиус основания ${times(k)} больше`) : `сторона основания ${times(k)} больше`;
      return {
        spec, extra: [{ id: 'w', type: 'level', t: 0.6 }], labels: [], skipShape: true,
        question: `Вода в ${vessel} находится на уровне $${h}$ см. На каком уровне окажется вода, если её перелить в другой такой же по форме сосуд, у которого ${wider}, чем у первого? Ответ выразите в сантиметрах.`,
        answer: h / (k * k),
        solution: [`Объём воды тот же, площадь основания второго сосуда больше в $${k}^2 = ${k * k}$ раз — уровень во столько же раз ниже: $\\dfrac{${h}}{${k * k}} = ${numTex(h / (k * k))}$ см.`],
      };
    },
  },
  b11_detail: {
    group: 'Сосуды', label: 'В воду погрузили деталь, уровень поднялся → объём детали',
    facet: 'Объём цилиндра',
    gen: (rand) => {
      const cyl = rand() < 0.6;
      const spec = cyl ? { kind: 'cylinder', r: 2, h: 5 } : { kind: 'prism', n: 4, a: 3, h: 5 };
      const vessel = cyl ? 'цилиндрический сосуд' : 'сосуд, имеющий форму правильной четырёхугольной призмы,';
      if (rand() < 0.5) {
        const h = pickInt(rand, 5, 25);
        const dh = pickInt(rand, 2, 15);
        const V = h * pickInt(rand, 20, 200);
        return {
          spec, extra: [{ id: 'w', type: 'level', t: 0.5 }], labels: [], skipShape: true,
          question: `В ${vessel} налили $${V}$ см³ воды. Уровень воды при этом достигает высоты $${h}$ см. В жидкость полностью погрузили деталь. При этом уровень жидкости в сосуде поднялся на $${dh}$ см. Чему равен объём детали? Ответ выразите в см³.`,
          answer: (V * dh) / h,
          solution: [`Объём детали — объём вытесненной воды; при той же площади основания объём пропорционален высоте: $${V}\\cdot\\dfrac{${dh}}{${h}} = ${numTex((V * dh) / h)}$ см³.`],
        };
      }
      const k = pick(rand, [1.2, 1.4, 1.5, 1.6, 2, 2.5, 3]);
      const L = pickInt(rand, 2, 20);
      return {
        spec, extra: [{ id: 'w', type: 'level', t: 0.4 }], labels: [], skipShape: true,
        question: `В ${vessel} налито $${L}$ л воды. После полного погружения в воду детали уровень воды в сосуде поднялся ${times(k)}. Найдите объём детали. Ответ дайте в кубических сантиметрах (в одном литре $1000$ см³).`,
        answer: Math.round(L * (k - 1) * 1000 * 1000) / 1000,
        solution: [`Объём «воды с деталью» в $${numTex(k)}$ раза больше объёма воды, деталь — разность: $${L}\\cdot(${numTex(k)} - 1) = ${numTex(L * (k - 1))}$ л $= ${numTex(L * (k - 1) * 1000)}$ см³.`],
      };
    },
  },
  b11_coneVessel: {
    group: 'Сосуды', label: 'Конический сосуд налит до части высоты → объём жидкости или сколько долить',
    facet: 'Объём конуса',
    gen: (rand) => {
      const [p, q] = pick(rand, [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4]]);
      const frac = p / q;
      const fill = rand() < 0.5;
      const unit = q ** 3;
      if (fill) {
        const Vl = p ** 3 * pickInt(rand, 1, 20);
        const add = (Vl * (q ** 3 - p ** 3)) / p ** 3;
        return {
          spec: { kind: 'cone', r: 3, h: 5, down: true }, extra: [{ id: 'w', type: 'level', t: frac }], labels: [], skipShape: true,
          question: `В сосуде, имеющем форму конуса, уровень жидкости достигает $\\frac{${p}}{${q}}$ высоты. Объём жидкости равен $${Vl}$ мл. Сколько миллилитров жидкости нужно долить, чтобы полностью наполнить сосуд?`,
          answer: add,
          solution: [`Жидкость занимает конус, подобный сосуду с коэффициентом $\\frac{${p}}{${q}}$: объём сосуда $${Vl}\\cdot\\left(\\frac{${q}}{${p}}\\right)^3 = ${numTex((Vl * q ** 3) / p ** 3)}$ мл.`, `Долить: $${numTex((Vl * q ** 3) / p ** 3)} - ${Vl} = ${numTex(add)}$ мл.`],
        };
      }
      const V = unit * pickInt(rand, 1, 20);
      return {
        spec: { kind: 'cone', r: 3, h: 5, down: true }, extra: [{ id: 'w', type: 'level', t: frac }], labels: [], skipShape: true,
        question: `В сосуде, имеющем форму конуса, уровень жидкости достигает $\\frac{${p}}{${q}}$ высоты. Объём сосуда равен $${V}$ мл. Чему равен объём налитой жидкости? Ответ дайте в миллилитрах.`,
        answer: (V * p ** 3) / q ** 3,
        solution: [`Жидкость — конус, подобный сосуду с коэффициентом $\\frac{${p}}{${q}}$: $${V}\\cdot\\left(\\frac{${p}}{${q}}\\right)^3 = ${numTex((V * p ** 3) / q ** 3)}$ мл.`],
      };
    },
  },
  b11_sphereMass: {
    group: 'Круглые тела', label: 'Однородные шары: масса по диаметру',
    facet: 'Шар',
    gen: (rand) => {
      const [d1, d2] = [pickInt(rand, 2, 6), pickInt(rand, 2, 8)];
      if (d1 === d2) return null;
      const m1 = d1 ** 3 * pickInt(rand, 1, 12);
      const m2 = (m1 * d2 ** 3) / d1 ** 3;
      return {
        spec: side({ kind: 'sphere', r: d1 / 2 }, { kind: 'sphere', r: d2 / 2 }), labels: [], skipShape: true,
        question: `Однородный шар диаметром $${d1}$ см весит $${m1}$ граммов. Сколько граммов весит шар диаметром $${d2}$ см, изготовленный из того же материала?`,
        answer: m2,
        solution: [`Масса пропорциональна объёму, объём — кубу диаметра: $${m1}\\cdot\\left(\\dfrac{${d2}}{${d1}}\\right)^3 = ${numTex(m2)}$ г.`],
      };
    },
  },
  b11_mugs: {
    group: 'Круглые тела', label: 'Две кружки цилиндрической формы: во сколько раз объём больше',
    facet: 'Цилиндр',
    gen: (rand) => comboTask('fScale', rand, 2),
  },
  b11_aquarium: {
    group: 'Многогранники', label: 'Аквариум (куб или параллелепипед) → объём в литрах',
    facet: 'Прямоугольный параллелепипед',
    gen: (rand) => {
      const cube = rand() < 0.35;
      const [a, b, c] = cube ? Array(3).fill(10 * pickInt(rand, 2, 8)) : [10 * pickInt(rand, 3, 9), 10 * pickInt(rand, 2, 6), 10 * pickInt(rand, 2, 6)];
      return {
        spec: cube ? { kind: 'cube', a } : { kind: 'box', a, b, c }, skipShape: true,
        extra: [{ id: 'w', type: 'level', t: 0.75 }],
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, ...(cube ? [] : [{ ref: ['A', 'D'], g: G.int(b) }, { ref: ['A', 'A1'], g: G.int(c) }])],
        question: cube
          ? `Аквариум имеет форму куба со стороной $${a}$ см. Сколько литров составляет объём аквариума? В одном литре $1000$ кубических сантиметров.`
          : `Аквариум имеет форму прямоугольного параллелепипеда с размерами $${a}$ см $\\times$ $${b}$ см $\\times$ $${c}$ см. Сколько литров составляет объём аквариума? В одном литре $1000$ кубических сантиметров.`,
        answer: (a * b * c) / 1000,
        solution: [`$V = ${a}\\cdot ${b}\\cdot ${c} = ${a * b * c}$ см³ $= ${numTex((a * b * c) / 1000)}$ л.`],
      };
    },
  },
  b11_stepsVolume: {
    group: 'Составные многогранники', label: 'Деталь (все двугранные углы прямые) → объём',
    facet: 'Многогранник',
    gen: (rand) => stepsTask('fVolume', rand, DEFAULT_CAMERA),
  },
  b11_stepsSurface: {
    group: 'Составные многогранники', label: 'Деталь (все двугранные углы прямые) → площадь поверхности',
    facet: 'Многогранник',
    gen: (rand) => stepsTask('fSurface', rand, DEFAULT_CAMERA),
  },
  b11_countParts: {
    group: 'Многогранники', label: '«Отпилили вершины», «приклеили пирамиду» → сколько граней, рёбер, вершин',
    facet: 'Многогранник',
    gen: (rand) => {
      const n = pick(rand, [3, 4, 5, 6]);
      const word = { 3: 'треугольной', 4: 'четырёхугольной', 5: 'пятиугольной', 6: 'шестиугольной' }[n];
      const cut = rand() < 0.5;
      const what = pick(rand, [['граней', 'faces'], ['рёбер', 'edges'], ['вершин', 'order']]);
      const cube = n === 4 && rand() < 0.5;
      const spec = cut
        ? (cube ? { kind: 'cube', a: 4, cut: 1 } : { kind: 'prism', n, a: 3, h: 3.6, cut: 0.7 })
        : (cube ? { kind: 'cube', a: 4, roof: 2, bare: true } : { kind: 'prism', n, a: 3, h: 3, roof: 2, bare: true });
      const b = buildBody(spec);
      const count = b[what[1]].length;
      const pyr = word.replace(/ой$/, 'ую');
      let question;
      if (cut) {
        question = cube
          ? `От деревянного кубика отпилили все его вершины (см. рис.). Сколько ${what[0]} у получившегося многогранника?`
          : `От деревянной правильной ${word} призмы отпилили все её вершины (см. рис.). Сколько ${what[0]} у получившегося многогранника?`;
      } else {
        question = cube
          ? `К кубу приклеили правильную четырёхугольную пирамиду так, что квадратные грани совпали (см. рис.). Сколько ${what[0]} у получившегося многогранника?`
          : `К правильной ${word} призме приклеили правильную ${pyr} пирамиду так, что основания совпали (см. рис.). Сколько ${what[0]} у получившегося многогранника?`;
      }
      return {
        spec, labels: [], skipShape: true, question,
        answer: count,
        solution: [cut
          ? `Каждая вершина заменяется гранью-многоугольником; считайте по рисунку: ${what[0]} — $${count}$.`
          : `Верхнее основание исчезает, вместо него — боковые грани пирамиды и её вершина; ${what[0]} — $${count}$.`],
      };
    },
  },
  b11_pyramidCopy: {
    group: 'Многогранники', label: 'Музейная копия пирамиды Хеопса, Хефрена, Снофру → высота копии',
    facet: 'Подобные тела',
    gen: (rand) => {
      const [nm, A, H] = pick(rand, [['Хеопса', 230, 147], ['Хефрена', 210, 136], ['Снофру', 220, 104]]);
      const k = pick(rand, [2, 4, 5, 10]);
      return {
        spec: { kind: 'pyramid', n: 4, a: A / 50, h: H / 50, apex: 'S' }, labels: [], skipShape: true,
        question: `Пирамида ${nm} имеет форму правильной четырёхугольной пирамиды, сторона основания которой равна $${A}$ м, а высота — $${H}$ м. Сторона основания точной музейной копии этой пирамиды равна $${numTex(A / k)}$ см. Найдите высоту музейной копии. Ответ дайте в сантиметрах.`,
        answer: H / k,
        solution: [`Копия подобна пирамиде: сторона $${A}$ м $= ${A * 100}$ см уменьшена в $${100 * k}$ раз, высота тоже: $\\dfrac{${H * 100}}{${100 * k}} = ${numTex(H / k)}$ см.`],
      };
    },
  },
};

// ─── Профиль №3 ─────────────────────────────────────────────────────────────

const P3 = {
  p3_cube: {
    group: 'Куб', label: 'Куб: объём, площадь поверхности, диагональ одно через другое',
    facet: 'Куб',
    gen: (rand) => {
      const v = pickInt(rand, 0, 4);
      const a = pickInt(rand, 1, 6);
      if (v === 0) return { spec: { kind: 'cube', a }, labels: [], question: `Площадь поверхности куба равна $${6 * a * a}$. Найдите его объём.`, answer: a ** 3, solution: [`$6a^2 = ${6 * a * a}$, $a = ${a}$, $V = ${a ** 3}$.`] };
      if (v === 1) return { spec: { kind: 'cube', a }, labels: [], question: `Объём куба равен $${a ** 3}$. Найдите площадь его поверхности.`, answer: 6 * a * a, solution: [`$a = \\sqrt[3]{${a ** 3}} = ${a}$, $S = 6a^2 = ${6 * a * a}$.`] };
      if (v === 2) {
        const d = G.root(3 * a * a);
        return { spec: { kind: 'cube', a }, labels: [{ ref: ['A', 'C1'], g: d }], question: `Диагональ куба равна $${d.tex}$. Найдите его объём.`, answer: a ** 3, solution: [`$d = a\\sqrt3$, $a = ${a}$, $V = ${a ** 3}$.`] };
      }
      if (v === 3) {
        const k = pickInt(rand, 1, 4);
        return {
          spec: { kind: 'cube', a: k * Math.sqrt(3) }, labels: [], ask: ['A', 'C1'],
          question: `Площадь поверхности куба равна $${18 * k * k}$. Найдите его диагональ.`,
          answer: 3 * k, solution: [`$6a^2 = ${18 * k * k}$, $a^2 = ${3 * k * k}$; $d = a\\sqrt3 = \\sqrt{${3 * k * k}\\cdot 3} = ${3 * k}$.`],
        };
      }
      const N = 3 * a * a + 3 * a + 1;
      return {
        spec: { kind: 'cube', a }, labels: [], ask: ['A', 'B'],
        question: `Если каждое ребро куба увеличить на $1$, то его объём увеличится на $${N}$. Найдите ребро куба.`,
        answer: a, solution: [`$(a + 1)^3 - a^3 = 3a^2 + 3a + 1 = ${N}$, $a^2 + a - ${(N - 1) / 3} = 0$, $a = ${a}$.`],
      };
    },
  },
  p3_boxDistance: {
    group: 'Прямоугольный параллелепипед', label: 'Квадрат расстояния между вершинами',
    facet: 'Прямоугольный параллелепипед',
    gen: (rand) => {
      const [a, b, c] = [pickInt(rand, 1, 7), pickInt(rand, 1, 7), pickInt(rand, 1, 7)];
      const [P, Q, d2] = pick(rand, [['C', 'A1', a * a + b * b + c * c], ['A', 'D1', b * b + c * c], ['B', 'D1', a * a + b * b + c * c], ['A', 'C1', a * a + b * b + c * c], ['A', 'C', a * a + b * b]]);
      const tx = (n) => n.replace('1', '_1');
      return {
        spec: { kind: 'box', a, b, c }, ask: [P, Q],
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'D'], g: G.int(b) }, { ref: ['A', 'A1'], g: G.int(c) }],
        question: `Найдите квадрат расстояния между вершинами $${tx(P)}$ и $${tx(Q)}$ прямоугольного параллелепипеда, для которого $AB = ${a}$, $AD = ${b}$, $AA_1 = ${c}$.`,
        answer: d2, solution: [`Расстояние — диагональ параллелепипеда или грани: квадрат равен сумме квадратов соответствующих рёбер, $${d2}$.`],
      };
    },
  },
  p3_boxEdge: {
    group: 'Прямоугольный параллелепипед', label: 'Диагональ и два ребра → третье ребро или объём',
    facet: 'Прямоугольный параллелепипед',
    gen: (rand) => {
      const q = pick(rand, QUADS);
      const [a, b, c] = [q[0], q[1], q[2]].sort(() => rand() - 0.5);
      const vol = rand() < 0.5;
      return {
        spec: { kind: 'box', a, b, c }, ask: vol ? null : ['A', 'A1'],
        labels: [{ ref: ['C', 'D'], g: G.int(a) }, { ref: ['A', 'D'], g: G.int(b) }, { ref: ['B', 'D1'], g: G.int(q[3]) }],
        question: vol
          ? `Два ребра прямоугольного параллелепипеда, выходящие из одной вершины, равны $${a}$ и $${b}$. Диагональ параллелепипеда равна $${q[3]}$. Найдите объём параллелепипеда.`
          : `В прямоугольном параллелепипеде $${BOX}$ известно, что $BD_1 = ${q[3]}$, $CD = ${a}$, $AD = ${b}$. Найдите длину ребра $AA_1$.`,
        answer: vol ? a * b * c : c,
        solution: [`$AA_1^2 = BD_1^2 - CD^2 - AD^2 = ${q[3] ** 2} - ${a * a} - ${b * b} = ${c * c}$, $AA_1 = ${c}$.`, ...(vol ? [`$V = ${a}\\cdot ${b}\\cdot ${c} = ${a * b * c}$.`] : [])],
      };
    },
  },
  p3_equalCube: {
    group: 'Прямоугольный параллелепипед', label: 'Ребро равновеликого куба',
    facet: 'Прямоугольный параллелепипед',
    gen: (rand) => {
      const k = pickInt(rand, 2, 8);
      const V = k ** 3;
      const opts = [];
      for (let a = 1; a <= 20; a += 1) for (let b = a; b <= 24; b += 1) {
        if (V % (a * b)) continue;
        const c = V / (a * b);
        if (c >= b && c <= 40 && !(a === k && b === k)) opts.push([a, b, c]);
      }
      if (!opts.length) return null;
      const [a, b, c] = pick(rand, opts);
      if (Math.max(a, b, c) / Math.min(a, b, c) > 8) return null;
      return {
        spec: { kind: 'box', a: c, b, c: a }, labels: [], skipShape: true,
        question: `Три ребра прямоугольного параллелепипеда, выходящие из одной вершины, равны $${a}$, $${b}$, $${c}$. Найдите ребро равновеликого ему куба.`,
        answer: k, solution: [`Объёмы равны: $a^3 = ${a}\\cdot ${b}\\cdot ${c} = ${V}$, $a = ${k}$.`],
      };
    },
  },
  p3_boxPart: {
    group: 'Прямоугольный параллелепипед', label: 'Объём многогранника из вершин параллелепипеда',
    facet: 'Объём многогранника',
    gen: (rand) => {
      const [a, b, c] = [pickInt(rand, 2, 7), pickInt(rand, 2, 7), pickInt(rand, 2, 8)];
      const wedge = rand() < 0.6;
      return {
        spec: { kind: 'box', a, b, c },
        extra: wedge
          ? [{ id: 's1', type: 'segment', ref: ['A1', 'D'] }, { id: 's2', type: 'segment', ref: ['B1', 'C'] }, { id: 'f', type: 'fill', pts: ['A1', 'B1', 'C', 'D'] }]
          : [['A', 'D1'], ['A', 'C'], ['A', 'B1'], ['D1', 'C'], ['D1', 'B1'], ['C', 'B1']].map((r, i) => ({ id: `s${i}`, type: 'segment', ref: r })),
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'D'], g: G.int(b) }, { ref: ['A', 'A1'], g: G.int(c) }],
        question: wedge
          ? `Найдите объём многогранника, вершинами которого являются точки $A$, $D$, $A_1$, $B$, $C$, $B_1$ прямоугольного параллелепипеда $${BOX}$, у которого $AB = ${a}$, $AD = ${b}$, $AA_1 = ${c}$.`
          : `Найдите объём треугольной пирамиды $AD_1CB_1$, если $${BOX}$ — прямоугольный параллелепипед, у которого $AB = ${a}$, $AD = ${b}$, $AA_1 = ${c}$.`,
        answer: wedge ? (a * b * c) / 2 : (a * b * c) / 3,
        solution: wedge
          ? [`Многогранник — половина параллелепипеда (плоскость $A_1B_1CD$ делит его пополам): $\\dfrac12\\cdot ${a}\\cdot ${b}\\cdot ${c} = ${numTex((a * b * c) / 2)}$.`]
          : [`Из параллелепипеда отрезаны 4 пирамиды по $\\dfrac16 V$: $V - \\dfrac46 V = \\dfrac13\\cdot ${a * b * c} = ${numTex((a * b * c) / 3)}$.`],
      };
    },
  },
  p3_pyramidAC: {
    group: 'Пирамида', label: 'Правильная пирамида: высота и боковое ребро → диагональ основания',
    facet: 'Правильная пирамида',
    gen: (rand) => {
      const [half, h, l] = shuffled(rand, pick(rand, TRIPLES.filter((t) => t[2] <= 17)));
      return {
        spec: { kind: 'pyramid', n: 4, a: half * Math.SQRT2, h, apex: 'S' }, extra: [HEIGHT()], ask: ['A', 'C'],
        labels: [{ ref: ['S', 'O'], g: G.int(h) }, { ref: ['S', 'C'], g: G.int(l) }],
        question: `В правильной четырёхугольной пирамиде $SABCD$ точка $O$ — центр основания, $S$ — вершина, $SO = ${h}$, $SC = ${l}$. Найдите длину отрезка $AC$.`,
        answer: 2 * half, solution: [`$OC = \\sqrt{${l * l} - ${h * h}} = ${half}$, $AC = 2\\cdot OC = ${2 * half}$.`],
      };
    },
  },
  p3_pyramidVolume: {
    group: 'Пирамида', label: 'Объём правильной пирамиды по высоте и боковому ребру',
    facet: 'Объём пирамиды',
    gen: (rand) => {
      const [half, h, l] = shuffled(rand, pick(rand, TRIPLES.filter((t) => t[2] <= 17)));
      // половина диагонали квадрата = half → сторона² = 2·half²
      const V = (2 * half * half * h) / 3;
      if (!finiteDecimal(V)) return null;
      return {
        spec: { kind: 'pyramid', n: 4, a: half * Math.SQRT2, h, apex: 'S' }, extra: [HEIGHT()],
        labels: [{ ref: ['S', 'O'], g: G.int(h) }, { ref: ['S', 'C'], g: G.int(l) }],
        question: `В правильной четырёхугольной пирамиде высота равна $${h}$, боковое ребро равно $${l}$. Найдите её объём.`,
        answer: V,
        solution: [`Половина диагонали основания $\\sqrt{${l * l} - ${h * h}} = ${half}$, диагональ $${2 * half}$, площадь квадрата $\\dfrac{d^2}{2} = ${2 * half * half}$.`, `$V = \\dfrac13\\cdot ${2 * half * half}\\cdot ${h} = ${numTex(V)}$.`],
      };
    },
  },
  p3_hexPart: {
    group: 'Пирамида', label: 'Шестиугольная пирамида и её часть SABC',
    facet: 'Объём пирамиды',
    gen: (rand) => {
      const v = pickInt(rand, 1, 40);
      const whole = rand() < 0.5;
      return {
        spec: { kind: 'pyramid', n: 6, a: 2.4, h: 4, apex: 'S' }, labels: [], skipShape: true,
        extra: [{ id: 'ac', type: 'segment', ref: ['A', 'C'] }, { id: 'f', type: 'fill', pts: ['A', 'B', 'C'] }],
        question: whole
          ? `Найдите объём правильной шестиугольной пирамиды $SABCDEF$, если объём треугольной пирамиды $SABC$ равен $${v}$.`
          : `Объём правильной шестиугольной пирамиды $SABCDEF$ равен $${6 * v}$. Найдите объём треугольной пирамиды $SABC$.`,
        answer: whole ? 6 * v : v,
        solution: ['Высота у пирамид общая, площадь треугольника $ABC$ — шестая часть площади шестиугольника ($ABC$ равновелик одному из шести правильных треугольников).', `Ответ: $${whole ? 6 * v : v}$.`],
      };
    },
  },
  p3_twoPyramids: {
    group: 'Пирамида', label: 'Две правильные пирамиды: высота и сторона в несколько раз больше → объём',
    facet: 'Объём пирамиды',
    gen: (rand) => {
      const V = pickInt(rand, 2, 30);
      const k = pick(rand, [1.5, 2, 3]);
      const m = pick(rand, [1.5, 2, 3]);
      const ans = V * k * m * m;
      if (!finiteDecimal(ans)) return null;
      return {
        spec: side({ kind: 'pyramid', n: 4, a: 2, h: 2, apex: 'S' }, { kind: 'pyramid', n: 4, a: 2 * m, h: 2 * k, apex: 'S' }), labels: [], skipShape: true,
        question: `Даны две правильные четырёхугольные пирамиды. Объём первой пирамиды равен $${V}$. У второй пирамиды высота ${times(k)} больше, а сторона основания ${times(m)} больше, чем у первой. Найдите объём второй пирамиды.`,
        answer: ans, solution: [`$V = \\dfrac13 a^2 h$: $${V}\\cdot ${numTex(k)}\\cdot ${numTex(m)}^2 = ${numTex(ans)}$.`],
      };
    },
  },
  p3_combo: {
    group: 'Комбинации тел', label: 'Вписанные и описанные тела',
    facet: 'Комбинации тел',
    gen: (rand) => {
      const v = pickInt(rand, 0, 5);
      if (v <= 1) return comboTask(v === 0 ? 'fVolume' : 'fReverse', rand, 1);
      if (v === 2) {
        const r = pickInt(rand, 1, 6);
        return {
          spec: { kind: 'group', parts: [{ kind: 'cube', a: 2 * r, frame: true, at: [0, 0, 0] }, { kind: 'sphere', r, at: [0, 0, 0] }] },
          labels: [{ ref: ['O', 'A2'], g: G.int(r) }], skipShape: true,
          question: `Куб описан около сферы радиуса $${r}$. Найдите объём куба.`,
          answer: 8 * r ** 3, solution: [`Ребро куба равно диаметру сферы: $${2 * r}$, $V = ${2 * r}^3 = ${8 * r ** 3}$.`],
        };
      }
      if (v === 3) {
        const k = pickInt(rand, 1, 4);
        return {
          spec: { kind: 'group', parts: [{ kind: 'sphere', r: k * Math.sqrt(3), frame: true, at: [0, 0, 0] }, { kind: 'cube', a: 2 * k, at: [0, 0, 0] }] },
          labels: [], skipShape: true,
          question: `Куб вписан в шар радиуса $${G.surd(k, 3).tex}$. Найдите объём куба.`,
          answer: 8 * k ** 3, solution: [`Диагональ куба — диаметр шара: $a\\sqrt3 = ${2 * k}\\sqrt3$, $a = ${2 * k}$, $V = ${8 * k ** 3}$.`],
        };
      }
      if (v === 4) {
        const r = pickInt(rand, 1, 6);
        return {
          spec: { kind: 'group', parts: [{ kind: 'cube', a: 2 * r, frame: true, at: [0, 0, 0] }, { kind: 'sphere', r, at: [0, 0, 0] }] },
          labels: [], skipShape: true, ask: null,
          question: `Объём куба, описанного около сферы, равен $${8 * r ** 3}$. Найдите радиус сферы.`,
          answer: r, solution: [`Ребро куба $\\sqrt[3]{${8 * r ** 3}} = ${2 * r}$ — диаметр сферы, радиус $${r}$.`],
        };
      }
      const Vb = 4 * pickInt(rand, 1, 30);
      return {
        spec: { kind: 'group', parts: [{ kind: 'sphere', r: 2, frame: true, at: [0, 0, 0] }, { kind: 'cone', r: 2, h: 2, at: [0, 0, 1] }] },
        labels: [], skipShape: true,
        question: `Конус вписан в шар. Радиус основания конуса равен радиусу шара. Объём шара равен $${Vb}$. Найдите объём конуса.`,
        answer: Vb / 4,
        solution: ['Основание конуса — большой круг шара, высота конуса — радиус $R$.', `$V_{\\text{к}} = \\dfrac13\\pi R^2\\cdot R = \\dfrac14\\cdot\\dfrac43\\pi R^3 = \\dfrac14 V_{\\text{ш}} = ${numTex(Vb / 4)}$.`],
      };
    },
  },
  p3_cylinder: {
    group: 'Цилиндр', label: 'Цилиндр: боковая поверхность, длина окружности, осевое сечение',
    facet: 'Цилиндр',
    gen: (rand) => {
      const v = pickInt(rand, 0, 2);
      if (v === 0) {
        const [C, h] = [pickInt(rand, 2, 12), pickInt(rand, 2, 10)];
        return {
          spec: { kind: 'cylinder', r: 2, h: 3.5 }, labels: [], skipShape: true,
          question: `Длина окружности основания цилиндра равна $${C}$, высота равна $${h}$. Найдите площадь боковой поверхности цилиндра.`,
          answer: C * h, solution: ['Развёртка боковой поверхности — прямоугольник: длина окружности на высоту.', `$S = ${C}\\cdot ${h} = ${C * h}$.`],
        };
      }
      if (v === 1) {
        const S = pickInt(rand, 2, 40);
        return {
          spec: { kind: 'cylinder', r: 2, h: 3.5 }, labels: [], skipShape: true,
          question: `Площадь осевого сечения цилиндра равна $${S}$. Найдите площадь боковой поверхности цилиндра. ${BYPI('S')}`,
          answer: S, solution: [`Осевое сечение $2r\\cdot h = ${S}$, $S_{\\text{бок}} = 2\\pi r h = ${S}\\pi$.`],
        };
      }
      const [r, h] = [pickInt(rand, 1, 6), pickInt(rand, 1, 9)];
      return {
        spec: { kind: 'cylinder', r, h }, labels: [{ ref: ['O', 'A'], g: G.int(r) }, { ref: ['A', 'A1'], g: G.int(h) }],
        question: `Радиус основания цилиндра равен $${r}$, высота равна $${h}$. Найдите площадь боковой поверхности цилиндра, делённую на $\\pi$.`,
        answer: 2 * r * h, solution: [`$S_{\\text{бок}} = 2\\pi r h = ${2 * r * h}\\pi$.`],
      };
    },
  },
  p3_cone: {
    group: 'Конус', label: 'Конус: осевое сечение, образующая, диаметр, во сколько раз',
    facet: 'Конус',
    gen: (rand) => {
      const [r, h, l] = shuffled(rand, pick(rand, TRIPLES.filter((t) => t[2] <= 17)));
      const v = pickInt(rand, 0, 3);
      if (v === 0) {
        return {
          spec: { kind: 'cone', r, h }, labels: [{ ref: ['O', 'A'], g: G.int(r) }, { ref: ['S', 'A'], g: G.int(l) }],
          question: `Найдите площадь осевого сечения конуса, радиус основания которого равен $${r}$, а образующая равна $${l}$.`,
          answer: r * h, solution: [`Высота $\\sqrt{${l * l} - ${r * r}} = ${h}$; осевое сечение — треугольник с основанием $${2 * r}$ и высотой $${h}$: $S = ${r * h}$.`],
        };
      }
      if (v === 1) {
        return {
          spec: { kind: 'cone', r, h }, ask: null, labels: [{ ref: ['S', 'O'], g: G.int(h) }, { ref: ['S', 'A'], g: G.int(l) }],
          question: `Высота конуса равна $${h}$, а длина образующей — $${l}$. Найдите диаметр основания конуса.`,
          answer: 2 * r, solution: [`$r = \\sqrt{${l * l} - ${h * h}} = ${r}$, диаметр $${2 * r}$.`],
        };
      }
      if (v === 2) {
        return {
          spec: { kind: 'cone', r, h }, ask: ['S', 'A'], labels: [{ ref: ['S', 'O'], g: G.int(h) }],
          question: `Высота конуса равна $${h}$, а диаметр основания — $${2 * r}$. Найдите образующую конуса.`,
          answer: l, solution: [`$l = \\sqrt{${h * h} + ${r * r}} = ${l}$.`],
        };
      }
      const k = pick(rand, [1.5, 2, 3]);
      return {
        spec: { kind: 'cone', r: 2, h: 3 }, labels: [], skipShape: true,
        question: `Во сколько раз увеличится объём конуса, если радиус его основания увеличится ${times(k)}, а высота останется прежней?`,
        answer: k * k, solution: [`$V = \\dfrac13\\pi r^2 h$ — объём пропорционален квадрату радиуса: $${numTex(k)}^2 = ${numTex(k * k)}$.`],
      };
    },
  },
  p3_sphere: {
    group: 'Шар', label: 'Шар: большой круг, отношения объёмов и площадей, сумма шаров',
    facet: 'Шар',
    gen: (rand) => {
      const v = pickInt(rand, 0, 3);
      if (v === 0) {
        const k = pickInt(rand, 2, 5);
        return {
          spec: side({ kind: 'sphere', r: 2 }, { kind: 'sphere', r: 2 / k }), labels: [], skipShape: true,
          question: `Объём первого шара в $${k ** 3}$ раз${(k ** 3) % 10 >= 2 && (k ** 3) % 10 <= 4 && !((k ** 3) % 100 >= 12 && (k ** 3) % 100 <= 14) ? 'а' : ''} больше объёма второго. Во сколько раз площадь поверхности первого шара больше площади поверхности второго?`,
          answer: k * k, solution: [`Радиусы относятся как $\\sqrt[3]{${k ** 3}} = ${k}$, площади — как $${k}^2 = ${k * k}$.`],
        };
      }
      if (v === 1) {
        const S = pickInt(rand, 2, 40);
        return {
          spec: { kind: 'sphere', r: 2 }, labels: [], skipShape: true,
          question: `Площадь большого круга шара равна $${S}$. Найдите площадь поверхности шара.`,
          answer: 4 * S, solution: [`$S_{\\text{кр}} = \\pi R^2$, поверхность шара $4\\pi R^2 = 4\\cdot ${S} = ${4 * S}$.`],
        };
      }
      if (v === 2) {
        const [a, b, c] = pick(rand, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17]]);
        return {
          spec: side({ kind: 'sphere', r: a / 2 }, { kind: 'sphere', r: b / 2 }), labels: [], skipShape: true,
          question: `Радиусы двух шаров равны $${a}$ и $${b}$. Найдите радиус шара, площадь поверхности которого равна сумме площадей поверхностей двух данных шаров.`,
          answer: c, solution: [`$4\\pi R^2 = 4\\pi(${a}^2 + ${b}^2)$, $R = \\sqrt{${a * a + b * b}} = ${c}$.`],
        };
      }
      const [a, b, c, d] = pick(rand, [[3, 4, 5, 6], [6, 8, 10, 12], [1, 6, 8, 9], [9, 12, 15, 18]]);
      return {
        spec: side(side({ kind: 'sphere', r: a / 3 }, { kind: 'sphere', r: b / 3 }), { kind: 'sphere', r: c / 3 }), labels: [], skipShape: true,
        question: `Радиусы трёх шаров равны $${a}$, $${b}$ и $${c}$. Найдите радиус шара, объём которого равен сумме их объёмов.`,
        answer: d, solution: [`$R^3 = ${a}^3 + ${b}^3 + ${c}^3 = ${a ** 3 + b ** 3 + c ** 3}$, $R = ${d}$.`],
      };
    },
  },
  p3_stepsElements: {
    group: 'Составные многогранники', label: 'Элементы составного многогранника: (квадрат) расстояния между вершинами',
    facet: 'Многогранник',
    gen: (rand) => stepsTask('fLength', rand, DEFAULT_CAMERA),
  },
  p3_stepsVolume: {
    group: 'Составные многогранники', label: 'Составной многогранник → объём или площадь поверхности',
    facet: 'Многогранник',
    gen: (rand) => stepsTask(rand() < 0.5 ? 'fVolume' : 'fSurface', rand, DEFAULT_CAMERA),
  },
};

export const EXAM_SECTIONS = [
  { key: 'b11', title: 'База №11 — прикладная стереометрия', short: 'Б11', types: B11 },
  { key: 'b13', title: 'База №13 — задачи по стереометрии', short: 'Б13', types: B13 },
  { key: 'p3', title: 'Профиль №3 — стереометрия', short: 'П3', types: P3 },
];

/** Все экзаменационные типы: ключ → { exam, short, group, label, facet, gen }. */
export const EXAM_TYPES = Object.fromEntries(EXAM_SECTIONS.flatMap((sec) => Object.entries(sec.types)
  .map(([k, t]) => [k, { ...t, exam: sec.key, short: sec.short }])));

/**
 * Сгенерировать задачу экзаменационного типа.
 * @returns {object|null} поля как у остальных заданий генератора (family: 'exam')
 */
export function generateExamTask({ type, seed = 1, attempts = 80 } = {}) {
  const def = EXAM_TYPES[type];
  if (!def) return null;
  const rand = rng(seed);
  for (let i = 0; i < attempts; i += 1) {
    const plan = def.gen(rand);
    if (!plan) continue;
    const answer = finiteDecimal(plan.answer);
    if (answer == null) continue;
    const task = buildFormulaTask(
      { key: type, def: { facet: def.facet, short: def.short }, ...plan },
      { type, typeDef: { hint: '', tag: `${def.short} · ${def.group}`, facets: [] }, level: 1, seed, answer },
    );
    if (task) return { ...task, family: 'exam', body: type, examLabel: def.label };
  }
  return null;
}

/** Задание → запись банка geometry_tasks (origin = 'gen'). */
export function examTaskToRecord(task, { code } = {}) {
  const def = EXAM_TYPES[task.type];
  const solution = [
    task.solutionText,
    '',
    stereoBlockMarkdown(task.solutionScene, DEFAULT_CAMERA, { color: true }).trim(),
    '',
    `**Ответ:** ${task.answer}`,
  ].join('\n');
  return {
    code: code || `${def.short}-${task.seed}`,
    title: `${def.short}. ${def.group}: ${def.label}`.slice(0, 200),
    statement_md: task.statement,
    answer: task.answer,
    solution_md: solution,
    hints: [],
    drawing_view: 'svg',
    drawing_svg: stereoDrawingSvg(task.scene, DEFAULT_CAMERA),
    section: 'stereo',
    origin: 'gen',
    source: 'Генератор задач по стереометрии',
    difficulty: def.exam === 'p3' ? 2 : 1,
    task_type: '',
  };
}
