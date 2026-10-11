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
