// Задачи первой части ЕГЭ по стереометрии (база №13, профиль №3): объём,
// площадь поверхности, длины (диагональ, боковое ребро, высота), «во сколько
// раз», ребро по объёму. Ответ — конечная десятичная дробь, как в бланке.
//
// Чертёж — то же тело движка с подписями длин (шаг lengthMark), как на
// рисунках банка. 🚨 Каждая подпись сверяется с чертежом: длина, написанная
// у ребра, обязана совпасть с длиной этого ребра в модели, иначе задание
// отбраковывается — так тело на картинке не разойдётся с условием.

import { buildBody } from './bodies';
import { evaluateScene } from './scene';
import { dist } from './vec3';
import { stereoBlockMarkdown, stereoDrawingSvg } from './dsl';
import { DEFAULT_CAMERA } from './camera';
import { rng } from './sectionTasks';
import {
  GEN_BODIES, bodyNamesTex, texName, genBodyDef,
} from './genBodies';
import { stepsTask } from './stepsTasks';
import { revTask } from './revTasks';

export const FORMULA_TYPES = {
  fVolume: {
    label: 'Объём многогранника', short: 'Объём', tag: 'объём', prefix: 'FV',
    facets: ['Объём многогранника'],
    hint: 'Объём призмы $V = S_{\\text{осн}}\\cdot h$, пирамиды $V = \\dfrac13 S_{\\text{осн}}\\cdot h$.',
  },
  fSurface: {
    label: 'Площадь поверхности', short: 'Площадь поверхности', tag: 'площадь', prefix: 'FS',
    facets: ['Площадь поверхности многогранника'],
    hint: 'Площадь поверхности — сумма площадей всех граней; боковая — без оснований.',
  },
  fLength: {
    label: 'Диагональ, ребро, высота', short: 'Длины', tag: 'длина', prefix: 'FL',
    facets: ['Теорема Пифагора'],
    hint: 'Найдите прямоугольный треугольник с искомым отрезком и примените теорему Пифагора; диагональ параллелепипеда $d^2 = a^2 + b^2 + c^2$.',
  },
  fScale: {
    label: 'Во сколько раз изменится', short: 'Во сколько раз', tag: 'подобие', prefix: 'FK',
    facets: ['Подобные тела'],
    hint: 'Если все линейные размеры увеличить в $k$ раз, площади увеличатся в $k^2$ раз, а объёмы — в $k^3$ раз.',
  },
  fReverse: {
    label: 'Ребро или высота по объёму', short: 'Ребро по объёму', tag: 'обратная', prefix: 'FR',
    facets: ['Объём многогранника'],
    hint: 'Запишите формулу объёма (площади) и выразите из неё неизвестное.',
  },
};

export const FORMULA_LEVELS = {
  1: 'Простое — всё дано, одна формула',
  2: 'Среднее — сначала найти высоту, апофему или ребро',
  3: 'Сложное — обратная задача или несколько изменений',
};

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const pickInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

// ─── числа ────────────────────────────────────────────────────────────────

/** Конечная десятичная дробь с точностью до 1e-9, не длиннее 3 знаков. */
function finiteDecimal(x) {
  if (!Number.isFinite(x) || x <= 0 || x > 1e6) return null;
  const r = Math.round(x * 1000) / 1000;
  if (Math.abs(r - x) > 1e-9 * Math.max(1, x)) return null;
  return r;
}

/** Число → текст «4,5» и LaTeX «4{,}5». */
const numText = (x) => String(Math.round(x * 1000) / 1000).replace('.', ',');
const numTex = (x) => numText(x).replace(',', '{,}');

/** Данное: значение, LaTeX и подпись на чертеже. */
const G = {
  int: (n) => ({ v: n, tex: numTex(n), label: numText(n) }),
  surd: (k, m) => ({
    v: k * Math.sqrt(m),
    tex: `${k === 1 ? '' : numTex(k)}\\sqrt{${m}}`,
    label: `${k === 1 ? '' : numText(k)}√${m}`,
  }),
};

