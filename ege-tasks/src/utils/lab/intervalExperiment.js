// Отдельный эксперимент: только математические примитивы общие с генераторами.
import { fLin, fConst, criticalPoints, leadSignOf, renderExprTex, solveIntervalMethod, verifyIntervalSolution } from '../intervalMethod';
import { inequalityAnswerTex } from '../quadraticInequality';
import { sNum } from '../surd';
import { OPS } from '../inequalityCore';

import { INTERVAL_SKILLS } from './intervalContract';

export function buildIntervalTask(expr, op, skill, key) {
  const pts = criticalPoints(expr);
  const roots = pts.map(p => sNum(p.x));
  const solution = solveIntervalMethod(expr, op);
  if (!pts.length || !verifyIntervalSolution(expr, op, solution)) throw new Error('Не удалось проверить неравенство');
  const changes = pts.map(p => (p.numerMult + p.denomMult) % 2 === 1);
  const points = pts.map(p => !OPS[op].strict && p.numerMult > 0 && p.denomMult === 0);
  const signs = Array(roots.length + 1);
  signs[roots.length] = leadSignOf(expr);
  for (let i = roots.length - 1; i >= 0; i--) signs[i] = changes[i] ? -signs[i + 1] : signs[i + 1];
  const want = op === 'ge' || op === 'gt' ? 1 : -1;
  return {
    key, skill, expression: `${renderExprTex(expr, 'x')} ${OPS[op].tex} 0`,
    roots, expected: { changes, points, signs, answer: { gaps: signs.map(s => s === want), points } },
    answerLatex: inequalityAnswerTex(solution, 'x', { form: 'interval' }),
    // Снимок выражения нужен учителю для воспроизводимости и независимой проверки.
    expr, op,
  };
}

export function generateIntervalExperiment({ count = 8, skills = ['product', 'fraction', 'multiplicity'] } = {}, random = Math.random) {
  if (!Number.isInteger(count) || count < 3 || count > 20) throw new Error('Выбери от 3 до 20 заданий');
  const allowed = INTERVAL_SKILLS.map(s => s.key);
  if (!skills.length || skills.some(s => !allowed.includes(s))) throw new Error('Выбери типы заданий');
  const pick = (n) => Math.floor(random() * n);
  const tasks = [], seen = new Set();
  for (let tries = 0; tasks.length < count && tries < count * 100; tries++) {
    const skill = skills[tasks.length % skills.length];
    const n = skill === 'product' ? 2 + pick(2) : 3;
    const pool = Array.from({ length: 13 }, (_, i) => i - 6);
    const roots = Array.from({ length: n }, () => pool.splice(pick(pool.length), 1)[0]);
    const factors = roots.map((r, i) => {
      const a = i === 0 && pick(3) === 0 ? -1 : 1;
      return fLin(a, -a * r, skill === 'multiplicity' && i === 0 ? 2 : 1);
    });
    const expr = { numer: factors, denom: [] };
    if (skill === 'fraction') expr.denom = expr.numer.splice(-1);
    if (skill === 'multiplicity' && pick(2)) expr.denom = expr.numer.splice(-1);
    if (pick(4) === 0) expr.numer.unshift(fConst(-2));
    const q = buildIntervalTask(expr, ['gt', 'ge', 'lt', 'le'][pick(4)], skill, `q${tasks.length + 1}`);
    if (seen.has(q.expression)) continue;
    seen.add(q.expression); tasks.push(q);
  }
  if (tasks.length !== count) throw new Error('Не удалось собрать разные задания. Попробуй ещё раз');
  return tasks;
}
