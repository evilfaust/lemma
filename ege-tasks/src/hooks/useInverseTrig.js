import { useState, useCallback } from 'react';
import { useApplySheet } from './useApplySheet';
import { buildUniqueVariants } from '../utils/trig/variants';

// ─── Форматирование результата (угол) ─────────────────────────────────────────
const P = Math.PI;
const ARC_RESULTS = [
  [0,        '0'],
  [P / 6,    '\\dfrac{\\pi}{6}'],
  [P / 4,    '\\dfrac{\\pi}{4}'],
  [P / 3,    '\\dfrac{\\pi}{3}'],
  [P / 2,    '\\dfrac{\\pi}{2}'],
  [2 * P / 3,'\\dfrac{2\\pi}{3}'],
  [3 * P / 4,'\\dfrac{3\\pi}{4}'],
  [5 * P / 6,'\\dfrac{5\\pi}{6}'],
  [P,        '\\pi'],
  [-P / 6,   '-\\dfrac{\\pi}{6}'],
  [-P / 4,   '-\\dfrac{\\pi}{4}'],
  [-P / 3,   '-\\dfrac{\\pi}{3}'],
  [-P / 2,   '-\\dfrac{\\pi}{2}'],
  [3 * P / 2,'\\dfrac{3\\pi}{2}'],
  [5 * P / 4,'\\dfrac{5\\pi}{4}'],
  [7 * P / 6,'\\dfrac{7\\pi}{6}'],
  [4 * P / 3,'\\dfrac{4\\pi}{3}'],
];

// Форматирование тригонометрических значений (для вложенных)
const S2 = Math.SQRT2;
const S3 = Math.sqrt(3);
const TRIG_RESULTS = [
  [0, '0'], [1, '1'], [-1, '-1'], [2, '2'], [-2, '-2'],
  [0.5, '\\dfrac{1}{2}'], [-0.5, '-\\dfrac{1}{2}'],
  [S2 / 2, '\\dfrac{\\sqrt{2}}{2}'], [-S2 / 2, '-\\dfrac{\\sqrt{2}}{2}'],
  [S3 / 2, '\\dfrac{\\sqrt{3}}{2}'], [-S3 / 2, '-\\dfrac{\\sqrt{3}}{2}'],
  [S3, '\\sqrt{3}'], [-S3, '-\\sqrt{3}'],
  [S3 / 3, '\\dfrac{\\sqrt{3}}{3}'], [-S3 / 3, '-\\dfrac{\\sqrt{3}}{3}'],
];

function formatArcResult(val, useDegrees) {
  if (!isFinite(val)) return null;
  for (const [v, tex] of ARC_RESULTS) {
    if (Math.abs(val - v) < 1e-7) {
      if (useDegrees) {
        const deg = Math.round(v * 180 / Math.PI);
        return deg === 0 ? '0^{\\circ}' : `${deg}^{\\circ}`;
      }
      return tex;
    }
  }
  return null;
}

function formatTrigResult(val) {
  if (!isFinite(val)) return null;
  for (const [v, tex] of TRIG_RESULTS) {
    if (Math.abs(val - v) < 1e-7) return tex;
  }
  return null;
}

// ─── Данные: таблица значений arcsin/arccos ───────────────────────────────────
// { argNum, argTex, isNeg }
const SINCOS_ARGS = [
  { argNum:  0,      argTex: '0' },
  { argNum:  0.5,    argTex: '\\dfrac{1}{2}' },
  { argNum:  S2 / 2, argTex: '\\dfrac{\\sqrt{2}}{2}' },
  { argNum:  S3 / 2, argTex: '\\dfrac{\\sqrt{3}}{2}' },
  { argNum:  1,      argTex: '1' },
  { argNum: -0.5,    argTex: '-\\dfrac{1}{2}' },
  { argNum: -S2 / 2, argTex: '-\\dfrac{\\sqrt{2}}{2}' },
  { argNum: -S3 / 2, argTex: '-\\dfrac{\\sqrt{3}}{2}' },
  { argNum: -1,      argTex: '-1' },
];

// Таблица значений arctg/arcctg
const TAN_ARGS = [
  { argNum:  0,      argTex: '0' },
  { argNum:  S3 / 3, argTex: '\\dfrac{\\sqrt{3}}{3}' },
  { argNum:  1,      argTex: '1' },
  { argNum:  S3,     argTex: '\\sqrt{3}' },
  { argNum: -S3 / 3, argTex: '-\\dfrac{\\sqrt{3}}{3}' },
  { argNum: -1,      argTex: '-1' },
  { argNum: -S3,     argTex: '-\\sqrt{3}' },
];