// Пифагоровы тройки и четвёрки: a² + b² = c², a² + b² + c² = d².
const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17], [12, 16, 20], [7, 24, 25], [15, 20, 25], [20, 21, 29]];
const QUADS = [
  [1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [4, 4, 7, 9], [2, 6, 9, 11], [6, 6, 7, 11], [3, 4, 12, 13],
  [2, 10, 11, 15], [8, 9, 12, 17], [2, 5, 14, 15], [4, 8, 8, 12], [3, 6, 6, 9], [2, 4, 4, 6], [6, 10, 15, 19],
];
const shuffleTriple = (rand, t) => (rand() < 0.5 ? t : [t[1], t[0], t[2]]);

// ─── сборка задания ──────────────────────────────────────────────────────

const BODY_WORD = {
  cube: { nom: 'куб', gen: 'куба', prep: 'кубе' },
  box: { nom: 'прямоугольный параллелепипед', gen: 'параллелепипеда', prep: 'прямоугольном параллелепипеде' },
  prism3: { nom: 'правильная треугольная призма', gen: 'призмы', prep: 'правильной треугольной призме' },
  prism4: { nom: 'правильная четырёхугольная призма', gen: 'призмы', prep: 'правильной четырёхугольной призме' },
  prism6: { nom: 'правильная шестиугольная призма', gen: 'призмы', prep: 'правильной шестиугольной призме' },
  tetra: { nom: 'правильный тетраэдр', gen: 'тетраэдра', prep: 'правильном тетраэдре' },
  pyramid3: { nom: 'правильная треугольная пирамида', gen: 'пирамиды', prep: 'правильной треугольной пирамиде' },
  pyramid4: { nom: 'правильная четырёхугольная пирамида', gen: 'пирамиды', prep: 'правильной четырёхугольной пирамиде' },
  pyramid6: { nom: 'правильная шестиугольная пирамида', gen: 'пирамиды', prep: 'правильной шестиугольной пирамиде' },
};

/**
 * Описание задания от генератора типа:
 *   spec — тело движка; labels — [{ ref: [A,B], g }] подписи данных длин;
 *   extra — шаги чертежа (высота, середина); ask — [A,B] искомый отрезок;
 *   question, answer (число), solution — строки решения.
 */
function make(key, plan) {
  return { key, def: genBodyDef(key), ...plan };
}

const T = (a, b) => `${texName(a)}${texName(b)}`;

// Высота пирамиды SO и центр O основания — шаг движка.
const HEIGHT_OPS = [{ id: 'h', type: 'perp', from: 'S', plane: ['A', 'B', 'C'], name: 'O' }];

// ─── по типам ─────────────────────────────────────────────────────────────

function volumeTask(key, rand, level) {
  const nm = (k) => bodyNamesTex(k, buildBody(GEN_BODIES[k].draw).order);
  switch (key) {
    case 'cube': {
      if (level === 1) {
        const a = pickInt(rand, 2, 9);
        return {
          spec: { kind: 'cube', a }, labels: [{ ref: ['A', 'B'], g: G.int(a) }],
          question: `Ребро куба $${nm(key)}$ равно $${a}$. Найдите объём куба.`,
          answer: a ** 3, solution: [`$V = a^3 = ${a}^3 = ${a ** 3}$.`],
        };
      }
      const a = pickInt(rand, 2, 7);
      if (level === 2 || rand() < 0.5) {
        return {
          spec: { kind: 'cube', a }, labels: [{ ref: ['A', 'C1'], g: G.surd(a, 3) }], ask: null,
          question: `Диагональ куба $${nm(key)}$ равна $${G.surd(a, 3).tex}$. Найдите объём куба.`,
          answer: a ** 3,
          solution: [`Диагональ куба с ребром $a$ равна $a\\sqrt3$, значит $a = ${a}$.`, `$V = a^3 = ${a ** 3}$.`],
        };
      }
      return {
        spec: { kind: 'cube', a }, labels: [],
        question: `Площадь поверхности куба $${nm(key)}$ равна $${6 * a * a}$. Найдите его объём.`,
        answer: a ** 3,
        solution: [`$S = 6a^2 = ${6 * a * a}$, откуда $a^2 = ${a * a}$, $a = ${a}$.`, `$V = a^3 = ${a ** 3}$.`],
      };
    }
    case 'box': {
      if (level === 1) {
        const [a, b, c] = [pickInt(rand, 2, 9), pickInt(rand, 2, 9), pickInt(rand, 2, 9)];
        return {
          spec: { kind: 'box', a, b, c },
          labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'D'], g: G.int(b) }, { ref: ['A', 'A1'], g: G.int(c) }],
          question: `Измерения прямоугольного параллелепипеда $${nm(key)}$ равны $AB = ${a}$, $AD = ${b}$, $AA_1 = ${c}$. Найдите его объём.`,
          answer: a * b * c, solution: [`$V = AB\\cdot AD\\cdot AA_1 = ${a}\\cdot ${b}\\cdot ${c} = ${a * b * c}$.`],
        };
      }
      const q = pick(rand, QUADS);
      const [a, b, c] = [q[0], q[1], q[2]].sort(() => rand() - 0.5);
      const d = q[3];
      return {
        spec: { kind: 'box', a, b, c },
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'D'], g: G.int(b) }, { ref: ['A', 'C1'], g: G.int(d) }],
        question: `В прямоугольном параллелепипеде $${nm(key)}$ известно, что $AB = ${a}$, $AD = ${b}$, $AC_1 = ${d}$. Найдите объём параллелепипеда.`,
        answer: a * b * c,
        solution: [
          `Квадрат диагонали равен сумме квадратов измерений: $AA_1^2 = AC_1^2 - AB^2 - AD^2 = ${d * d} - ${a * a} - ${b * b} = ${c * c}$, $AA_1 = ${c}$.`,
          `$V = ${a}\\cdot ${b}\\cdot ${c} = ${a * b * c}$.`,
        ],
      };
    }
    case 'prism4': {
      if (level === 1) {
        const a = pickInt(rand, 2, 7);
        const h = pickInt(rand, 2, 10);
        return {
          spec: { kind: 'prism', n: 4, a, h }, labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'A1'], g: G.int(h) }],
          question: `В правильной четырёхугольной призме $${nm(key)}$ сторона основания равна $${a}$, а боковое ребро равно $${h}$. Найдите объём призмы.`,
          answer: a * a * h, solution: [`$V = S_{\\text{осн}}\\cdot h = ${a}^2\\cdot ${h} = ${a * a * h}$.`],
        };
      }
      const q = pick(rand, QUADS.filter((x) => x[0] === x[1] || x[1] === x[2]));
      const a = q[0] === q[1] ? q[0] : q[1];
      const h = q[0] === q[1] ? q[2] : q[0];
      const d = q[3];
      return {
        spec: { kind: 'prism', n: 4, a, h }, labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['B', 'D1'], g: G.int(d) }],
        question: `В правильной четырёхугольной призме $${nm(key)}$ сторона основания равна $${a}$, а диагональ $BD_1 = ${d}$. Найдите объём призмы.`,
        answer: a * a * h,
        solution: [
          `$DD_1^2 = BD_1^2 - BD^2 = BD_1^2 - 2a^2 = ${d * d} - ${2 * a * a} = ${h * h}$, высота $h = ${h}$.`,
          `$V = a^2 h = ${a * a}\\cdot ${h} = ${a * a * h}$.`,
        ],
      };
    }
    case 'prism3':
    case 'prism6': {
      const n = key === 'prism3' ? 3 : 6;
      const a = pickInt(rand, 1, 6);
      const k = pickInt(rand, 1, 4);
      const hG = G.surd(k, 3);
      const S = n === 3 ? `\\dfrac{a^2\\sqrt3}{4}` : `\\dfrac{3a^2\\sqrt3}{2}`;
      const V = n === 3 ? (3 * a * a * k) / 4 : (9 * a * a * k) / 2;
      return {
        spec: { kind: 'prism', n, a, h: hG.v }, labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'A1'], g: hG }],
        question: `В правильной ${n === 3 ? 'треугольной' : 'шестиугольной'} призме $${nm(key)}$ сторона основания равна $${a}$, а боковое ребро равно $${hG.tex}$. Найдите объём призмы.`,
        answer: V,
        solution: [`$S_{\\text{осн}} = ${S}$, $V = S_{\\text{осн}}\\cdot h = ${S.replace('a^2', `${a}^2`)}\\cdot ${hG.tex} = ${numTex(V)}$.`],
      };
    }
    case 'pyramid4': {
      if (level === 1) {
        const a = pickInt(rand, 2, 9);
        const h = pickInt(rand, 2, 9);
        return {
          spec: { kind: 'pyramid', n: 4, a, h, apex: 'S' }, extra: HEIGHT_OPS,
          labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['S', 'O'], g: G.int(h) }],
          question: `В правильной четырёхугольной пирамиде $${nm(key)}$ сторона основания равна $${a}$, а высота $SO = ${h}$. Найдите объём пирамиды.`,
          answer: (a * a * h) / 3, solution: [`$V = \\dfrac13 S_{\\text{осн}}\\cdot SO = \\dfrac13\\cdot ${a}^2\\cdot ${h} = ${numTex((a * a * h) / 3)}$.`],
        };
      }
      const [h, half, l] = shuffleTriple(rand, pick(rand, TRIPLES.filter((t) => t[2] <= 17)));
      const bd = 2 * half;
      const V = (bd * bd * h) / 6;
      return {
        spec: { kind: 'pyramid', n: 4, a: bd / Math.SQRT2, h, apex: 'S' }, extra: [...HEIGHT_OPS, { id: 'bd', type: 'segment', ref: ['B', 'D'] }],
        labels: [{ ref: ['B', 'D'], g: G.int(bd) }, { ref: ['S', 'C'], g: G.int(l) }],
        question: `В правильной четырёхугольной пирамиде $${nm(key)}$ с основанием $ABCD$ диагональ основания $BD = ${bd}$, боковое ребро $SC = ${l}$. Найдите объём пирамиды.`,
        answer: V,
        solution: [
          `Высота $SO$ падает в центр $O$ квадрата, $OC = \\dfrac{BD}{2} = ${half}$; $SO = \\sqrt{SC^2 - OC^2} = \\sqrt{${l * l} - ${half * half}} = ${h}$.`,
          `Площадь квадрата через диагональ: $S = \\dfrac{BD^2}{2} = ${numTex((bd * bd) / 2)}$. $V = \\dfrac13\\cdot ${numTex((bd * bd) / 2)}\\cdot ${h} = ${numTex(V)}$.`,
        ],
      };
    }
    case 'pyramid3':
    case 'pyramid6': {
      const n = key === 'pyramid3' ? 3 : 6;
      const a = pickInt(rand, 1, 6);
      const k = pickInt(rand, 1, 5);
      const hG = G.surd(k, 3);
      const V = n === 3 ? (a * a * k) / 4 : (3 * a * a * k) / 2;
      const S = n === 3 ? `\\dfrac{${a}^2\\sqrt3}{4}` : `\\dfrac{3\\cdot ${a}^2\\sqrt3}{2}`;
      return {
        spec: { kind: 'pyramid', n, a, h: hG.v, apex: 'S' }, extra: HEIGHT_OPS,
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['S', 'O'], g: hG }],
        question: `В правильной ${n === 3 ? 'треугольной' : 'шестиугольной'} пирамиде $${nm(key)}$ сторона основания равна $${a}$, а высота $SO = ${hG.tex}$. Найдите объём пирамиды.`,
        answer: V, solution: [`$V = \\dfrac13 S_{\\text{осн}}\\cdot SO = \\dfrac13\\cdot ${S}\\cdot ${hG.tex} = ${numTex(V)}$.`],
      };
    }
    case 'tetra': {
      const m = pick(rand, [3, 6]);
      const aG = G.surd(m, 2);
      const V = m ** 3 / 3;
      return {
        spec: { kind: 'tetra', a: aG.v, apex: 'D' }, labels: [{ ref: ['A', 'B'], g: aG }],
        question: `Ребро правильного тетраэдра $${nm(key)}$ равно $${aG.tex}$. Найдите его объём.`,
        answer: V, solution: [`Объём правильного тетраэдра $V = \\dfrac{a^3\\sqrt2}{12} = \\dfrac{(${aG.tex})^3\\sqrt2}{12} = ${numTex(V)}$.`],
      };
    }
    default: return null;
  }
}

