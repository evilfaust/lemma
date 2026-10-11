import { describe, it, expect } from 'vitest';
import {
  evaluateScene, tryAppendOp, parseCommand, describeOp, opToCommand, renderStereo, DEFAULT_CAMERA,
  parseStereoBlock, buildStereoBlock, removeOpCascade, splitByVisibility,
} from '../utils/stereo';

// Чертёж без тела (kind: 'space'): точки по координатам, плоскости-листы,
// видимость под листом.

const space = { kind: 'space' };

function build(cmds, body = space) {
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

const TRAPEZOID = ['A = (0; 0; -2)', 'D = (8; 0; -2)', 'B = (2; 3; 3)', 'C = (6; 3; 3)', 'AB', 'BC', 'CD', 'DA',
  'M = середина AB', 'N = середина CD', 'MN', 'лист α через M'];

describe('чертёж без тела: разбор', () => {
  const m = evaluateScene({ body: space, ops: [] });
  it('точка по координатам', () => {
    expect(parseCommand('A = (0; 2,5; -1)', m).op).toMatchObject({ type: 'freePoint', name: 'A', at: [0, 2.5, -1] });
    expect(parseCommand('точка K (1 2 3)', m).op).toMatchObject({ type: 'freePoint', name: 'K', at: [1, 2, 3] });
  });
  it('лист: через три точки, горизонтально через точку, z = …, размер', () => {
    expect(parseCommand('лист α ABC', m).op).toMatchObject({ type: 'sheet', label: 'α', pts: ['A', 'B', 'C'] });
    expect(parseCommand('лист альфа через M', m).op).toMatchObject({ label: 'α', through: 'M' });
    expect(parseCommand('лист β z=0 8 6', m).op).toMatchObject({ label: 'β', z: 0, size: [8, 6] });
    expect(parseCommand('лист через M', m).op.label).toBeUndefined();
    expect(parseCommand('лист α', m).error).toMatch(/Лист:/);
  });
  it('описание и обратно в команду', () => {
    const op = parseCommand('лист α через M', m).op;
    expect(describeOp(op)).toMatch(/Плоскость α через M/);
    expect(opToCommand(op)).toBe('лист α через M');
    expect(opToCommand(parseCommand('A = (0; 2,5; -1)', m).op)).toBe('A = (0; 2,5; -1)');
  });
});

describe('чертёж без тела: построение и видимость', () => {
  it('трапеция пересекает α по MN: части под листом — пунктиром', () => {
    const md = evaluateScene(build(TRAPEZOID));
    expect(md.steps.every((s) => s.ok)).toBe(true);
    expect(md.sheets).toHaveLength(1);
    const fr = renderStereo(md, { yaw: 20, pitch: 25, zoom: 1 }, { width: 400, height: 360 });
    const hidden = fr.strokes.filter((s) => s.hidden && s.kind !== 'sheet');
    expect(hidden.length).toBeGreaterThan(0);
    expect(fr.angleTexts.some((t) => t.text === 'α')).toBe(true);
  });

  it('точка под листом скрыта, над ним и в нём — видна', () => {
    const md = evaluateScene(build(['лист α z=0 6 6', 'P = (0; 0; 2)', 'Q = (0; 0; -2)', 'R = (0; 0; 0)']));
    const v = { x: 0, y: -0.4, z: 0.9 };
    const occ = { ...md.body, sheets: md.sheets };
    const pieces = splitByVisibility(occ, md.points.P.pos, md.points.Q.pos, v);
    expect(pieces.map((p) => p.hidden)).toEqual([false, true]);
  });

  it('след прямой на листе — ссылкой «(α)»', () => {
    const md = evaluateScene(build(['A = (0; 0; 0)', 'B = (4; 0; 0)', 'C = (1; 3; 0)', 'лист α ABC', 'P = (2; 1; 3)', 'Q = (3; 2; -2)', 'PQ', 'X = PQ ∩ (α)']));
    expect(md.points.X.pos.z).toBeCloseTo(0);
  });

  it('удаление точки уносит лист через неё и след на нём', () => {
    const sc = build(['M = (0; 0; 1)', 'лист α через M', 'P = (0; 0; 3)', 'Q = (1; 1; -1)', 'X = PQ ∩ (α)']);
    expect(removeOpCascade(sc, sc.ops[0].id).scene.ops.map((o) => o.type)).toEqual(['freePoint', 'freePoint']);
  });

  it('лист и на теле: закрывает то, что под ним', () => {
    const md = evaluateScene(build(['лист α через A1'], { kind: 'cube', a: 4 }));
    expect(md.steps[0].ok).toBe(true);
  });

  it('пустой чертёж не падает', () => {
    const fr = renderStereo(evaluateScene({ body: space, ops: [] }), DEFAULT_CAMERA, { width: 300, height: 200 });
    expect(fr.strokes).toHaveLength(0);
  });
});

describe('чертёж без тела: блок ```stereo', () => {
  it('туда и обратно', () => {
    const r = parseStereoBlock(['пространство', ...TRAPEZOID].join('\n'));
    expect(r.errors).toEqual([]);
    const text = buildStereoBlock(r.scene, DEFAULT_CAMERA).text;
    expect(text.split('\n')[0]).toBe('пространство');
    expect(text).toContain('лист α через M');
    expect(parseStereoBlock(text).errors).toEqual([]);
  });
});
