import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App as AntApp } from 'antd';
import StereoEditor from '../components/stereo/StereoEditor';
import {
  evaluateScene, tryAppendOp, parseCommand, describeOp, opToCommand, editStepCommand,
  renderStereo, stereoSvgString, toolClick, acceptedKinds, TOOLS,
  setPointsHidden, renamePoint, removeOpCascade, angleLabelText,
  parseStereoBlock, buildStereoBlock, DEFAULT_CAMERA,
} from '../utils/stereo';

// Отметка угла (шаг angleMark): ∠ABC по трём точкам и угол между двумя
// пересекающимися прямыми. Скрытые точки (scene.hidden) — оформление.

const cube = { kind: 'cube', a: 4 };
const VP = { width: 400, height: 360 };

function build(cmds, body = cube) {
  let sc = { body, ops: [] };
  for (const c of cmds) {
    const r = parseCommand(c, evaluateScene(sc));
    expect({ c, error: r.error }).toEqual({ c, error: undefined });
    const res = tryAppendOp(sc, r.op);
    expect({ c, error: res.error }).toEqual({ c, error: null });
    sc = res.scene;
  }
  return sc;
}

describe('отметка угла: разбор команды', () => {
  const m = evaluateScene({ body: cube, ops: [] });

  it('∠ABC: вершина — средняя точка, подпись и дуги', () => {
    expect(parseCommand('угол ABD α', m).op).toMatchObject({ type: 'angleMark', pts: ['A', 'B', 'D'], label: 'α' });
    expect(parseCommand('∠A1BD 2 дуги', m).op).toMatchObject({ pts: ['A1', 'B', 'D'], arcs: 2 });
    expect(parseCommand('угол АВD', m).op.pts).toEqual(['A', 'B', 'D']); // кириллица-двойник
    expect(parseCommand('угол ABD', m).op.label).toBeUndefined();
  });

  it('подпись словом → греческая буква; латинское слово не становится именами точек', () => {
    expect(angleLabelText('альфа')).toBe('α');
    expect(angleLabelText('\\varphi')).toBe('φ');
    expect(parseCommand('угол ABD alpha', m).op).toMatchObject({ pts: ['A', 'B', 'D'], label: 'α' });
    expect(parseCommand('угол ABD 30°', m).op.label).toBe('30°');
  });

  it('две прямые — угол между ними; прямая и плоскость — прежний угол с проекцией', () => {
    expect(parseCommand('угол между AC и BD φ', m).op).toMatchObject({ type: 'angleMark', l1: ['A', 'C'], l2: ['B', 'D'], label: 'φ' });
    expect(parseCommand('угол A1C (ABC)', m).op).toMatchObject({ type: 'angle' });
    expect(parseCommand('угол ABC A1C', m).op).toMatchObject({ type: 'angle' });
  });
});