function surfaceTask(key, rand, level) {
  const nm = (k) => bodyNamesTex(k, buildBody(GEN_BODIES[k].draw).order);
  switch (key) {
    case 'cube': {
      const a = pickInt(rand, 2, 9);
      if (level === 1) {
        return {
          spec: { kind: 'cube', a }, labels: [{ ref: ['A', 'B'], g: G.int(a) }],
          question: `Ребро куба $${nm(key)}$ равно $${a}$. Найдите площадь его поверхности.`,
          answer: 6 * a * a, solution: [`$S = 6a^2 = 6\\cdot ${a}^2 = ${6 * a * a}$.`],
        };
      }
      return {
        spec: { kind: 'cube', a }, labels: [{ ref: ['A', 'C1'], g: G.surd(a, 3) }],
        question: `Диагональ куба $${nm(key)}$ равна $${G.surd(a, 3).tex}$. Найдите площадь поверхности куба.`,
        answer: 6 * a * a, solution: [`Ребро куба $a = \\dfrac{d}{\\sqrt3} = ${a}$, $S = 6a^2 = ${6 * a * a}$.`],
      };
    }
    case 'box': {
      let a; let b; let c; let labels; let question; const pre = [];
      if (level === 1) {
        [a, b, c] = [pickInt(rand, 1, 9), pickInt(rand, 1, 9), pickInt(rand, 1, 9)];
        labels = [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'D'], g: G.int(b) }, { ref: ['A', 'A1'], g: G.int(c) }];
        question = `Измерения прямоугольного параллелепипеда $${nm(key)}$ равны $${a}$, $${b}$ и $${c}$. Найдите площадь его поверхности.`;
      } else {
        const q = pick(rand, QUADS);
        [a, b, c] = [q[0], q[1], q[2]].sort(() => rand() - 0.5);
        labels = [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'D'], g: G.int(b) }, { ref: ['A', 'C1'], g: G.int(q[3]) }];
        question = `В прямоугольном параллелепипеде $${nm(key)}$ известно, что $AB = ${a}$, $AD = ${b}$, $AC_1 = ${q[3]}$. Найдите площадь поверхности параллелепипеда.`;
        pre.push(`$AA_1 = \\sqrt{AC_1^2 - AB^2 - AD^2} = \\sqrt{${q[3] ** 2} - ${a * a} - ${b * b}} = ${c}$.`);
      }
      const S = 2 * (a * b + b * c + a * c);
      return {
        spec: { kind: 'box', a, b, c }, labels, question, answer: S,
        solution: [...pre, `$S = 2(ab + bc + ac) = 2(${a * b} + ${b * c} + ${a * c}) = ${S}$.`],
      };
    }
    case 'prism4': {
      const a = pickInt(rand, 2, 7);
      const h = pickInt(rand, 2, 10);
      const S = 2 * a * a + 4 * a * h;
      return {
        spec: { kind: 'prism', n: 4, a, h }, labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'A1'], g: G.int(h) }],
        question: `В правильной четырёхугольной призме $${nm(key)}$ сторона основания равна $${a}$, а боковое ребро равно $${h}$. Найдите площадь поверхности призмы.`,
        answer: S, solution: [`Два основания-квадрата и четыре боковые грани-прямоугольника: $S = 2a^2 + 4ah = ${2 * a * a} + ${4 * a * h} = ${S}$.`],
      };
    }
    case 'prism3':
    case 'prism6': {
      const n = key === 'prism3' ? 3 : 6;
      const a = pickInt(rand, 1, 8);
      const h = pickInt(rand, 2, 10);
      return {
        spec: { kind: 'prism', n, a, h }, labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'A1'], g: G.int(h) }],
        question: `В правильной ${n === 3 ? 'треугольной' : 'шестиугольной'} призме $${nm(key)}$ сторона основания равна $${a}$, а боковое ребро равно $${h}$. Найдите площадь боковой поверхности призмы.`,
        answer: n * a * h, solution: [`Боковая поверхность — ${n} прямоугольников $${a}\\times ${h}$: $S = ${n}\\cdot ${a}\\cdot ${h} = ${n * a * h}$.`],
      };
    }
    case 'pyramid4': {
      // Апофема SK (K — середина CD): тройка (половина стороны, высота, апофема)
      const [half, h, f] = shuffleTriple(rand, pick(rand, TRIPLES.filter((t) => t[2] <= 17)));
      const a = 2 * half;
      const extra = [...HEIGHT_OPS, { id: 'k', type: 'pointOnLine', name: 'K', ref: ['C', 'D'], t: 0.5, ratio: [1, 1] }, { id: 'sk', type: 'segment', ref: ['S', 'K'] }];
      const S = a * a + 2 * a * f;
      if (level === 1) {
        return {
          spec: { kind: 'pyramid', n: 4, a, h, apex: 'S' }, extra,
          labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['S', 'K'], g: G.int(f) }],
          question: `В правильной четырёхугольной пирамиде $${nm(key)}$ сторона основания равна $${a}$, а апофема $SK = ${f}$ ($K$ — середина $CD$). Найдите площадь поверхности пирамиды.`,
          answer: S, solution: [`$S = a^2 + 4\\cdot\\dfrac12 a\\cdot SK = ${a * a} + 2\\cdot ${a}\\cdot ${f} = ${S}$.`],
        };
      }
      return {
        spec: { kind: 'pyramid', n: 4, a, h, apex: 'S' }, extra,
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['S', 'O'], g: G.int(h) }],
        question: `В правильной четырёхугольной пирамиде $${nm(key)}$ сторона основания равна $${a}$, а высота $SO = ${h}$. Найдите площадь поверхности пирамиды.`,
        answer: S,
        solution: [
          `Апофема $SK$ ($K$ — середина $CD$): $OK = \\dfrac a2 = ${half}$, $SK = \\sqrt{SO^2 + OK^2} = \\sqrt{${h * h} + ${half * half}} = ${f}$.`,
          `$S = a^2 + 2a\\cdot SK = ${a * a} + ${2 * a * f} = ${S}$.`,
        ],
      };
    }
    case 'pyramid3':
    case 'pyramid6': {
      const n = key === 'pyramid3' ? 3 : 6;
      const a = pickInt(rand, 2, 8);
      const f = pickInt(rand, 3, 12);
      const letters = n === 3 ? ['B', 'C'] : ['C', 'D'];
      // У правильной пирамиды апофема длиннее радиуса вписанной окружности основания.
      const r = n === 3 ? a / (2 * Math.sqrt(3)) : (a * Math.sqrt(3)) / 2;
      if (f <= r * 1.15) return null;
      const h = Math.sqrt(f * f - r * r);
      return {
        spec: { kind: 'pyramid', n, a, h, apex: 'S' },
        extra: [...HEIGHT_OPS, { id: 'k', type: 'pointOnLine', name: 'K', ref: letters, t: 0.5, ratio: [1, 1] }, { id: 'sk', type: 'segment', ref: ['S', 'K'] }],
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['S', 'K'], g: G.int(f) }],
        question: `В правильной ${n === 3 ? 'треугольной' : 'шестиугольной'} пирамиде $${nm(key)}$ сторона основания равна $${a}$, а апофема $SK = ${f}$. Найдите площадь боковой поверхности пирамиды.`,
        answer: (n * a * f) / 2, solution: [`Боковая поверхность — ${n} равных треугольников: $S = ${n}\\cdot\\dfrac12\\cdot ${a}\\cdot ${f} = ${numTex((n * a * f) / 2)}$.`],
      };
    }
    case 'tetra': {
      // S = a²√3 всегда с корнем — в ответ идёт S/√3
      const a = pickInt(rand, 2, 9);
      return {
        spec: { kind: 'tetra', a, apex: 'D' }, labels: [{ ref: ['A', 'B'], g: G.int(a) }],
        question: `Ребро правильного тетраэдра $${nm(key)}$ равно $${a}$. Найдите площадь его поверхности. В ответе укажите $\\dfrac{S}{\\sqrt3}$.`,
        answer: a * a, solution: [`Четыре равносторонних треугольника: $S = 4\\cdot\\dfrac{a^2\\sqrt3}{4} = a^2\\sqrt3 = ${a * a}\\sqrt3$, $\\dfrac{S}{\\sqrt3} = ${a * a}$.`],
      };
    }
    default: return null;
  }
}

