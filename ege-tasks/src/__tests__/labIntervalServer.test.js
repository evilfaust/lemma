// @vitest-environment node
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { buildIntervalTask, generateIntervalExperiment } from '../utils/lab/intervalExperiment';
import { fLin } from '../utils/intervalMethod';
import { INTERVAL_STEPS } from '../utils/lab/intervalContract';
const lib = createRequire(import.meta.url)('../../../pocketbase/pb_hooks/lab_interval_lib.js');
const tasks = () => generateIntervalExperiment({ count: 3, skills: ['product'] });
const record = (id, data = {}, collection = '') => ({ id, getString: k => typeof data[k] === 'object' ? JSON.stringify(data[k]) : String(data[k] || ''), getBool: k => !!data[k], getStringSlice: k => data[k] || [], collection: () => ({ name: collection }) });
const teacher = (role, sections = ['lab']) => record('t', { role, allowed_sections: sections }, 'teachers');
function solveTask(ts, state) {
  const task = ts[state.taskIndex];
  while (ts[state.taskIndex] === task) {
    const step = lib.STEPS[state.stepIndex];
    const { gaps, points } = task.expected.answer;
    const components = gaps.flatMap((on, i) => on ? [`(${task.roots[i - 1] ?? '-∞'}; ${task.roots[i] ?? '+∞'})`] : []);
    points.forEach((on, i) => { if (on) components.push(`{${task.roots[i]}}`); });
    const values = { ...task.expected, roots: task.roots.join(';'), order: task.roots, notation: components.join(' ∪ ') || '∅' };
    lib.applyAction(ts, state, { revision: state.revision, kind: 'check', value: values[step] }, true);
  }
}
describe('проверка шагов и права эксперимента', () => {
  it('пускает учителя с лабораторией, блокирует viewer-мутации и обход секции', () => {
    expect(() => lib.teacher(teacher('editor'))).not.toThrow();
    expect(() => lib.teacher(teacher('superadmin', []))).not.toThrow();
    expect(() => lib.teacher(teacher('editor', []))).toThrow('лаборатории');
    expect(() => lib.teacher(record('s', {}, 'students'))).toThrow();
    const work = record('w', { owner: 'other', participants: ['s'] });
    expect(() => lib.owned(teacher('editor'), work)).toThrow('не найдена');
    expect(() => lib.owned(teacher('superadmin'), work)).not.toThrow();
    expect(() => lib.assigned(record('s', {}, 'students'), work)).not.toThrow();
    expect(() => lib.assigned(record('outsider', {}, 'students'), work)).toThrow('не назначена');
    expect(() => lib.assigned(null, work)).toThrow();
  });
  it('не позволяет читать снимок с решениями ученику, открывает точки только после первого шага', () => {
    const ts = tasks(), state = lib.freshState();
    const w = record('w', { title: 'Работа', tasks: ts, is_open: true, settings: { hints: false } });
    const a = record('a', { state, status: 'started' });
    let view = lib.studentView(w, a);
    expect(view.hintsAllowed).toBe(false);
    expect(view.current.roots).toBeUndefined();
    const raw = JSON.stringify(view);
    for (const forbidden of ['expected', 'answerLatex', 'numer', 'denom', 'roster', 'participants']) expect(raw).not.toContain(forbidden);
    lib.applyAction(ts, state, { revision: 0, kind: 'check', value: ts[0].roots.join(';') }, true);
    view = lib.studentView(w, a);
    expect(view.current.roots).toBeUndefined();
    expect([...view.current.rootChoices].sort((a, b) => a - b)).toEqual(ts[0].roots);
    lib.applyAction(ts, state, { revision: 1, kind: 'check', value: ts[0].roots }, true);
    expect(lib.studentView(w, a).current.roots).toEqual(ts[0].roots);
    expect(view.current.expected).toBeUndefined();
  });
  it('ошибка сохраняется, не продвигает шаг и не подменяет результат данными клиента', () => {
    const ts = tasks(), state = lib.freshState();
    lib.applyAction(ts, state, { revision: 0, kind: 'check', value: '999', correct: true, score: 100 }, true);
    expect(state.stepIndex).toBe(0);
    expect(state.answers['q1.roots']).toMatchObject({ errors: 1, checks: 1, correct: false });
    solveTask(ts, state);
    expect(state.answers['q1.roots'].history.map(h => h.correct)).toEqual([false, true]);
    expect(state.answers['q1.roots'].history[0].value).toBe('999');
    expect(lib.summary(ts, state)).toMatchObject({ solved: 1, independent: 0, corrected: 1, errors: 1 });
  });
  it('подсказки и пропуски учитываются; запрет подсказок проверяется сервером', () => {
    const ts = tasks(), state = lib.freshState();
    expect(() => lib.applyAction(ts, state, { revision: 0, kind: 'hint' }, false)).toThrow('отключены');
    expect(state.revision).toBe(0);
    lib.applyAction(ts, state, { revision: 0, kind: 'hint' }, true);
    lib.applyAction(ts, state, { revision: 1, kind: 'hint' }, true);
    solveTask(ts, state);
    lib.applyAction(ts, state, { revision: state.revision, kind: 'skip' }, true);
    solveTask(ts, state);
    expect(state.completedAt).toBeTruthy();
    expect(lib.summary(ts, state)).toMatchObject({ solved: 2, independent: 1, helped: 1, skipped: 1, hints: 1 });
  });
  it('отклоняет повторную отправку старой ревизии и не теряет состояние', () => {
    const ts = tasks(), state = lib.freshState();
    lib.applyAction(ts, state, { revision: 0, kind: 'check', value: ts[0].roots.join(';') }, true);
    const saved = JSON.stringify(state);
    expect(() => lib.applyAction(ts, state, { revision: 0, kind: 'skip' }, true)).toThrow('другом устройстве');
    expect(JSON.stringify(state)).toBe(saved);
  });
  it('принимает эквивалентную запись чисел, не принимает код и незаполненные шаги', () => {
    expect(lib.parseRoots('−3; 0; 4/2')).toEqual([-3, 0, 2]);
    for (const s of ['1/0', 'Infinity', '1+1', 'process.exit()', '']) expect(lib.parseRoots(s)).toBeNull();
    const t = tasks()[0];
    expect(lib.check(t, 'changes', t.expected.changes.map(() => null))).toBe(false);
    expect(lib.check(t, 'answer', { gaps: [], points: [] })).toBe(false);
  });
  it('отделяет поиск корней от порядка и допускает эквивалентную запись множества', () => {
    expect(lib.STEPS).toEqual(INTERVAL_STEPS.map(step => step.key));
    const task = buildIntervalTask({ numer: [fLin(1, -2)], denom: [fLin(1, 1)] }, 'ge', 'fraction', 'q1');
    expect(lib.check(task, 'roots', '2; -1')).toBe(true);
    expect(lib.check(task, 'order', [2, -1])).toBe(false);
    expect(lib.check(task, 'notation', '[2; +inf) ∪ (-∞; -1)')).toBe(true);
    expect(lib.check(task, 'notation', '(2; +∞) U {-3; 2} U (-∞; -1)')).toBe(true);
    expect(lib.check(task, 'notation', '(-∞; -1] ∪ [2; +∞)')).toBe(false);
    expect(lib.check(task, 'notation', '(-∞; -1) ∪ (2; +∞)')).toBe(false);
    expect(lib.check(task, 'notation', '[-∞; -1) ∪ [2; +∞)')).toBe(false);
    const isolated = buildIntervalTask({ numer: [fLin(1, -2, 2)], denom: [] }, 'le', 'multiplicity', 'q2');
    expect(lib.check(isolated, 'notation', '{2}')).toBe(true);
    expect(lib.check(isolated, 'notation', '[2; 2]')).toBe(true);
    const empty = buildIntervalTask({ numer: [fLin(1, -2, 2)], denom: [] }, 'lt', 'multiplicity', 'q3');
    expect(lib.check(empty, 'notation', '∅')).toBe(true);
  });
  it('переводит старую попытку на новый шаг, сохраняя отметки и историю', () => {
    const ts = tasks();
    const finished = Object.fromEntries(['roots', 'changes', 'points', 'signs', 'answer'].map(k => [`q1.${k}`, { correct: true }]));
    const answers = { ...finished, 'q2.roots': { correct: true }, 'q2.changes': { correct: true } };
    const a = record('a', { state: { revision: 5, taskIndex: 1, stepIndex: 2, answers }, status: 'started' });
    const w = record('w', { tasks: ts, is_open: true, settings: { version: 1 } });
    const view = lib.studentView(w, a);
    expect(view.attempt.state).toMatchObject({ version: 2, taskIndex: 1, stepIndex: 1, answers });
    expect(view.attempt.summary.solved).toBe(1);
    lib.applyAction(ts, view.attempt.state, { revision: 5, kind: 'check', value: ts[1].roots }, true);
    expect(view.attempt.state.stepIndex).toBe(3);
  });
  it('показывает только текущий шаг после трёх ошибок и сохраняет их в отчёте', () => {
    const ts = tasks(), state = lib.freshState();
    expect(() => lib.applyAction(ts, state, { revision: 0, kind: 'reveal' }, true)).toThrow();
    for (let i = 0; i < 3; i++) lib.applyAction(ts, state, { revision: i, kind: 'check', value: '999' }, true);
    lib.applyAction(ts, state, { revision: 3, kind: 'reveal' }, true);
    expect(state.stepIndex).toBe(0);
    expect(state.answers['q1.roots']).toMatchObject({ revealed: true, checks: 3, errors: 3, correct: false });
    lib.applyAction(ts, state, { revision: 4, kind: 'continue' }, true);
    expect(state.stepIndex).toBe(1);
    solveTask(ts, state);
    expect(lib.summary(ts, state)).toMatchObject({ solved: 1, helped: 1, hints: 0, steps: { roots: { shown: 1 } } });
  });
  it('валидирует структуру снимка, дубли и объём до записи', () => {
    const ts = tasks();
    expect(() => lib.validateTasks(ts)).not.toThrow();
    expect(() => lib.validateTasks([ts[0]])).toThrow();
    expect(() => lib.validateTasks([ts[0], ts[0], ts[0]])).toThrow();
    ts[0].expected.signs = [42];
    expect(() => lib.validateTasks(ts)).toThrow();
  });
});
