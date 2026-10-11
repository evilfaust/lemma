/**
 * Сторож тригонометрии ЕГЭ: «По значению и четверти», уравнения части 2
 * (а — серии, б — корни на отрезке) и неравенства. Каждый ответ
 * пересчитывается независимым вычислителем по НАПЕЧАТАННОМУ условию
 * (`helpers/trigTexEval.js`). Остальные генераторы — `trigGenerators.test.js`.
 */
import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  evalTrig, compileTrig, close, checkEquation, numericRoots, domainGuarded,
  checkInequality, parseInequalityAnswer,
} from './helpers/trigTexEval';
import { generateTrigByValueVariants, CATEGORY_LABELS_BY_VALUE } from '../hooks/useTrigByValue';
import { QUARTERS } from '../utils/trig/byValue';
import { generateTrigEquationsEgeVariants, CATEGORY_LABELS_TRIG_EGE } from '../hooks/useTrigEquationsEge';
import { generateTrigInequalitiesVariants, CATEGORY_LABELS_TRIG_INEQ } from '../hooks/useTrigInequalities';
import { generateTrigBasicsVariants, CATEGORY_LABELS_TRIG_BASICS } from '../hooks/useTrigBasics';

const renders = (tex) => {
  katex.renderToString(tex, { throwOnError: true });
  return true;
};

function collect(gen, settings, rounds = 1) {
  const out = new Map();
  for (let r = 0; r < rounds; r++) {
    for (const v of gen({ variantsCount: 8, questionsCount: 16, ...settings })) {
      for (const q of v) out.set(q.exprLatex, q);
    }
  }
  return [...out.values()];
}

// ─── По значению и четверти ─────────────────────────────────────────────────
// Условия «sin α = …» и промежуток α ∈ (…) задают угол: ищем его численно на
// промежутке по напечатанным условиям и считаем по нему напечатанный вопрос.
function solveAlpha(check) {
  const conds = check.conds.map((c) => {
    const [l, r] = c.split('=');
    const L = (a) => evalTrig(l, { '\\alpha': a });
    const R = evalTrig(r);
    return (a) => L(a) - R;
  });
  const [lo, hi] = check.range ? check.range.map(x => x * Math.PI) : [-Math.PI + 1e-6, Math.PI + 1e-6];
  const g = conds[0];
  const roots = [];
  const N = 4000;
  for (let k = 0; k < N; k++) {
    let a = lo + ((hi - lo) * k) / N; let b = lo + ((hi - lo) * (k + 1)) / N;
    let fa = g(a); const fb = g(b);
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) continue;
    if (fa === 0) { roots.push(a); continue; }
    if (fa * fb > 0) continue;
    for (let it = 0; it < 80; it++) {
      const m = (a + b) / 2; const fm = g(m);
      if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
    }
    if (Math.abs(g((a + b) / 2)) < 1e-9) roots.push((a + b) / 2);
  }
  return roots;
}

describe('по значению и четверти', () => {
  for (const cat of Object.keys(CATEGORY_LABELS_BY_VALUE)) {
    it(cat, () => {
      const tasks = collect(generateTrigByValueVariants, { categories: { [cat]: true } }, 2);
      expect(tasks.length).toBeGreaterThan(5);
      const wrong = [];
      for (const q of tasks) {
        expect(renders(q.exprLatex)).toBe(true);
        expect(q.resultLatex).not.toMatch(/dfrac|sqrt/);          // в бланк — число
        const ans = Number(q.resultLatex.replace('{,}', '.'));
        const ask = q.check.ask;
        expect(q.exprLatex.startsWith(ask)).toBe(true);
        for (const c of q.check.conds) expect(q.exprLatex).toContain(c);
        let value;
        if (!q.check.conds.length) value = evalTrig(ask);
        else {
          const roots = solveAlpha(q.check);
          if (!roots.length) { wrong.push(`${q.exprLatex}: нет угла`); continue; }
          // все углы, подходящие под условия, дают один ответ
          const vals = roots.map(a => evalTrig(ask, { '\\alpha': a }));
          if (vals.some(v => !close(v, vals[0], 1e-6))) { wrong.push(`${q.exprLatex}: ответ зависит от угла`); continue; }
          value = vals[0];
        }
        if (!close(value, ans, 1e-7)) wrong.push(`${q.exprLatex} = ${value}, в ключе ${q.resultLatex}`);
      }
      expect(wrong).toEqual([]);
    });
  }

  it('промежуток в условии совпадает с четвертью', () => {
    for (const q of QUARTERS) {
      const [lo, hi] = q.tex.replace(/\\left\(|\\right\)/g, '').split(';').map(t => evalTrig(t));
      expect(close(lo / Math.PI, Number(q.lo.n / q.lo.d))).toBe(true);
      expect(close(hi / Math.PI, Number(q.hi.n / q.hi.d))).toBe(true);
    }
  });
});