function lengthTask(key, rand, level) {
  const nm = (k) => bodyNamesTex(k, buildBody(GEN_BODIES[k].draw).order);
  switch (key) {
    case 'cube': {
      const a = pickInt(rand, 2, 9);
      return {
        spec: { kind: 'cube', a }, labels: [{ ref: ['A', 'C1'], g: G.surd(a, 3) }], ask: ['A', 'B'],
        question: `Диагональ куба $${nm(key)}$ равна $${G.surd(a, 3).tex}$. Найдите ребро куба.`,
        answer: a, solution: [`$d^2 = 3a^2$: $3a^2 = ${3 * a * a}$, $a = ${a}$.`],
      };
    }
    case 'box': {
      const q = pick(rand, QUADS);
      const [a, b, c] = [q[0], q[1], q[2]].sort(() => rand() - 0.5);
      return {
        spec: { kind: 'box', a, b, c }, ask: ['A', 'C1'],
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'D'], g: G.int(b) }, { ref: ['A', 'A1'], g: G.int(c) }],
        question: `Измерения прямоугольного параллелепипеда $${nm(key)}$ равны $AB = ${a}$, $AD = ${b}$, $AA_1 = ${c}$. Найдите его диагональ $AC_1$.`,
        answer: q[3], solution: [`$AC_1^2 = AB^2 + AD^2 + AA_1^2 = ${a * a} + ${b * b} + ${c * c} = ${q[3] ** 2}$, $AC_1 = ${q[3]}$.`],
      };
    }
    case 'prism4': {
      const q = pick(rand, QUADS.filter((x) => x[0] === x[1] || x[1] === x[2]));
      const a = q[0] === q[1] ? q[0] : q[1];
      const h = q[0] === q[1] ? q[2] : q[0];
      if (level >= 2) {
        return {
          spec: { kind: 'prism', n: 4, a, h }, ask: ['A', 'A1'],
          labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['B', 'D1'], g: G.int(q[3]) }],
          question: `В правильной четырёхугольной призме $${nm(key)}$ сторона основания равна $${a}$, а диагональ $BD_1 = ${q[3]}$. Найдите боковое ребро призмы.`,
          answer: h, solution: [`$BD^2 = 2a^2 = ${2 * a * a}$; $DD_1 = \\sqrt{BD_1^2 - BD^2} = \\sqrt{${q[3] ** 2} - ${2 * a * a}} = ${h}$.`],
        };
      }
      return {
        spec: { kind: 'prism', n: 4, a, h }, ask: ['B', 'D1'],
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'A1'], g: G.int(h) }],
        question: `В правильной четырёхугольной призме $${nm(key)}$ сторона основания равна $${a}$, а боковое ребро равно $${h}$. Найдите диагональ призмы $BD_1$.`,
        answer: q[3], solution: [`$BD_1^2 = a^2 + a^2 + h^2 = ${a * a} + ${a * a} + ${h * h} = ${q[3] ** 2}$, $BD_1 = ${q[3]}$.`],
      };
    }
    case 'prism3':
    case 'prism6': {
      const n = key === 'prism3' ? 3 : 6;
      const [a, h, d] = shuffleTriple(rand, pick(rand, TRIPLES.filter((t) => t[2] <= 17)));
      return {
        spec: { kind: 'prism', n, a, h }, ask: ['A', 'B1'],
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['B', 'B1'], g: G.int(h) }],
        question: `В правильной ${n === 3 ? 'треугольной' : 'шестиугольной'} призме $${nm(key)}$ сторона основания равна $${a}$, а боковое ребро равно $${h}$. Найдите диагональ боковой грани $AB_1$.`,
        answer: d, solution: [`Боковая грань — прямоугольник: $AB_1 = \\sqrt{AB^2 + BB_1^2} = \\sqrt{${a * a} + ${h * h}} = ${d}$.`],
      };
    }
    case 'pyramid4': {
      const [half, h, l] = shuffleTriple(rand, pick(rand, TRIPLES.filter((t) => t[2] <= 20)));
      const bd = 2 * half;
      const base = { spec: { kind: 'pyramid', n: 4, a: bd / Math.SQRT2, h, apex: 'S' }, extra: [...HEIGHT_OPS, { id: 'bd', type: 'segment', ref: ['B', 'D'] }] };
      if (level === 1) {
        return {
          ...base, ask: ['S', 'C'],
          labels: [{ ref: ['B', 'D'], g: G.int(bd) }, { ref: ['S', 'O'], g: G.int(h) }],
          question: `В правильной четырёхугольной пирамиде $${nm(key)}$ точка $O$ — центр основания, $SO = ${h}$, $BD = ${bd}$. Найдите боковое ребро $SC$.`,
          answer: l, solution: [`$OC = \\dfrac{BD}{2} = ${half}$, треугольник $SOC$ прямоугольный: $SC = \\sqrt{${h * h} + ${half * half}} = ${l}$.`],
        };
      }
      return {
        ...base, ask: ['S', 'O'],
        labels: [{ ref: ['B', 'D'], g: G.int(bd) }, { ref: ['S', 'C'], g: G.int(l) }],
        question: `В правильной четырёхугольной пирамиде $${nm(key)}$ точка $O$ — центр основания, $SC = ${l}$, $BD = ${bd}$. Найдите высоту $SO$.`,
        answer: h, solution: [`$OC = \\dfrac{BD}{2} = ${half}$, $SO = \\sqrt{SC^2 - OC^2} = \\sqrt{${l * l} - ${half * half}} = ${h}$.`],
      };
    }
    case 'pyramid3': {
      // Сторона k√3 → радиус описанной окружности основания k
      const [r, h, l] = shuffleTriple(rand, pick(rand, TRIPLES.filter((t) => t[2] <= 17)));
      const aG = G.surd(r, 3);
      return {
        spec: { kind: 'pyramid', n: 3, a: aG.v, h, apex: 'S' }, extra: HEIGHT_OPS, ask: ['S', 'A'],
        labels: [{ ref: ['A', 'B'], g: aG }, { ref: ['S', 'O'], g: G.int(h) }],
        question: `В правильной треугольной пирамиде $${nm(key)}$ сторона основания равна $${aG.tex}$, а высота $SO = ${h}$. Найдите боковое ребро $SA$.`,
        answer: l, solution: [`$O$ — центр правильного треугольника: $OA = \\dfrac{a}{\\sqrt3} = ${r}$. $SA = \\sqrt{SO^2 + OA^2} = \\sqrt{${h * h} + ${r * r}} = ${l}$.`],
      };
    }
    case 'pyramid6': {
      const [a, h, l] = shuffleTriple(rand, pick(rand, TRIPLES.filter((t) => t[2] <= 17)));
      return {
        spec: { kind: 'pyramid', n: 6, a, h, apex: 'S' }, extra: HEIGHT_OPS, ask: ['S', 'A'],
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['S', 'O'], g: G.int(h) }],
        question: `В правильной шестиугольной пирамиде $${nm(key)}$ сторона основания равна $${a}$, а высота $SO = ${h}$. Найдите боковое ребро $SA$.`,
        answer: l, solution: [`У правильного шестиугольника $OA = a = ${a}$. $SA = \\sqrt{SO^2 + OA^2} = \\sqrt{${h * h} + ${a * a}} = ${l}$.`],
      };
    }
    case 'tetra': {
      // Ребро k√6 → высота 2k
      const k = pickInt(rand, 1, 5);
      const aG = G.surd(k, 6);
      return {
        spec: { kind: 'tetra', a: aG.v, apex: 'D' }, ask: ['D', 'O'],
        extra: [{ id: 'h', type: 'perp', from: 'D', plane: ['A', 'B', 'C'], name: 'O' }],
        labels: [{ ref: ['A', 'B'], g: aG }],
        question: `Ребро правильного тетраэдра $${nm(key)}$ равно $${aG.tex}$. Найдите его высоту $DO$.`,
        answer: 2 * k,
        solution: [
          `$O$ — центр грани $ABC$: $OA = \\dfrac{a}{\\sqrt3} = ${k}\\sqrt2$.`,
          `$DO = \\sqrt{DA^2 - OA^2} = \\sqrt{${6 * k * k} - ${2 * k * k}} = ${2 * k}$.`,
        ],
      };
    }
    default: return null;
  }
}