// ─── Вычисление значений ──────────────────────────────────────────────────────
function arcsinVal(x) { return Math.asin(x); }
function arccosVal(x) { return Math.acos(x); }
function arctanVal(x) { return Math.atan(x); }
function arccotVal(x) { return Math.PI / 2 - Math.atan(x); }

function evalOuter(fn, angle) {
  if (fn === 'sin') return Math.sin(angle);
  if (fn === 'cos') return Math.cos(angle);
  if (fn === 'tan') {
    const c = Math.cos(angle);
    return Math.abs(c) < 1e-9 ? null : Math.sin(angle) / c;
  }
  if (fn === 'cot') {
    const s = Math.sin(angle);
    return Math.abs(s) < 1e-9 ? null : Math.cos(angle) / s;
  }
  return null;
}

// ─── LaTeX форматирование ─────────────────────────────────────────────────────
function arcFnTex(fn) {
  if (fn === 'arcsin') return '\\arcsin';
  if (fn === 'arccos') return '\\arccos';
  if (fn === 'arctan') return '\\operatorname{arctg}';
  return '\\operatorname{arcctg}';
}

function outerFnTex(fn) {
  if (fn === 'sin') return '\\sin';
  if (fn === 'cos') return '\\cos';
  if (fn === 'tan') return '\\operatorname{tg}';
  return '\\operatorname{ctg}';
}

function formatArcArg(argTex) {
  const isNeg = argTex.startsWith('-');
  if (isNeg) return `\\!\\left(${argTex}\\right)`;
  return `\\,${argTex}`;
}

// ─── Рандом ───────────────────────────────────────────────────────────────────
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ─── Генераторы заданий ───────────────────────────────────────────────────────

// Тип basic: arcsin(a), arccos(a), arctg(a), arcctg(a)
function genBasic(fns, useDegrees) {
  const tasks = [];
  for (const fn of fns) {
    const pool = (fn === 'arctan' || fn === 'arccot') ? TAN_ARGS : SINCOS_ARGS;
    for (const { argNum, argTex } of pool) {
      let val;
      if (fn === 'arcsin')  val = arcsinVal(argNum);
      else if (fn === 'arccos') val = arccosVal(argNum);
      else if (fn === 'arctan') val = arctanVal(argNum);
      else val = arccotVal(argNum);

      const resultLatex = formatArcResult(val, useDegrees);
      if (!resultLatex) continue;

      const exprLatex = `${arcFnTex(fn)}${formatArcArg(argTex)}`;
      tasks.push({ exprLatex, resultLatex });
    }
  }
  return tasks;
}

// Тип sum: arcfn1(a) ± arcfn2(b)
function genSum(fns, useDegrees, maxTries = 200) {
  const results = [];
  for (let t = 0; t < maxTries; t++) {
    const fn1 = rand(fns);
    const fn2 = rand(fns);
    const pool1 = (fn1 === 'arctan' || fn1 === 'arccot') ? TAN_ARGS : SINCOS_ARGS;
    const pool2 = (fn2 === 'arctan' || fn2 === 'arccot') ? TAN_ARGS : SINCOS_ARGS;
    const a1 = rand(pool1);
    const a2 = rand(pool2);
    const sign = rand([1, -1]);

    let v1, v2;
    if (fn1 === 'arcsin')  v1 = arcsinVal(a1.argNum);
    else if (fn1 === 'arccos') v1 = arccosVal(a1.argNum);
    else if (fn1 === 'arctan') v1 = arctanVal(a1.argNum);
    else v1 = arccotVal(a1.argNum);

    if (fn2 === 'arcsin')  v2 = arcsinVal(a2.argNum);
    else if (fn2 === 'arccos') v2 = arccosVal(a2.argNum);
    else if (fn2 === 'arctan') v2 = arctanVal(a2.argNum);
    else v2 = arccotVal(a2.argNum);

    const total = v1 + sign * v2;
    const resultLatex = formatArcResult(total, useDegrees);
    if (!resultLatex) continue;

    // Не брать тривиальные: fn1=fn2, a1=a2, sign=-1 → 0
    if (Math.abs(total) < 1e-9 && fn1 === fn2 && Math.abs(a1.argNum - a2.argNum) < 1e-9) continue;

    const term1 = `${arcFnTex(fn1)}${formatArcArg(a1.argTex)}`;
    const term2 = `${arcFnTex(fn2)}${formatArcArg(a2.argTex)}`;
    const exprLatex = sign === 1
      ? `${term1} + ${term2}`
      : `${term1} - ${term2}`;
    results.push({ exprLatex, resultLatex });
    if (results.length >= 60) break;
  }
  return results;
}