// ─── Уравнения части 2: а) серии, б) корни на отрезке ───────────────────────
describe('уравнения ЕГЭ, часть 2', () => {
  for (const cat of Object.keys(CATEGORY_LABELS_TRIG_EGE)) {
    it(cat, { timeout: 60000 }, () => {
      const tasks = collect(generateTrigEquationsEgeVariants, { categories: { [cat]: true }, variantsCount: 4, questionsCount: 12 });
      expect(tasks.length).toBeGreaterThan(5);
      const wrong = [];
      for (const q of tasks) {
        expect(renders(q.exprLatex)).toBe(true);
        expect(renders(q.resultLatex)).toBe(true);
        const [eq, segTex] = q.exprLatex.split(';\\quad ');
        const [a, b] = q.resultLatex.split(';\\quad \\text{б) }');
        const famsTex = a.replace('\\text{а) } ', '');
        const err = checkEquation(eq, famsTex, 'x', [-10, 10]);   // аргумент x: период 2π
        if (err) { wrong.push(`${eq} → ${famsTex}: ${err}`); continue; }
        // б): корни на отрезке — численно по самому уравнению
        const [lo, hi] = segTex.replace(/\\left\[|\\right\]/g, '').split(';').map(t => evalTrig(t));
        const [l, r] = eq.split('=');
        const L = compileTrig(l); const R = compileTrig(r);
        const g = domainGuarded(eq, (x) => L({ x }) - R({ x }));
        const eps = 1e-6;
        const roots = numericRoots(g, lo - eps, hi + eps, 5000).filter(x => x >= lo - 1e-7 && x <= hi + 1e-7);
        // концы отрезка проверяем отдельно (скан мог пропустить точку на границе)
        for (const end of [lo, hi]) {
          if (Math.abs(g(end)) < 1e-9 && !roots.some(x => Math.abs(x - end) < 1e-6)) roots.push(end);
        }
        const listed = b.split(';\\;').map(t => evalTrig(t.trim()));
        const ok = roots.length === listed.length && roots.every(x => listed.some(y => Math.abs(x - y) < 1e-5));
        if (!ok) wrong.push(`${q.exprLatex}: б) в ключе ${listed.map(v => v.toFixed(4))}, по уравнению ${roots.map(v => v.toFixed(4))}`);
      }
      expect(wrong).toEqual([]);
    });
  }

  it('без пункта б) — только серии', () => {
    for (const v of generateTrigEquationsEgeVariants({ variantsCount: 2, questionsCount: 4, withSegment: false })) {
      for (const q of v) {
        expect(q.exprLatex).not.toContain('\\quad');
        expect(checkEquation(q.exprLatex, q.resultLatex, 'x', [-10, 10])).toBeNull();
      }
    }
  });
});