describe('отметка угла: построение', () => {
  it('∠A1BD: дуга у B, стороны дорисованы, величина — только учителю', () => {
    const sc = build(['угол A1BD α']);
    const md = evaluateScene(sc);
    const step = md.steps[0];
    expect(step.created.value).toBe('≈ 60°');
    expect(step.created.note).toMatch(/∠A₁BD = α ≈ 60°/);
    expect(md.arcs).toHaveLength(1);
    expect(md.arcs[0]).toMatchObject({ label: 'α', count: 1, right: false });
    expect(md.arcs[0].at).toEqual(md.points.B.pos);
    // BA1 и BD — не рёбра куба, их не было: дорисованы
    expect(md.lines.filter((l) => l.step === 0 && l.kind === 'segment')).toHaveLength(2);
  });

  it('прямой угол — знак прямого угла вместо дуги', () => {
    const md = evaluateScene(build(['угол BAD']));
    expect(md.arcs).toHaveLength(0);
    expect(md.marks).toHaveLength(1);
    expect(md.steps[0].created.value).toBe('≈ 90°');
  });

  it('точки на одной прямой — понятная ошибка', () => {
    const sc = build(['M на AB 1:1']);
    const r = tryAppendOp(sc, parseCommand('угол AMB', evaluateScene(sc)).op);
    expect(r.error).toMatch(/на одной прямой — угла нет/);
  });

  it('пересекающиеся прямые: вершина — общая точка, угол не тупой', () => {
    const sc = build(['M на AA1 1:1', 'угол MB AB φ']);
    const md = evaluateScene(sc);
    const ar = md.arcs[0];
    expect(ar.at).toEqual(md.points.B.pos);
    const cos = (ar.u.x * ar.v.x + ar.u.y * ar.v.y + ar.u.z * ar.v.z) / (Math.hypot(ar.u.x, ar.u.y, ar.u.z) * Math.hypot(ar.v.x, ar.v.y, ar.v.z));
    expect(cos).toBeGreaterThan(0);
    expect(md.steps[1].created.value).toBe('≈ 26,57°');
  });

  it('тупой угол между прямыми поворачивается в острый', () => {
    // AC1 и BD1 пересекаются в центре куба под тупым и острым углом
    const md = evaluateScene(build(['угол AC1 BD1']));
    const ar = md.arcs[0];
    const dotp = ar.u.x * ar.v.x + ar.u.y * ar.v.y + ar.u.z * ar.v.z;
    expect(dotp).toBeGreaterThan(0);
  });

  it('скрещивающиеся и параллельные — объяснение, а не молчание', () => {
    const sc = { body: cube, ops: [] };
    const err = (cmd) => tryAppendOp(sc, parseCommand(cmd, evaluateScene(sc)).op).error;
    expect(err('угол A1C1 BD')).toMatch(/скрещиваются — .*параллельную/);
    expect(err('угол AB DC')).toMatch(/параллельны — угол между ними 0°/);
  });

  it('рисуется: две дуги, подпись у дуги, прямой угол без дуги', () => {
    const frame = renderStereo(evaluateScene(build(['угол A1BD α 2 дуги'])), DEFAULT_CAMERA, VP);
    const arcStrokes = frame.strokes.filter((s) => s.kind === 'mark');
    expect(new Set(arcStrokes.map((s) => s.objId)).size).toBe(2);
    expect(frame.angleTexts).toHaveLength(1);
    expect(frame.angleTexts[0].text).toBe('α');
    expect(stereoSvgString(frame)).toContain('>α</text>');
  });

  it('описание, команда, правка шага и блок ```stereo — туда и обратно', () => {
    const sc = build(['угол A1BD α 2 дуги', 'угол AC BD']);
    const byId = evaluateScene(sc).opsById;
    expect(describeOp(sc.ops[0], byId)).toBe('Угол ∠A₁BD = α (2 дуги)');
    expect(describeOp(sc.ops[1], byId)).toBe('Угол между AC и BD');
    expect(opToCommand(sc.ops[0], byId)).toBe('угол A1BD α 2 дуги');
    const text = buildStereoBlock(sc, DEFAULT_CAMERA).text;
    const back = parseStereoBlock(text);
    expect(back.errors).toEqual([]);
    expect(back.scene.ops.map((o) => ({ ...o, id: 0 }))).toEqual(sc.ops.map((o) => ({ ...o, id: 0 })));
    const ed = editStepCommand(sc, sc.ops[0].id, 'угол A1BD β');
    expect(ed.scene.ops[0]).toMatchObject({ id: sc.ops[0].id, label: 'β' });
  });
});

describe('отметка угла: инструмент «Угол»', () => {
  const m = evaluateScene({ body: cube, ops: [] });

  it('три точки — ∠ABC', () => {
    expect(acceptedKinds('angle', [])).toEqual(['point', 'line']);
    let r = toolClick('angle', [], { point: 'A1' }, m);
    expect(acceptedKinds('angle', r.pending)).toEqual(['point']);
    r = toolClick('angle', r.pending, { point: 'B' }, m);
    expect(r.op).toBeUndefined();
    r = toolClick('angle', r.pending, { point: 'D' }, m);
    expect(r.op).toMatchObject({ type: 'angleMark', pts: ['A1', 'B', 'D'] });
  });

  it('прямая и прямая — угол между ними; прямая и грань — угол с плоскостью', () => {
    let r = toolClick('angle', [], { line: { id: 'x', ref: ['A', 'C'] } }, m);
    r = toolClick('angle', r.pending, { line: { id: 'y', ref: ['B', 'D'] } }, m);
    expect(r.op).toMatchObject({ type: 'angleMark', l1: ['A', 'C'], l2: ['B', 'D'] });
    r = toolClick('angle', [], { line: { id: 'x', ref: ['A1', 'C'] } }, m);
    r = toolClick('angle', r.pending, { face: { id: 'f', verts: ['A', 'B', 'C', 'D'] } }, m);
    expect(r.op).toMatchObject({ type: 'angle' });
  });
});