// Тип nested: outerFn(arcfn(a))
function genNested(outerFns, arcFns) {
  const results = [];
  for (const arc of arcFns) {
    const pool = (arc === 'arctan' || arc === 'arccot') ? TAN_ARGS : SINCOS_ARGS;
    for (const { argNum, argTex } of pool) {
      for (const outer of outerFns) {
        let angle;
        if (arc === 'arcsin')  angle = arcsinVal(argNum);
        else if (arc === 'arccos') angle = arccosVal(argNum);
        else if (arc === 'arctan') angle = arctanVal(argNum);
        else angle = arccotVal(argNum);

        const val = evalOuter(outer, angle);
        if (val === null) continue;

        const resultLatex = formatTrigResult(val);
        if (!resultLatex) continue;

        const innerTex = `${arcFnTex(arc)}${formatArcArg(argTex)}`;
        const exprLatex = `${outerFnTex(outer)}\\!\\left(${innerTex}\\right)`;
        results.push({ exprLatex, resultLatex });
      }
    }
  }
  return results;
}

// Тип arcOfTrig: arcsin(sin 5π/6) = π/6 — главное значение, а не «сам угол»
const THETAS = [];
for (const den of [6, 4, 3]) {
  for (let num = -2 * den + 1; num < 2 * den; num++) {
    const g = gcdInt(Math.abs(num), den);
    if (g !== 1 && num !== 0) continue;
    if (num === 0 && den !== 6) continue;
    THETAS.push({ num, den });
  }
}
function gcdInt(a, b) { while (b) [a, b] = [b, a % b]; return a || 1; }
function angleTex(num, den) {
  if (num === 0) return '0';
  const sign = num < 0 ? '-' : '';
  const n = Math.abs(num);
  if (den === 1) return `${sign}${n === 1 ? '' : n}\\pi`;
  return `${sign}\\dfrac{${n === 1 ? '' : n}\\pi}{${den}}`;
}

const ARC_OF = { sin: 'arcsin', cos: 'arccos', tan: 'arctan', cot: 'arccot' };
const ARC_VAL = { arcsin: arcsinVal, arccos: arccosVal, arctan: arctanVal, arccot: arccotVal };

function genArcOfTrig(arcFns, useDegrees) {
  const out = [];
  const outerOf = Object.fromEntries(Object.entries(ARC_OF).map(([f, a]) => [a, f]));
  for (const arc of arcFns) {
    const fn = outerOf[arc];
    for (const { num, den } of THETAS) {
      const theta = (num / den) * Math.PI;
      const inner = evalOuter(fn, theta);
      if (inner === null || !isFinite(inner)) continue;
      const resultLatex = formatArcResult(ARC_VAL[arc](inner), useDegrees);
      if (!resultLatex) continue;
      // угол уже в области значений — это не задание на «главное значение»
      if (Math.abs(ARC_VAL[arc](inner) - theta) < 1e-9 && Math.random() < 0.7) continue;
      const thetaTex = angleTex(num, den);
      const innerTex = num < 0
        ? `${outerFnTex(fn)}\\!\\left(${thetaTex}\\right)`
        : `${outerFnTex(fn)}\\,${thetaTex}`;
      out.push({ exprLatex: `${arcFnTex(arc)}\\!\\left(${innerTex}\\right)`, resultLatex });
    }
  }
  return out;
}

// Тип nestedNonTable: sin(arccos 3/5) = 4/5 — через основное тождество.
// Пифагоровы тройки дают рациональные значения всех четырёх функций.
const TRIPLES = [[3, 4, 5], [4, 3, 5], [5, 12, 13], [12, 5, 13], [8, 15, 17], [15, 8, 17], [7, 24, 25], [24, 7, 25]];

function ratTex(n, d) {
  const g = gcdInt(Math.abs(n), Math.abs(d));
  let a = n / g; let b = d / g;
  if (b < 0) { a = -a; b = -b; }
  if (b === 1) return String(a);
  return a < 0 ? `-\\dfrac{${-a}}{${b}}` : `\\dfrac{${a}}{${b}}`;
}

