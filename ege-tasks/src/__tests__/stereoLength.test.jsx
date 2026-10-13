import { describe, it, expect } from 'vitest';
import {
  evaluateScene, tryAppendOp, parseCommand, describeOp, opToCommand,
  renderStereo, stereoSvgString, toolClick, removeOpCascade, renamePointInScene,
  parseStereoBlock, buildStereoBlock, DEFAULT_CAMERA, lengthLabelText, lengthTextRuns,
  contentBox,
} from '../utils/stereo';

// Подпись длины (шаг lengthMark): «подпись AB 4», «AB = 4», размерная
// стрелка «стрелка AA1 h».

const cube = { kind: 'cube', a: 4 };
const pyramid = { kind: 'pyramid', n: 4, a: 4, h: 5, apex: 'S' };
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

describe('подпись длины: разбор', () => {
  const m = evaluateScene({ body: cube, ops: [] });

  it('«подпись AB 4», «длина AB 4», «AB = 4»', () => {
    expect(parseCommand('подпись AB 4', m).op).toMatchObject({ type: 'lengthMark', ref: ['A', 'B'], text: '4' });
    expect(parseCommand('длина AA1 2,5', m).op).toMatchObject({ ref: ['A', 'A1'], text: '2,5' });
    expect(parseCommand('AB = 4', m).op).toMatchObject({ type: 'lengthMark', ref: ['A', 'B'], text: '4' });
    expect(parseCommand('|AC| = 4√2', m).op).toMatchObject({ ref: ['A', 'C'], text: '4√2' });
    expect(parseCommand('подпись АВ 4', m).op.ref).toEqual(['A', 'B']); // кириллица-двойник
  });

  it('подпись — буквы не становятся именами точек, корень пишется как угодно', () => {
    expect(parseCommand('подпись SO h', m).op.text).toBe('h');
    expect(parseCommand('AB = a', m).op.text).toBe('a');
    expect(lengthLabelText('\\sqrt{17}')).toBe('√17');
    expect(lengthLabelText('sqrt17')).toBe('√17');
    expect(lengthLabelText('корень из 17')).toBe('√17');
    expect(lengthLabelText('2\\sqrt{3}')).toBe('2√3');
    expect(lengthLabelText('\\frac{a}{2}')).toBe('\\frac{a}{2}'); // дробь — столбиком, формулой
    expect(lengthLabelText('\\pi')).toBe('π');
  });

  it('стрелкой: «стрелка AA1 h», «размер AA1 h»', () => {
    expect(parseCommand('стрелка AA1 h', m).op).toMatchObject({ type: 'lengthMark', ref: ['A', 'A1'], text: 'h', dim: true });
    expect(parseCommand('размер AA1 h', m).op.dim).toBe(true);
  });

  it('чужие команды с «=» не перехватываются', () => {
    expect(parseCommand('X = MN ∩ AC', m).op?.type).not.toBe('lengthMark');
    expect(parseCommand('O = середина AC1', m).op.type).toBe('pointOnLine');
    expect(parseCommand('подпись A 4', m).error).toMatch(/двух точек/);
  });

  it('описание и обратно в команду', () => {
    const op = parseCommand('подпись AC 4√2', m).op;
    expect(describeOp(op)).toBe('Подпись AC = 4√2');
    expect(opToCommand(op)).toBe('подпись AC 4√2');
    const d = parseCommand('стрелка AA1 h', m).op;
    expect(describeOp(d)).toBe('Размер AA₁ = h');
    expect(opToCommand(d)).toBe('стрелка AA1 h');
  });
});

describe('подпись длины: построение', () => {
  it('отрезка нет — дорисуется; ребро второй раз не рисуется', () => {
    const md = evaluateScene(build(['подпись AC 4√2', 'подпись AB 4']));
    expect(md.lengthMarks).toHaveLength(2);
    expect(md.lines.filter((l) => l.step === 0 && l.kind === 'segment')).toHaveLength(1);
    expect(md.lines.filter((l) => l.step === 1)).toHaveLength(0);
    expect(md.steps[0].created.value).toBe('≈ 5,66');
    expect(md.steps[0].created.note).toMatch(/AC = 4√2/);
  });

  it('стрелка не рисует сам отрезок', () => {
    const md = evaluateScene(build(['K на AA1 1:1', 'стрелка AK h']));
    expect(md.lines.filter((l) => l.step === 1)).toHaveLength(0);
    expect(md.lengthMarks[0]).toMatchObject({ dim: true, text: 'h' });
  });

  it('высота пирамиды: основание в центре, подпись h', () => {
    const md = evaluateScene(build(['O = S ⊥ (ABC)', 'подпись SO h'], pyramid));
    expect(md.steps.every((s) => s.ok)).toBe(true);
    expect(md.lengthMarks[0].text).toBe('h');
  });

  it('нет точки — понятная ошибка', () => {
    const r = tryAppendOp({ body: cube, ops: [] }, parseCommand('подпись AX 4', evaluateScene({ body: cube, ops: [] })).op);
    expect(r.error).toMatch(/Нет точки X/);
  });

  it('удаление точки уносит подпись, переименование её сохраняет', () => {
    const sc = build(['K на AA1 1:1', 'подпись AK 2']);
    expect(removeOpCascade(sc, sc.ops[0].id).scene.ops).toHaveLength(0);
    const renamed = renamePointInScene(sc, 'K', 'W');
    expect(renamed.ops[1].ref).toEqual(['A', 'W']);
    expect(evaluateScene(renamed).steps.every((s) => s.ok)).toBe(true);
  });
});

