import { describe, it, expect } from 'vitest';
import {
  evaluateScene, tryAppendOp, parseCommand, describeOp, opToCommand,
  renderStereo, toolClick, removeOpCascade, parseStereoBlock, buildStereoBlock, DEFAULT_CAMERA,
} from '../utils/stereo';
import { clipPolygonBelow } from '../utils/stereo/geometry';

// Жидкость в сосуде (шаг level): «уровень 3», «уровень 60%», «уровень через W».

const box = { kind: 'box', a: 6, b: 4, c: 5 };
const VP = { width: 400, height: 360 };

function build(cmds, body = box) {
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

const zOf = (md) => md.polys.find((p) => p.kind === 'water').pts[0].z;
const zmin = (md) => Math.min(...md.body.order.map((v) => md.body.vertices[v].z));

describe('уровень жидкости: разбор', () => {
  const m = evaluateScene({ body: box, ops: [] });
  it('высота, доля, через точку', () => {
    expect(parseCommand('уровень 3', m).op).toMatchObject({ type: 'level', h: 3 });
    expect(parseCommand('уровень 2,5', m).op.h).toBe(2.5);
    expect(parseCommand('уровень 60%', m).op.t).toBeCloseTo(0.6);
    expect(parseCommand('вода 3/5', m).op.t).toBeCloseTo(0.6);
    expect(parseCommand('уровень через W', m).op).toMatchObject({ through: 'W' });
    expect(parseCommand('уровень жидкости на высоте 2', m).op.h).toBe(2);
    expect(parseCommand('уровень много', m).error).toMatch(/Уровень жидкости/);
  });
  it('описание и обратно в команду', () => {
    const op = parseCommand('уровень 60%', m).op;
    expect(describeOp(op)).toBe('Уровень жидкости 60%');
    expect(opToCommand(op)).toBe('уровень 60%');
    expect(opToCommand(parseCommand('уровень через A1', m).op)).toBe('уровень через A1');
  });
});

describe('уровень жидкости: построение', () => {
  it('поверхность на нужной высоте, стенки ниже уровня', () => {
    const md = evaluateScene(build(['уровень 3']));
    expect(zOf(md) - zmin(md)).toBeCloseTo(3);
    expect(md.polys.filter((p) => p.kind === 'water')).toHaveLength(1);
    // 4 боковые стенки + дно
    expect(md.polys.filter((p) => p.kind === 'waterSide')).toHaveLength(5);
    expect(md.steps[0].created.note).toBe('Уровень жидкости: 3 от дна');
  });

  it('доля высоты и через точку дают ту же высоту', () => {
    const a = evaluateScene(build(['уровень 60%']));
    const b = evaluateScene(build(['W на AA1 3:2', 'уровень через W']));
    expect(zOf(a) - zmin(a)).toBeCloseTo(3);
    expect(zOf(b) - zmin(b)).toBeCloseTo(3);
  });

  it('пирамида: поверхность — уменьшенное основание', () => {
    const md = evaluateScene(build(['уровень 50%'], { kind: 'pyramid', n: 4, a: 4, h: 4, apex: 'S' }));
    const w = md.polys.find((p) => p.kind === 'water');
    expect(w.pts).toHaveLength(4);
  });

  it('выше сосуда и на дне — ошибка', () => {
    const sc = { body: box, ops: [] };
    const m = evaluateScene(sc);
    expect(tryAppendOp(sc, parseCommand('уровень 9', m).op).error).toMatch(/выше сосуда/);
    expect(tryAppendOp(sc, parseCommand('уровень 0', m).op).error).toMatch(/на самом дне/);
  });

  it('удаление точки уносит уровень через неё', () => {
    const sc = build(['W на AA1 3:2', 'уровень через W']);
    expect(removeOpCascade(sc, sc.ops[0].id).scene.ops).toHaveLength(0);
  });
});

describe('уровень жидкости: чертёж и инструмент', () => {
  it('закрашены только стенки, смотрящие на зрителя', () => {
    const md = evaluateScene(build(['уровень 3']));
    const fr = renderStereo(md, DEFAULT_CAMERA, VP);
    const sides = fr.polys.filter((p) => p.kind === 'waterSide');
    expect(sides.length).toBeGreaterThan(0);
    expect(sides.length).toBeLessThan(5);
    expect(fr.polys.some((p) => p.kind === 'water')).toBe(true);
    // контур поверхности — штрихами, сзади пунктиром
    expect(fr.strokes.some((s) => s.kind === 'section' && s.hidden)).toBe(true);
  });

  it('инструмент «Жидкость»: клик по ребру — высота места клика, по точке — через неё', () => {
    const model = evaluateScene(build(['W на AA1 3:2']));
    const r = toolClick('level', [], { line: { id: 'edge:B-B1', ref: ['B', 'B1'], t: 0.4, pos: model.points.W.pos } }, model);
    expect(r.op).toMatchObject({ type: 'level', h: 2 });
    expect(toolClick('level', [], { point: 'W' }, model).op).toMatchObject({ through: 'W' });
  });

  it('блок ```stereo: туда и обратно', () => {
    const r = parseStereoBlock('параллелепипед 6 4 5\nуровень 3\nцвет');
    expect(r.errors).toEqual([]);
    expect(buildStereoBlock(r.scene, DEFAULT_CAMERA).text).toContain('уровень 3');
  });

  it('clipPolygonBelow режет квадрат пополам', () => {
    const sq = [{ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, { x: 2, y: 0, z: 2 }, { x: 0, y: 0, z: 2 }];
    const out = clipPolygonBelow(sq, { n: { x: 0, y: 0, z: 1 }, d: 1 });
    expect(out).toHaveLength(4);
    expect(Math.max(...out.map((p) => p.z))).toBeCloseTo(1);
  });
});

// Сосуды цилиндрической формы (база №13, профиль №3): уровень в цилиндре и
// конусе, отметка «поднимется до…», два сосуда с разными уровнями.
describe('жидкость в телах вращения и в нескольких сосудах', () => {
  const FRONT = { yaw: 0, pitch: 15, zoom: 1 };

  it('цилиндр: поверхность на высоте от дна, стенки ниже уровня', () => {
    const md = evaluateScene(build(['уровень 2,5'], { kind: 'cylinder', r: 2, h: 4 }));
    expect(zOf(md)).toBeCloseTo(-2 + 2.5);
    expect(md.polys.find((p) => p.kind === 'water').pts.length).toBeGreaterThan(40);
    expect(md.polys.filter((p) => p.kind === 'waterSide').length).toBeGreaterThan(40);
  });

  it('конус вершиной вниз — воронка', () => {
    const md = evaluateScene(build(['уровень 50%'], { kind: 'cone', r: 2, h: 4, down: true }));
    expect(zOf(md)).toBeCloseTo(0);
  });

  it('инструмент «Жидкость» — клик по стенке цилиндра (рёбер у него нет)', () => {
    const model = evaluateScene({ body: { kind: 'cylinder', r: 2, h: 4 }, ops: [] });
    const side = model.body.faces.find((f) => f.surface === 'side');
    const r = toolClick('level', [], { face: { id: side.id, pos: { x: 2, y: 0, z: 1 }, surface: 'side', center: 'O' } }, model);
    expect(r.op).toMatchObject({ type: 'level', h: 3 });
    expect(r.op.part).toBeUndefined();
  });

  it('отметка уровня — пунктирное кольцо без заливки', () => {
    const sc = build(['уровень 2', 'отметка уровня 3'], { kind: 'cylinder', r: 2, h: 4 });
    expect(sc.ops[1]).toMatchObject({ type: 'level', h: 3, mark: true });
    const md = evaluateScene(sc);
    expect(md.polys.filter((p) => p.kind === 'levelMark')).toHaveLength(1);
    const fr = renderStereo(md, FRONT, VP);
    const ring = fr.strokes.filter((s) => s.objId.startsWith(`${sc.ops[1].id}:`));
    expect(ring.length).toBeGreaterThan(40);
    expect(ring.every((s) => s.hidden)).toBe(true);
    expect(fr.polys.some((p) => p.kind === 'levelMark')).toBe(false);
    // пунктир идёт одним узором вдоль кольца
    expect(ring.some((s) => s.dashOffset > 0)).toBe(true);
    expect(describeOp(sc.ops[1])).toBe('Отметка уровня 3');
    expect(opToCommand(sc.ops[1])).toBe('отметка уровня 3');
  });

  it('два сосуда — у каждого свой уровень от своего дна', () => {
    const r = parseStereoBlock('цилиндр 2 3\nи цилиндр 2,5 3 справа\nуровень 2 в теле 1\nуровень 0,8 в теле 2\nотметка уровня 2 в теле 2');
    expect(r.errors).toEqual([]);
    expect(r.scene.ops.map((o) => o.part)).toEqual([0, 1, 1]);
    const md = evaluateScene(r.scene);
    const water = md.polys.filter((p) => p.kind === 'water');
    expect(water).toHaveLength(2);
    const bottom = -1.5;
    expect(water[0].pts[0].z).toBeCloseTo(bottom + 2);
    expect(water[1].pts[0].z).toBeCloseTo(bottom + 0.8);
    // первый сосуд — слева, второй — справа: вода не перетекает
    expect(Math.max(...water[0].pts.map((p) => p.x))).toBeLessThan(Math.min(...water[1].pts.map((p) => p.x)));
    const text = buildStereoBlock(r.scene, DEFAULT_CAMERA).text;
    expect(text).toContain('уровень 0,8 в теле 2');
    expect(text).toContain('отметка уровня 2 в теле 2');
    expect(parseStereoBlock(text).scene.ops.map((o) => [o.h, o.part, !!o.mark])).toEqual([[2, 0, false], [0.8, 1, false], [2, 1, true]]);
  });

  it('клик по стенке второго сосуда — уровень в нём', () => {
    const model = evaluateScene(parseStereoBlock('цилиндр 2 3\nи цилиндр 2,5 3 справа').scene);
    const side = model.body.faces.find((f) => f.part === 1 && f.surface === 'side');
    const r = toolClick('level', [], { face: { id: side.id, pos: { x: 3, y: 0, z: -0.5 }, surface: 'side', center: 'O2' } }, model);
    expect(r.op).toMatchObject({ type: 'level', h: 1, part: 1 });
  });

  it('нет такого тела — понятная ошибка', () => {
    const sc = { body: { kind: 'cylinder', r: 2, h: 4 }, ops: [] };
    const r = parseCommand('уровень 2 в теле 2', evaluateScene(sc));
    expect(tryAppendOp(sc, r.op).error).toMatch(/Нет тела 2/);
  });
});