// ─── Неравенства ─────────────────────────────────────────────────────────────
describe('тригонометрические неравенства', () => {
  for (const cat of Object.keys(CATEGORY_LABELS_TRIG_INEQ)) {
    for (const answerForm of ['inequality', 'interval']) {
      it(`${cat} (${answerForm})`, () => {
        const tasks = collect(generateTrigInequalitiesVariants, { categories: { [cat]: true }, answerForm }, 1);
        expect(tasks.length).toBeGreaterThan(3);
        const wrong = [];
        for (const q of tasks) {
          expect(renders(q.exprLatex)).toBe(true);
          expect(renders(q.resultLatex)).toBe(true);
          const err = checkInequality(q.exprLatex, q.resultLatex);
          if (err) wrong.push(`${q.exprLatex} → ${q.resultLatex}: ${err}`);
        }
        expect(wrong).toEqual([]);
      });
    }
  }

  it('граница: нестрогий знак включает концы, строгий — нет', () => {
    const inn = parseInequalityAnswer('\\dfrac{\\pi}{6} + 2\\pi n \\leqslant x \\leqslant \\dfrac{5\\pi}{6} + 2\\pi n,\\; n \\in \\mathbb{Z}');
    expect(inn(Math.PI / 6)).toBe(true);
    const out = parseInequalityAnswer('x \\in \\left(\\dfrac{\\pi}{6} + 2\\pi n;\\, \\dfrac{5\\pi}{6} + 2\\pi n\\right),\\; n \\in \\mathbb{Z}');
    expect(out(Math.PI / 6)).toBe(false);
    expect(checkInequality('\\sin x > \\dfrac{1}{2}', 'x \\in \\left(-\\dfrac{\\pi}{6} + 2\\pi n;\\, \\dfrac{\\pi}{6} + 2\\pi n\\right),\\; n \\in \\mathbb{Z}')).not.toBeNull();
  });
});

// ─── Основы: радианы, знаки, четверти, период, область значений ─────────────
const fnOf = (tex) => {
  const rhs = tex.replace(/^y\s*=\s*/, '');
  const c = compileTrig(rhs);
  return (x) => c({ x });
};

function sampleRange(f) {
  let lo = Infinity; let hi = -Infinity;
  for (let i = 0; i <= 20000; i++) {
    const v = f(-7 + (14 * i) / 20000);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}

describe('основы тригонометрии', () => {
  for (const cat of Object.keys(CATEGORY_LABELS_TRIG_BASICS)) {
    it(cat, () => {
      const tasks = collect(generateTrigBasicsVariants, { categories: { [cat]: true } });
      expect(tasks.length).toBeGreaterThan(5);
      const wrong = [];
      for (const q of tasks) {
        expect(renders(q.exprLatex)).toBe(true);
        expect(renders(q.resultLatex)).toBe(true);
        const c = q.check;
        const fail = (why) => wrong.push(`${q.exprLatex} → ${q.resultLatex}: ${why}`);
        // напечатанное условие начинается с того, что проверяем
        if (c.kind === 'equal') {
          if (!q.exprLatex.startsWith(c.a) || q.resultLatex !== c.b) fail('условие/ответ не те');
          if (!close(evalTrig(c.a), evalTrig(c.b))) fail('величины не равны');
        } else if (c.kind === 'sign') {
          const v = evalTrig(c.expr);
          if ((v > 0 ? '+' : '-') !== q.resultLatex) fail(`значение ${v}`);
        } else if (c.kind === 'quarter') {
          const x = evalTrig(c.angle);
          const t = ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
          const roman = ['I', 'II', 'III', 'IV'][Math.floor(t / (Math.PI / 2))];
          if (q.resultLatex !== `\\text{${roman}}`) fail(`угол ${t}`);
        } else if (c.kind === 'period') {
          const f = fnOf(c.f);
          const T = evalTrig(q.resultLatex);
          const pts = Array.from({ length: 40 }, (_, i) => -3.1 + i * 0.157);
          const periodic = (P) => pts.every(x => {
            const a = f(x); const b = f(x + P);
            return !Number.isFinite(a) || Math.abs(a) > 1e6 || close(a, b, 1e-6);
          });
          if (!periodic(T)) fail('не период');
          for (const m of [2, 3, 4, 5, 6]) if (periodic(T / m)) fail(`T/${m} — тоже период`);
        } else if (c.kind === 'range') {
          const [lo, hi] = sampleRange(fnOf(c.f));
          const [a, b] = q.resultLatex.replace(/\\left\[|\\right\]/g, '').split(';').map(t => evalTrig(t));
          if (!close(lo, a, 1e-6) || !close(hi, b, 1e-6)) fail(`по графику [${lo}; ${hi}]`);
        } else {
          const [lo, hi] = sampleRange(fnOf(c.f));
          const v = Number(q.resultLatex.replace('{,}', '.'));
          if (!close(c.kind === 'max' ? hi : lo, v, 1e-6)) fail(`по графику ${c.kind === 'max' ? hi : lo}`);
          if (!q.exprLatex.startsWith(c.f)) fail('функция не та');
        }
      }
      expect(wrong).toEqual([]);
    });
  }
});