describe('подпись длины: чертёж', () => {
  it('подпись снаружи тела и в SVG', () => {
    const md = evaluateScene(build(['подпись AB 4']));
    const fr = renderStereo(md, DEFAULT_CAMERA, VP);
    expect(fr.lengthTexts).toHaveLength(1);
    const t = fr.lengthTexts[0];
    const c = fr.project(md.center);
    const a = fr.project(md.points.A.pos);
    const b = fr.project(md.points.B.pos);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    // от центра тела подпись дальше, чем середина ребра
    expect(Math.hypot(t.x - c.x, t.y - c.y)).toBeGreaterThan(Math.hypot(mid.x - c.x, mid.y - c.y));
    const svg = stereoSvgString(fr, { mono: true });
    expect(svg).toMatch(/font-family="KaTeX_Main[^"]*"[^>]*>4<\/text>/);
    expect(contentBox(fr).w).toBeGreaterThan(0);
  });

  it('корень — с чертой над подкоренным, буквы курсивом', () => {
    expect(lengthTextRuns('4√2')).toEqual([
      { text: '4√', italic: false, over: false },
      { text: '2', italic: false, over: true },
    ]);
    expect(lengthTextRuns('a√3')).toEqual([
      { text: 'a', italic: true, over: false },
      { text: '√', italic: false, over: false },
      { text: '3', italic: false, over: true },
    ]);
    const svg = stereoSvgString(renderStereo(evaluateScene(build(['подпись AC 4√2'])), DEFAULT_CAMERA, VP));
    // знак корня с чертой — линией (<path>), а не символом с подчёркиванием
    expect(svg).toMatch(/<path d="M[^"]*" fill="none"[^>]*\/>/);
    expect(svg).toMatch(/>2<\/text>/);
  });

  it('стрелка — выносные линии, размерная и стрелки; в клик не попадают', () => {
    const fr = renderStereo(evaluateScene(build(['стрелка AA1 h'])), DEFAULT_CAMERA, VP);
    const dims = fr.strokes.filter((s) => s.kind === 'dim');
    expect(dims).toHaveLength(7); // 2 выносные + размерная + 2×2 стрелки
    expect(dims.every((s) => !s.hidden)).toBe(true);
    expect(fr.hits.lines.some((l) => l.kind === 'dim')).toBe(false);
  });
});

describe('подпись длины: инструмент и блок', () => {
  it('инструмент «Длина»: клик по ребру — подпись куска между точками', () => {
    const model = evaluateScene(build(['K на AA1 1:1']));
    const line = model.lines.find((l) => l.id === 'edge:A-A1');
    const A = model.points.A.pos;
    const K = model.points.K.pos;
    const pos = { x: (A.x + K.x) / 2, y: (A.y + K.y) / 2, z: (A.z + K.z) / 2 };
    const r = toolClick('length', [], { line: { id: line.id, ref: line.ref, p: line.p, u: line.u, pos } }, model);
    expect(r.op).toMatchObject({ type: 'lengthMark', ref: ['A', 'K'] });
    const r2 = toolClick('length', [{ kind: 'point', name: 'A' }], { point: 'C' }, model);
    expect(r2.op.ref).toEqual(['A', 'C']);
  });

  it('блок ```stereo: туда и обратно', () => {
    const text = 'куб 4\nAB = 4\nстрелка AA1 h\nподпись AC 4√2';
    const r = parseStereoBlock(text);
    expect(r.errors).toEqual([]);
    expect(r.scene.ops.map((o) => o.type)).toEqual(['lengthMark', 'lengthMark', 'lengthMark']);
    const back = buildStereoBlock(r.scene, DEFAULT_CAMERA).text;
    expect(back).toContain('подпись AB 4');
    expect(back).toContain('стрелка AA1 h');
    expect(parseStereoBlock(back).scene.ops).toHaveLength(3);
  });
});