/** «в 2 раза», «в 5 раз». */
const times = (k) => {
  const n = Math.abs(Math.round(k)) % 100;
  const word = n % 10 >= 2 && n % 10 <= 4 && !(n >= 12 && n <= 14) && Number.isInteger(k) ? 'раза' : 'раз';
  return `в $${numTex(k)}$ ${word}`;
};

function scaleTask(key, rand, level) {
  const w = BODY_WORD[key];
  const its = key.startsWith('pyramid') || key.startsWith('prism') ? 'её' : 'его';
  const k = pickInt(rand, 2, level === 1 ? 3 : 5);
  const spec = GEN_BODIES[key].draw;
  if (level === 3 && key === 'box') {
    const [p, q, r] = [pickInt(rand, 2, 4), pickInt(rand, 2, 5), pickInt(rand, 2, 3)];
    const ans = (p * q) / r;
    return {
      spec, labels: [],
      question: `Одно измерение прямоугольного параллелепипеда увеличили ${times(p)}, второе — ${times(q)}, а третье уменьшили ${times(r)}. Во сколько раз увеличился объём параллелепипеда?`,
      answer: ans, solution: [`$V = abc$, новый объём $\\dfrac{${p}\\cdot ${q}}{${r}}\\,abc$ — объём увеличился ${times(ans)}.`],
    };
  }
  if (level >= 2 && key.startsWith('pyramid')) {
    return {
      spec, labels: [],
      question: `Во сколько раз увеличится объём ${w.gen}, если её высоту увеличить ${times(k)}, а основание оставить прежним?`,
      answer: k, solution: [`$V = \\dfrac13 S h$ — объём пропорционален высоте и увеличится ${times(k)}.`],
    };
  }
  if (level >= 2 && key.startsWith('prism')) {
    return {
      spec, labels: [],
      question: `Во сколько раз увеличится объём ${w.gen}, если сторону её основания увеличить ${times(k)}, а высоту оставить прежней?`,
      answer: k * k, solution: [`Площадь основания увеличится в $${k}^2 = ${k * k}$ раз, высота та же — объём увеличится ${times(k * k)}.`],
    };
  }
  const surface = rand() < 0.4;
  const what = surface ? 'площадь поверхности' : 'объём';
  return {
    spec, labels: [],
    question: `Во сколько раз увеличится ${what} ${w.gen}, если все ${its} рёбра увеличить ${times(k)}?`,
    answer: surface ? k * k : k ** 3,
    solution: [surface
      ? `Подобные тела: площади относятся как квадрат коэффициента подобия — $${k}^2 = ${k * k}$.`
      : `Подобные тела: объёмы относятся как куб коэффициента подобия — $${k}^3 = ${k ** 3}$.`],
  };
}