function genNestedNonTable(outerFns, arcFns) {
  const out = [];
  for (const arc of arcFns) {
    for (const [a, b, c] of TRIPLES) {
      for (const sign of [1, -1]) {
        // sin, cos угла arc(p): у arcsin cos ≥ 0, у arccos sin ≥ 0, у arctg/arcctg — по четверти
        let sn; let cs; let pTex; let pVal;
        if (arc === 'arcsin') { sn = [sign * a, c]; cs = [b, c]; pTex = ratTex(sign * a, c); pVal = sign * a / c; }
        else if (arc === 'arccos') { cs = [sign * a, c]; sn = [b, c]; pTex = ratTex(sign * a, c); pVal = sign * a / c; }
        else if (arc === 'arctan') { sn = [sign * a, c]; cs = [b, c]; pTex = ratTex(sign * a, b); pVal = sign * a / b; }
        else { // arcctg p ∈ (0; π): sin > 0, знак cos = знак p
          sn = [b, c]; cs = [sign * a, c]; pTex = ratTex(sign * a, b); pVal = sign * a / b;
        }
        for (const outer of outerFns) {
          const own = { arcsin: 'sin', arccos: 'cos', arctan: 'tan', arccot: 'cot' }[arc];
          if (outer === own) continue;
          let res;
          if (outer === 'sin') res = ratTex(sn[0], sn[1]);
          else if (outer === 'cos') res = ratTex(cs[0], cs[1]);
          else if (outer === 'tan') res = ratTex(sn[0], cs[0]);
          else res = ratTex(cs[0], sn[0]);
          const argTex = pVal < 0 ? `\\!\\left(${pTex}\\right)` : `\\,${pTex}`;
          out.push({
            exprLatex: `${outerFnTex(outer)}\\!\\left(${arcFnTex(arc)}${argTex}\\right)`,
            resultLatex: res,
          });
        }
      }
    }
  }
  return out;
}

// ─── Настройки по умолчанию ───────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  variantsCount:  4,
  questionsCount: 6,
  taskType:       'basic',    // 'basic' | 'sum' | 'nested' | 'arcOfTrig' | 'nestedNonTable' | 'mixed'
  useArcsin:      true,
  useArccos:      true,
  useArctan:      false,
  useArccot:      false,
  useOuterSin:    true,
  useOuterCos:    true,
  useOuterTan:    false,
  useOuterCot:    false,
  useDegrees:     false,      // градусная мера угла
  showTeacherKey: true,
  twoPerPage:     false,
  showWorkSpace:  false,
  workSpaceSize:  20,
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
const MIXED_TYPES = ['basic', 'sum', 'nested', 'arcOfTrig', 'nestedNonTable'];

export function generateInverseTrigVariants(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const {
    variantsCount, questionsCount, taskType,
    useArcsin, useArccos, useArctan, useArccot,
    useOuterSin, useOuterCos, useOuterTan, useOuterCot,
    useDegrees,
  } = s;
  const arcFns = [
    useArcsin && 'arcsin', useArccos && 'arccos',
    useArctan && 'arctan', useArccot && 'arccot',
  ].filter(Boolean);
  if (arcFns.length === 0) return [];
  const outerFns = [
    useOuterSin && 'sin', useOuterCos && 'cos',
    useOuterTan && 'tan', useOuterCot && 'cot',
  ].filter(Boolean);

  const pools = {};
  const want = taskType === 'mixed' ? MIXED_TYPES : [taskType];
  if (want.includes('basic')) pools.basic = genBasic(arcFns, useDegrees);
  if (want.includes('sum')) pools.sum = genSum(arcFns, useDegrees);
  if (want.includes('nested') && outerFns.length) pools.nested = genNested(outerFns, arcFns);
  if (want.includes('arcOfTrig')) pools.arcOfTrig = genArcOfTrig(arcFns, useDegrees);
  if (want.includes('nestedNonTable') && outerFns.length) pools.nestedNonTable = genNestedNonTable(outerFns, arcFns);
  const types = want.filter(t => pools[t]?.length);
  if (!types.length) return [];

  // В смешанном листе типы идут по кругу: задание №k во всех вариантах одного типа
  return buildUniqueVariants({
    variantsCount,
    count: questionsCount,
    makeOne: (i) => {
      const pool = pools[types[i % types.length]];
      return pool[Math.floor(Math.random() * pool.length)];
    },
  });
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useInverseTrig() {
  const [title, setTitle] = useState('Вычислите значения выражений');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateInverseTrigVariants(s);
    if (!variants.length) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Вычислите значения выражений');
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return {
    title, setTitle, settings, updateSetting, tasksData, generate, reset,
    setTasksData, applySheet,
  };
}
