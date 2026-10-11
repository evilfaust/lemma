import { normalizeAnswer } from './answerChecker';
import {
  exactFromLatex, exactToLatex, exactEqual, exactNeg, exactConjugate,
} from './exactValue';

const NUMERIC_DELTAS = [-2, -1, 1, 2, -3, 3, -5, 5, -10, 10];

function formatNumber(n, sample) {
  if (Number.isInteger(n)) return String(n);
  const decimals = sample && sample.includes(',')
    ? (sample.split(',')[1] || '').length
    : (sample && sample.includes('.') ? (sample.split('.')[1] || '').length : 2);
  const fixed = n.toFixed(Math.max(1, Math.min(decimals, 4)));
  const trimmed = fixed.replace(/0+$/, '').replace(/\.$/, '');
  return sample && sample.includes(',') ? trimmed.replace('.', ',') : trimmed;
}

function isPureNumeric(raw) {
  if (!raw) return false;
  const s = raw.trim();
  if (/[a-zA-Zа-яА-Я\\(){}\[\]π=]/.test(s)) return false;
  const n = normalizeAnswer(s);
  return !isNaN(n) && isFinite(n);
}

function isFraction(raw) {
  return /^-?\d+\s*\/\s*-?\d+$/.test((raw || '').trim());
}

function genNumericDistractors(correctRaw, count) {
  const correctNum = normalizeAnswer(correctRaw);
  if (isNaN(correctNum)) return [];
  const seen = new Set([formatNumber(correctNum, correctRaw)]);
  const result = [];

  const candidates = [];
  for (const d of NUMERIC_DELTAS) candidates.push(correctNum + d);
  if (correctNum !== 0) {
    candidates.push(-correctNum);
    candidates.push(correctNum * 2);
    candidates.push(Math.round(correctNum / 2));
    candidates.push(correctNum * 10);
    candidates.push(Math.round(correctNum / 10));
  }
  if (Number.isInteger(correctNum)) {
    const digits = String(Math.abs(correctNum));
    if (digits.length >= 2) {
      const swapped = parseInt(digits[1] + digits[0] + digits.slice(2), 10);
      if (!isNaN(swapped)) candidates.push(correctNum < 0 ? -swapped : swapped);
    }
  }

  for (const c of candidates) {
    if (!isFinite(c)) continue;
    const f = formatNumber(c, correctRaw);
    if (!seen.has(f)) {
      seen.add(f);
      result.push(f);
      if (result.length >= count) break;
    }
  }
  return result;
}

function genFractionDistractors(correctRaw, count) {
  const m = correctRaw.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (!m) return [];
  const num = parseInt(m[1], 10);
  const den = parseInt(m[2], 10);
  const seen = new Set([`${num}/${den}`]);
  const variants = [
    `${den}/${num}`,
    `${num + 1}/${den}`,
    `${num}/${den + 1}`,
    `${-num}/${den}`,
    `${num - 1}/${den}`,
    `${num}/${den - 1}`,
    `${num + 1}/${den + 1}`,
  ];
  const result = [];
  for (const v of variants) {
    if (!seen.has(v) && !v.includes('/0')) {
      seen.add(v);
      result.push(v);
      if (result.length >= count) break;
    }
  }
  return result;
}

function genTextDistractors(correctRaw, count) {
  const s = correctRaw.trim();
  const seen = new Set([s]);
  const result = [];

  const numMatch = s.match(/-?\d+(?:[.,]\d+)?/g);
  if (numMatch) {
    for (const num of numMatch) {
      const isComma = num.includes(',');
      const n = parseFloat(num.replace(',', '.'));
      if (isNaN(n)) continue;
      for (const d of [1, -1, 2, -2]) {
        const newN = n + d;
        const newStr = isComma && !Number.isInteger(newN)
          ? String(newN).replace('.', ',')
          : String(newN);
        const candidate = s.replace(num, newStr);
        if (!seen.has(candidate)) {
          seen.add(candidate);
          result.push(candidate);
          if (result.length >= count) return result;
        }
      }
    }
  }

  if (s.startsWith('-')) {
    const flipped = s.slice(1);
    if (!seen.has(flipped)) { seen.add(flipped); result.push(flipped); }
  } else {
    const flipped = '-' + s;
    if (!seen.has(flipped)) { seen.add(flipped); result.push(flipped); }
  }

  return result.slice(0, count);
}