function reverseTask(key, rand, level) {
  const nm = (k) => bodyNamesTex(k, buildBody(GEN_BODIES[k].draw).order);
  switch (key) {
    case 'cube': {
      const a = pickInt(rand, 2, 9);
      if (level === 1 || rand() < 0.5) {
        return {
          spec: { kind: 'cube', a }, labels: [], ask: ['A', 'B'],
          question: `Объём куба $${nm(key)}$ равен $${a ** 3}$. Найдите его ребро.`,
          answer: a, solution: [`$a^3 = ${a ** 3}$, $a = ${a}$.`],
        };
      }
      return {
        spec: { kind: 'cube', a }, labels: [], ask: ['A', 'B'],
        question: `Площадь поверхности куба $${nm(key)}$ равна $${6 * a * a}$. Найдите его ребро.`,
        answer: a, solution: [`$6a^2 = ${6 * a * a}$, $a^2 = ${a * a}$, $a = ${a}$.`],
      };
    }
    case 'box': {
      const [a, b, c] = [pickInt(rand, 2, 9), pickInt(rand, 2, 9), pickInt(rand, 2, 9)];
      return {
        spec: { kind: 'box', a, b, c }, ask: ['A', 'A1'],
        labels: [{ ref: ['A', 'B'], g: G.int(a) }, { ref: ['A', 'D'], g: G.int(b) }],
        question: `Объём прямоугольного параллелепипеда $${nm(key)}$ равен $${a * b * c}$, $AB = ${a}$, $AD = ${b}$. Найдите ребро $AA_1$.`,
        answer: c, solution: [`$V = AB\\cdot AD\\cdot AA_1$, $AA_1 = \\dfrac{${a * b * c}}{${a}\\cdot ${b}} = ${c}$.`],
      };
    }
    case 'prism4': {
      const a = pickInt(rand, 2, 6);
      const h = pickInt(rand, 2, 10);
      return {
        spec: { kind: 'prism', n: 4, a, h }, ask: ['A', 'A1'], labels: [{ ref: ['A', 'B'], g: G.int(a) }],
        question: `Объём правильной четырёхугольной призмы $${nm(key)}$ равен $${a * a * h}$, сторона основания равна $${a}$. Найдите боковое ребро призмы.`,
        answer: h, solution: [`$V = a^2 h$, $h = \\dfrac{${a * a * h}}{${a * a}} = ${h}$.`],
      };
    }
    case 'pyramid4': {
      const a = pickInt(rand, 2, 9);
      const h = pickInt(rand, 2, 12);
      const V = (a * a * h) / 3;
      if (!finiteDecimal(V)) return null;
      return {
        spec: { kind: 'pyramid', n: 4, a, h, apex: 'S' }, extra: HEIGHT_OPS, ask: ['S', 'O'],
        labels: [{ ref: ['A', 'B'], g: G.int(a) }],
        question: `Объём правильной четырёхугольной пирамиды $${nm(key)}$ равен $${numTex(V)}$, сторона основания равна $${a}$. Найдите высоту пирамиды $SO$.`,
        answer: h, solution: [`$V = \\dfrac13 a^2 h$, $h = \\dfrac{3V}{a^2} = \\dfrac{${numTex(3 * V)}}{${a * a}} = ${h}$.`],
      };
    }
    case 'tetra': {
      const a = pickInt(rand, 2, 9);
      return {
        spec: { kind: 'tetra', a, apex: 'D' }, labels: [], ask: ['A', 'B'],
        question: `Площадь поверхности правильного тетраэдра $${nm(key)}$ равна $${a * a}\\sqrt3$. Найдите его ребро.`,
        answer: a, solution: [`$S = a^2\\sqrt3 = ${a * a}\\sqrt3$, $a^2 = ${a * a}$, $a = ${a}$.`],
      };
    }
    case 'prism3':
    case 'prism6':
    case 'pyramid3':
    case 'pyramid6': {
      // Высота m√3 → объём рациональный; ищем сторону основания.
      const prism = key.startsWith('prism');
      const n = key.endsWith('3') ? 3 : 6;
      const a = pickInt(rand, 2, 8);
      const m = pickInt(rand, 1, 4);
      const hG = G.surd(m, 3);
      // S_осн·√3·m (· 1/3 у пирамиды): треугольник a²√3/4, шестиугольник 3a²√3/2
      const coef = (n === 3 ? 3 / 4 : 9 / 2) * m * (prism ? 1 : 1 / 3);
      const V = coef * a * a;
      if (!finiteDecimal(V)) return null;
      const what = prism ? 'призмы' : 'пирамиды';
      const hWord = prism ? 'боковое ребро равно' : 'высота $SO$ равна';
      const S = n === 3 ? '\\dfrac{a^2\\sqrt3}{4}' : '\\dfrac{3a^2\\sqrt3}{2}';
      return {
        spec: prism ? { kind: 'prism', n, a, h: hG.v } : { kind: 'pyramid', n, a, h: hG.v, apex: 'S' },
        extra: prism ? [] : HEIGHT_OPS, ask: ['A', 'B'],
        labels: [{ ref: prism ? ['A', 'A1'] : ['S', 'O'], g: hG }],
        question: `Объём правильной ${n === 3 ? 'треугольной' : 'шестиугольной'} ${what} $${nm(key)}$ равен $${numTex(V)}$, а ${hWord} $${hG.tex}$. Найдите сторону основания.`,
        answer: a,
        solution: [
          `$V = ${prism ? '' : '\\dfrac13\\cdot '}${S}\\cdot ${hG.tex} = ${numTex(coef)}\\,a^2$.`,
          `$a^2 = \\dfrac{${numTex(V)}}{${numTex(coef)}} = ${a * a}$, $a = ${a}$.`,
        ],
      };
    }
    default: return null;
  }
}