describe('скрытые точки', () => {
  const base = () => build(['O = AC ∩ BD', 'P = середина A1C1']);

  it('команды «скрыть» / «показать» — оформление, не шаг', () => {
    const m = evaluateScene(base());
    expect(parseCommand('скрыть O, A1', m)).toEqual({ action: 'hide', names: ['O', 'A1'], hidden: true });
    expect(parseCommand('показать O', m)).toEqual({ action: 'hide', names: ['O'], hidden: false });
    expect(parseCommand('показать все', m)).toEqual({ action: 'hide', names: 'all', hidden: false });
  });

  it('скрытой точки нет на чертеже и в SVG, в редакторе — бледная; построения целы', () => {
    const sc = setPointsHidden(base(), ['O']);
    const md = evaluateScene(sc);
    expect(md.steps.every((st) => st.ok)).toBe(true);
    const frame = renderStereo(md, DEFAULT_CAMERA, VP);
    expect(frame.dots.some((d) => d.name === 'O')).toBe(false);
    expect(frame.labels.some((l) => l.name === 'O')).toBe(false);
    const ed = renderStereo(md, DEFAULT_CAMERA, VP, { showHidden: true });
    expect(ed.dots.find((d) => d.name === 'O')).toMatchObject({ ghost: true });
    expect(ed.labels.find((l) => l.name === 'O')).toMatchObject({ ghost: true });
    expect(stereoSvgString(ed)).not.toMatch(/>O<\/text>/);
    // вершину тела тоже можно скрыть
    const v = renderStereo(evaluateScene(setPointsHidden(sc, ['C1'])), DEFAULT_CAMERA, VP);
    expect(v.dots.some((d) => d.name === 'C1')).toBe(false);
    expect(setPointsHidden(sc, ['O'], false).hidden).toBeUndefined();
  });

  it('переименование, удаление шага и блок ```stereo переносят скрытие', () => {
    const sc = setPointsHidden(base(), ['O']);
    expect(renamePoint(sc, 'O', 'K').scene.hidden).toEqual(['K']);
    const { scene: cut } = removeOpCascade(sc, sc.ops[0].id);
    expect(cut.hidden).toBeUndefined();
    const text = buildStereoBlock(sc, DEFAULT_CAMERA).text;
    expect(text).toContain('скрыть O');
    expect(parseStereoBlock(text).scene.hidden).toEqual(['O']);
    expect(parseStereoBlock('куб 4\nскрыть Z').errors[0].message).toMatch(/Нет точки Z/);
  });

  it('инструмент «Скрыть» (K) — клик по точке', () => {
    expect(TOOLS.find((t) => t.key === 'hide').hot).toBe('K');
    const r = toolClick('hide', [], { point: 'O' }, evaluateScene(base()));
    expect(r.hide).toEqual({ name: 'O' });
  });
});

describe('редактор', () => {
  const enter = (input, value) => {
    fireEvent.change(input, { target: { value } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
    fireEvent.keyUp(input, { key: 'Enter', code: 'Enter', keyCode: 13 });
  };
  beforeEach(() => {
    localStorage.clear();
    const scene = {
      body: cube,
      ops: [{ id: 'a', type: 'intersect', name: 'O', l1: ['A', 'C'], l2: ['B', 'D'] }],
      colors: { O: 'red' },
      hidden: ['O'],
    };
    localStorage.setItem('stereo.editor.v1', JSON.stringify({ scene }));
  });

  it('черновик не теряет оформление (цвета и скрытые точки)', () => {
    render(<AntApp><StereoEditor /></AntApp>);
    fireEvent.keyDown(window, { key: 'o', code: 'KeyO' });
    expect(screen.getByText('Снять все').closest('button').disabled).toBe(false);
  });

  it('«Угол» (E) показывает подпись и дуги; команды угла и скрытия работают', () => {
    render(<AntApp><StereoEditor /></AntApp>);
    fireEvent.keyDown(window, { key: 'e', code: 'KeyE' });
    expect(screen.getByLabelText('Оформление угла')).toBeTruthy();
    const input = screen.getByLabelText('Строка команд');
    enter(input, 'угол A1BD α');
    expect(input.value).toBe('');
    expect(screen.getAllByText(/∠A₁BD = α/).length).toBeGreaterThan(0);
    enter(input, 'показать все');
    expect(input.value).toBe('');
    enter(input, 'скрыть Q');
    expect(screen.getByText(/Нет точки Q/)).toBeTruthy();
  });
});
