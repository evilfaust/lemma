// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildIntervalTask, generateIntervalExperiment } from '../utils/lab/intervalExperiment';
import { fLin, fConst, evalExprNum } from '../utils/intervalMethod';
import { intervalSelectionText, intervalStepAnswerText } from '../utils/lab/intervalContract';

function seeded(seed = 311) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
const holds = (v, op) => ({ gt: v > 0, ge: v >= 0, lt: v < 0, le: v <= 0 })[op];
describe('математика отдельного тренажёра интервалов', () => {
  it('сверяет 400 разных заданий с подстановкой в исходное выражение', () => {
    const random = seeded();
    for (let k = 0; k < 20; k++) {
      const tasks = generateIntervalExperiment({ count: 20 }, random);
      expect(new Set(tasks.map(t => t.expression)).size).toBe(20);
      expect(new Set(tasks.map(t => t.skill)).size).toBe(3);
      for (const t of tasks) {
        const { roots, expected: e } = t;
        expect(roots).toEqual([...new Set(roots)].sort((a, b) => a - b));
        const probes = [roots[0] - 10, ...roots.slice(1).map((r, i) => (r + roots[i]) / 2), roots.at(-1) + 10];
        probes.forEach((x, i) => {
          const v = evalExprNum(t.expr, x);
          expect(e.signs[i]).toBe(Math.sign(v));
          expect(e.answer.gaps[i]).toBe(holds(v, t.op));
        });
        roots.forEach((x, i) => {
          const v = evalExprNum(t.expr, x);
          expect(e.points[i]).toBe(Number.isFinite(v) && holds(v, t.op));
          expect(e.changes[i]).toBe(Math.sign(evalExprNum(t.expr, x - .01)) !== Math.sign(evalExprNum(t.expr, x + .01)));
        });
      }
    }
  });
  it('сохраняет изолированную точку и пустой ответ при чётной кратности', () => {
    const expr = { numer: [fConst(-1), fLin(1, -2, 2)], denom: [] };
    const t = buildIntervalTask(expr, 'ge', 'multiplicity', 'q1');
    expect(t.expected.answer).toEqual({ gaps: [false, false], points: [true] });
    expect(t.answerLatex).toContain('2');
    expect(buildIntervalTask(expr, 'gt', 'multiplicity', 'q1').expected.answer).toEqual({ gaps: [false, false], points: [false] });
  });
  it('общий корень после сокращения остаётся исключённым, знак учитывает суммарную кратность', () => {
    const t = buildIntervalTask({ numer: [fLin(1, -1), fLin(1, 2)], denom: [fLin(1, -1)] }, 'ge', 'fraction', 'q1');
    expect(t.roots).toEqual([-2, 1]);
    expect(t.expected.changes).toEqual([true, false]);
    expect(t.expected.points).toEqual([true, false]);
    expect(t.expected.answer.gaps).toEqual([false, true, true]);
  });
  it('ограничивает объём и типы; строит текст выбранного множества с отдельными точками', () => {
    expect(() => generateIntervalExperiment({ count: 2 })).toThrow();
    expect(() => generateIntervalExperiment({ count: 21 })).toThrow();
    expect(() => generateIntervalExperiment({ skills: [] })).toThrow();
    expect(() => generateIntervalExperiment({ skills: ['unknown'] })).toThrow();
    expect(intervalSelectionText([2], { gaps: [false, false], points: [true] })).toBe('{2}');
    expect(intervalSelectionText([2], { gaps: [false, false], points: [false] })).toBe('∅');
    expect(intervalStepAnswerText({ roots: [2] }, 'points', [false])).toBe('2: точка исключена');
  });
});
