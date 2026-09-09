import { describe, it, expect } from 'vitest';
import {
  intersectSets, unionSets, solvePart, solveSystem, verifySystem,
  systemTex, integerPoints,
} from '../utils/inequalitySystem';
import { piece, EMPTY_SET, ALL_REAL, inequalityAnswerTex, contains } from '../utils/quadraticInequality';
import { qn, qx, qx2 } from '../utils/quadraticExpr';
import { num, vr } from '../utils/linearExpr';
import { sInt, sRat } from '../utils/surd';
import { rat } from '../utils/linearExpr';

const set = (...pieces) => ({ pieces });
const P = (lo, hi, loOpen = true, hiOpen = true) => piece(
  lo === null ? null : sInt(lo),
  hi === null ? null : sInt(hi),
  loOpen, hiOpen,
);

const tex = (sol) => inequalityAnswerTex(sol, 'x', { form: 'interval' });

// Части системы: линейная — деревом linearExpr, квадратная — quadraticExpr
const linPart = (k, b, op) => ({ tree: 'lin', left: [vr(rat(k)), num(rat(b))], right: [num(rat(0))], op });
const quadPart = (a, b, c, op) => ({ tree: 'quad', left: [qx2(sInt(a)), qx(sInt(b)), qn(sInt(c))], right: [qn(sInt(0))], op });

describe('пересечение множеств', () => {
  it('две полосы дают общую часть', () => {
    expect(tex(intersectSets(set(P(0, 10)), set(P(5, 20)))))
      .toBe('\\left(5; 10\\right)');
  });

  it('строгая граница побеждает нестрогую', () => {
    const a = set(P(0, 5, false, false));    // [0; 5]
    const b = set(P(0, 5, true, false));     // (0; 5]
    expect(tex(intersectSets(a, b))).toBe('\\left(0; 5\\right]');
  });

  it('соприкосновение по одной точке даёт точку, а не пустоту', () => {
    const a = set(P(null, 3, true, false));  // (−∞; 3]
    const b = set(P(3, null, false, true));  // [3; +∞)
    expect(tex(intersectSets(a, b))).toBe('\\left\\{3\\right\\}');
  });

  it('выколотая граница обращает касание в пустое множество', () => {
    const a = set(P(null, 3, true, true));   // (−∞; 3)
    const b = set(P(3, null, false, true));  // [3; +∞)
    expect(intersectSets(a, b).pieces).toHaveLength(0);
  });

  it('пересечение с объединением лучей сохраняет оба куска', () => {
    const rays = set(P(null, -2), P(2, null));       // |x| > 2
    const band = set(P(-5, 5));                      // −5 < x < 5
    expect(tex(intersectSets(rays, band)))
      .toBe('\\left(-5; -2\\right) \\cup \\left(2; 5\\right)');
  });

  it('пустое множество поглощает', () => {
    expect(intersectSets(EMPTY_SET, ALL_REAL).pieces).toHaveLength(0);
    expect(tex(intersectSets(ALL_REAL, set(P(1, 2))))).toBe('\\left(1; 2\\right)');
  });
});

describe('объединение множеств', () => {
  it('перекрывающиеся полосы сливаются в одну', () => {
    expect(tex(unionSets(set(P(0, 10)), set(P(5, 20))))).toBe('\\left(0; 20\\right)');
  });

  it('касание закрытым концом склеивает, выколотое — нет', () => {
    expect(tex(unionSets(set(P(null, 2, true, false)), set(P(2, null)))))
      .toBe('\\left(-\\infty; +\\infty\\right)');
    expect(unionSets(set(P(null, 2)), set(P(2, null))).pieces).toHaveLength(2);
  });

  it('далёкие промежутки остаются раздельными и упорядоченными', () => {
    expect(tex(unionSets(set(P(5, 7)), set(P(-3, -1)))))
      .toBe('\\left(-3; -1\\right) \\cup \\left(5; 7\\right)');
  });
});

describe('решение одного неравенства', () => {
  it('линейное: деление на отрицательное разворачивает знак', () => {
    expect(tex(solvePart(linPart(-2, 6, 'lt')))).toBe('\\left(3; +\\infty\\right)');
    expect(tex(solvePart(linPart(2, -6, 'ge')))).toBe('\\left[3; +\\infty\\right)');
  });

  it('квадратное: внутрь или наружу по знаку', () => {
    // x² − 4 ⩽ 0 → [−2; 2]
    expect(tex(solvePart(quadPart(1, 0, -4, 'le')))).toBe('\\left[-2; 2\\right]');
    // x² − 4 > 0 → два луча
    expect(tex(solvePart(quadPart(1, 0, -4, 'gt'))))
      .toBe('\\left(-\\infty; -2\\right) \\cup \\left(2; +\\infty\\right)');
  });

  it('вырожденные случаи: всё и ничего', () => {
    // x² + 1 > 0 — верно всегда; x² + 1 < 0 — никогда
    expect(tex(solvePart(quadPart(1, 0, 1, 'gt')))).toBe('\\left(-\\infty; +\\infty\\right)');
    expect(solvePart(quadPart(1, 0, 1, 'lt')).pieces).toHaveLength(0);
  });
});

describe('система и совокупность', () => {
  const parts = [quadPart(1, 0, -9, 'le'), linPart(1, 0, 'gt')];   // x² ⩽ 9 и x > 0

  it('система — пересечение', () => {
    const sol = solveSystem(parts, 'and');
    expect(tex(sol)).toBe('\\left(0; 3\\right]');
    expect(verifySystem(parts, sol, 'and')).toBe(true);
  });

  it('совокупность — объединение', () => {
    const sol = solveSystem(parts, 'or');
    expect(tex(sol)).toBe('\\left[-3; +\\infty\\right)');
    expect(verifySystem(parts, sol, 'or')).toBe(true);
  });

  it('проверка ловит подменённый ответ', () => {
    const sol = solveSystem(parts, 'and');
    const wrong = { pieces: [piece(sInt(0), sInt(3), false, false)] };   // [0; 3] вместо (0; 3]
    expect(verifySystem(parts, sol, 'and')).toBe(true);
    expect(verifySystem(parts, wrong, 'and')).toBe(false);
  });

  it('несовместная система решений не имеет', () => {
    const sol = solveSystem([linPart(1, -5, 'gt'), linPart(1, -1, 'lt')], 'and');
    expect(sol.pieces).toHaveLength(0);
    expect(inequalityAnswerTex(sol, 'x', {})).toBe('\\varnothing');
  });

  it('целые решения считаются перебором', () => {
    const sol = solveSystem([linPart(1, 2, 'ge'), linPart(1, -3, 'le')], 'and');  // [−2; 3]
    expect(integerPoints(sol)).toEqual([-2, -1, 0, 1, 2, 3]);
  });
});

describe('запись условия', () => {
  it('система — фигурной скобкой, совокупность — квадратной', () => {
    const parts = [linPart(1, -2, 'gt'), linPart(1, -7, 'lt')];
    expect(systemTex(parts, 'x', 'and')).toContain('\\begin{cases}');
    expect(systemTex(parts, 'x', 'or')).toContain('\\left[\\begin{array}{l}');
    expect(systemTex(parts, 'x', 'and')).toContain(' \\\\ ');
  });
});