const REV_KEYS = ['cylinder', 'cone', 'sphere'];

const BUILDERS = {
  fVolume: volumeTask, fSurface: surfaceTask, fLength: lengthTask, fScale: scaleTask, fReverse: reverseTask,
};

// ─── генерация ────────────────────────────────────────────────────────────

/**
 * Сгенерировать задачу первой части.
 * @returns {object|null} поля как у остальных заданий генератора
 */
export function generateFormulaTask({
  body: bodyKey = 'cube', type = 'fVolume', level = 1, seed = 1, attempts = 60,
} = {}) {
  const key = genBodyDef(bodyKey) ? bodyKey : 'cube';
  const typeDef = FORMULA_TYPES[type];
  if (!typeDef) return null;
  const rand = rng(seed);
  for (let i = 0; i < attempts; i += 1) {
    const plan = key === 'steps' ? stepsTask(type, rand, DEFAULT_CAMERA)
      : REV_KEYS.includes(key) ? revTask(key, type, rand, level)
        : BUILDERS[type](key, rand, level);
    if (!plan) continue;
    const answer = finiteDecimal(plan.answer);
    if (answer == null) continue;
    const task = buildFormulaTask(make(key, plan), { type, typeDef, level, seed, answer });
    if (task) return task;
  }
  return null;
}