// ─── Тригонометрия: значения и углы ──────────────────────────────────────────
// Правдоподобные соседи вместо «\dfrac{\sqrt{4}}{2}» и «(0)^n»: знак, соседнее
// табличное значение, sin ↔ cos, tg ↔ ctg, соседний угол.
const TRIG_VALUES = [
  '0', '\\dfrac{1}{2}', '\\dfrac{\\sqrt{2}}{2}', '\\dfrac{\\sqrt{3}}{2}', '1',
  '\\dfrac{\\sqrt{3}}{3}', '\\sqrt{3}', '2', '\\dfrac{3}{2}',
];
const TRIG_ANGLES = [
  '0', '\\dfrac{\\pi}{6}', '\\dfrac{\\pi}{4}', '\\dfrac{\\pi}{3}', '\\dfrac{\\pi}{2}',
  '\\dfrac{2\\pi}{3}', '\\dfrac{3\\pi}{4}', '\\dfrac{5\\pi}{6}', '\\pi',
];

function genExactDistractors(correctRaw, count) {
  const v = exactFromLatex(correctRaw);
  if (!v) return [];
  const isRationalOnly = [...v.keys()].every(k => k === '1|0');
  const hasPi = [...v.keys()].some(k => k.endsWith('|1'));
  const table = (hasPi ? TRIG_ANGLES : TRIG_VALUES).map(exactFromLatex);
  const idx = table.findIndex(t => exactEqual(t, exactNeg(v)) || exactEqual(t, v));
  // обычное число не из таблицы (7, 0,25) — обычным путём
  if (isRationalOnly && idx < 0) return [];
  const cands = [exactNeg(v), exactConjugate(v)];
  if (idx >= 0) {
    const sign = [...v.values()].some(r => r.n < 0) ? exactNeg : (x) => x;
    for (const d of [1, -1, 2, -2, 3]) {
      const t = table[idx + d];
      if (t) cands.push(sign(t), exactNeg(sign(t)));
    }
  }
  const out = [];
  const seen = [v];
  for (const c of cands) {
    if (!c || seen.some(x => exactEqual(x, c))) continue;
    seen.push(c);
    out.push(exactToLatex(c));
    if (out.length >= count) break;
  }
  return out;
}

export function generateDistractors(correctAnswer, count = 3) {
  if (!correctAnswer || typeof correctAnswer !== 'string') return Array(count).fill('');
  const primary = correctAnswer.split('|')[0].trim();
  if (!primary) return Array(count).fill('');

  let distractors = [];
  if (isFraction(primary)) {
    distractors = genFractionDistractors(primary, count);
  } else if (isPureNumeric(primary)) {
    distractors = genNumericDistractors(primary, count);
  } else {
    distractors = genExactDistractors(primary, count);
    if (distractors.length < count) {
      const more = genTextDistractors(primary, count * 2)
        .filter(d => !distractors.includes(d) && !/\\sqrt\{(0|1|4|9|16)\}|\(0\)\^/.test(d));
      distractors = [...distractors, ...more].slice(0, count);
    }
  }

  while (distractors.length < count) distractors.push('');
  return distractors.slice(0, count);
}

export function buildOptions(correctAnswer, count = 4) {
  const correct = (correctAnswer || '').split('|')[0].trim();
  const distractors = generateDistractors(correctAnswer, count - 1);
  return [
    { text: correct, is_correct: true },
    ...distractors.map(d => ({ text: d, is_correct: false }))
  ];
}

export function shuffleOptionsWithSeed(options, seed) {
  const arr = [...options];
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function hashStringToSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