/**
 * Пропорции «как на картинке»: тело не пластина и не игла — высота к
 * ширине от 1 : 3 до 3 : 1, основание не уже трети своей длины.
 */
function goodShape(spec) {
  const b = buildBody(spec);
  const pts = b.extent || b.order.map((n) => b.vertices[n]);
  const ext = (k) => {
    const v = pts.map((p) => p[k]);
    return Math.max(...v) - Math.min(...v);
  };
  const [ex, ey, ez] = ['x', 'y', 'z'].map(ext);
  const w = Math.max(ex, ey);
  return ez / w <= 3 && w / ez <= 3 && Math.min(ex, ey) / w >= 0.3;
}

function buildFormulaTask(ctx, { type, typeDef, level, seed, answer }) {
  const {
    key, def, spec, labels = [], extra = [], ask = null, question, solution,
  } = ctx;
  if (type !== 'fScale' && key !== 'steps' && !goodShape(spec)) return null;
  const ops = [...extra];
  labels.forEach((l, i) => ops.push({ id: `l${i}`, type: 'lengthMark', ref: [...l.ref], text: l.g.label }));
  const askOps = ask ? [{ id: 'ask', type: 'segment', ref: [...ask] }] : [];
  const scene = { body: spec, ops: [...ops, ...askOps], ...(ctx.hide?.length ? { hidden: [...ctx.hide] } : {}) };
  const model = evaluateScene(scene);
  if (model.steps.some((s) => !s.ok)) return null;
  // 🚨 подпись = длина на чертеже
  for (const l of labels) {
    const [A, B] = l.ref.map((n) => model.points[n]?.pos);
    if (!A || !B || Math.abs(dist(A, B) - l.g.v) > 1e-6 * Math.max(1, l.g.v)) return null;
  }
  const solutionScene = {
    ...scene,
    ...(ask ? { segmentColors: { [[...ask].sort().join('-')]: 'red' } } : {}),
  };
  return {
    family: 'formula',
    seed, body: key, type, level,
    scene, solutionScene, model,
    statement: question,
    answer: `$${numTex(answer)}$`,
    answerValue: answer,
    solutionText: solution.join('\n\n'),
    hint: typeDef.hint,
    tag: typeDef.tag,
    facets: [def.facet, ...typeDef.facets],
    given: labels.map((l) => ({ ref: l.ref, value: l.g.label })),
    ask,
  };
}

// ─── запись банка ───────────────────────────────────────────────────────────

const LEVEL_DIFFICULTY = { 1: 1, 2: 2, 3: 3 };

/** Задание → geometry_tasks (origin = 'gen'). */
export function formulaTaskToRecord(task, { code } = {}) {
  const typeDef = FORMULA_TYPES[task.type];
  const def = genBodyDef(task.body);
  const solution = [
    task.solutionText,
    '',
    stereoBlockMarkdown(task.solutionScene, DEFAULT_CAMERA, { color: true }).trim(),
    '',
    `**Ответ:** ${task.answer}`,
  ].join('\n');
  return {
    code: code || `${typeDef.prefix}-${task.seed}`,
    title: `${typeDef.label}: ${def.short}`,
    statement_md: task.statement,
    answer: task.answer,
    solution_md: solution,
    hints: [{ order: 1, text_md: typeDef.hint }],
    drawing_view: 'svg',
    drawing_svg: stereoDrawingSvg(task.scene, DEFAULT_CAMERA),
    section: 'stereo',
    origin: 'gen',
    source: 'Генератор задач по стереометрии',
    difficulty: LEVEL_DIFFICULTY[task.level] || 2,
    task_type: '',
  };
}
