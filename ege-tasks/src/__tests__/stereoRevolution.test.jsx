import { describe, it, expect } from 'vitest';
import {
  buildBody, evaluateScene, tryAppendOp, parseCommand, renderStereo, DEFAULT_CAMERA,
  parseStereoBlock, buildStereoBlock, describeOp, opToCommand, isPointHidden, setPointsHidden, renamePoint,
  bodySpecFromForm, bodyFormValues,
} from '../utils/stereo';
import { parseBodyLine, bodyLine } from '../utils/stereo/dsl';
import { revolutionMeasures, rayThroughSphere } from '../utils/stereo/revolution';
import { dist } from '../utils/stereo/vec3';

// Тела вращения: цилиндр, конус, усечённый конус, шар.

const VP = { width: 400, height: 360 };

function build(cmds, body) {
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

describe('тела вращения: строение', () => {
  it('цилиндр: точки O, O1, A, A1 — по умолчанию без букв', () => {
    const md = evaluateScene({ body: { kind: 'cylinder', r: 2, h: 5 }, ops: [] });
    expect(md.pointOrder).toEqual(['O', 'O1', 'A', 'A1']);
    expect(md.pointOrder.every((n) => md.points[n].concealed)).toBe(true);
    expect(dist(md.points.O.pos, md.points.A.pos)).toBeCloseTo(2);
    expect(dist(md.points.A.pos, md.points.A1.pos)).toBeCloseTo(5);
  });

  it('«с буквами» — точки подписаны; «показать S» — подписать одну', () => {
    const md = evaluateScene({ body: { kind: 'cone', r: 2, h: 4, letters: true }, ops: [] });
    expect(md.points.S.concealed).toBeFalsy();
    const sc = setPointsHidden({ body: { kind: 'cone', r: 2, h: 4 }, ops: [] }, ['S'], false);
    expect(sc.shown).toEqual(['S']);
    const m2 = evaluateScene(sc);
    expect(m2.points.S.concealed).toBeFalsy();
    expect(m2.points.O.concealed).toBe(true);
  });

  it('контур: две образующие у цилиндра и конуса, окружность у шара', () => {
    const cyl = buildBody({ kind: 'cylinder', r: 2, h: 5 });
    expect(cyl.silhouette({ x: 0.3, y: -0.8, z: 0.5 })).toHaveLength(2);
    const cone = buildBody({ kind: 'cone', r: 2, h: 4 });
    expect(cone.silhouette({ x: 0.3, y: -0.8, z: 0.5 })).toHaveLength(2);
    expect(cone.silhouette({ x: 0, y: -0.1, z: 1 })).toHaveLength(0); // сверху — вершина внутри основания
    const sp = buildBody({ kind: 'sphere', r: 2 });
    expect(sp.silhouette({ x: 0, y: -1, z: 0 }).length).toBeGreaterThan(40);
  });

  it('видимость: задняя половина основания пунктиром, контур — сплошной', () => {
    const fr = renderStereo(evaluateScene({ body: { kind: 'cylinder', r: 2, h: 5 }, ops: [] }), DEFAULT_CAMERA, VP);
    const curve = fr.strokes.filter((s) => s.objId === 'curve:b');
    expect(curve.some((s) => s.hidden)).toBe(true);
    expect(curve.some((s) => !s.hidden)).toBe(true);
    expect(fr.strokes.filter((s) => s.objId.startsWith('sil:')).every((s) => !s.hidden)).toBe(true);
  });

  it('шар: точка за шаром скрыта, на ближней стороне — видна', () => {
    const b = buildBody({ kind: 'sphere', r: 2 });
    const v = { x: 0, y: -1, z: 0 };
    expect(isPointHidden(b, { x: 0, y: 2, z: 0 }, v)).toBe(true);
    expect(isPointHidden(b, { x: 0, y: -2, z: 0 }, v)).toBe(false);
    expect(rayThroughSphere(b.sphere, { x: 3, y: 0, z: 0 }, v, 1e-9)).toBe(false);
  });

  it('формулы объёма и площади', () => {
    const m = revolutionMeasures({ kind: 'cone', r: 3, h: 4 });
    expect(m.l).toBe(5);
    expect(m.V / Math.PI).toBeCloseTo(12);
    expect(m.S / Math.PI).toBeCloseTo(24);
    expect(revolutionMeasures({ kind: 'sphere', r: 3 }).V / Math.PI).toBeCloseTo(36);
  });
});

describe('тела вращения: построения', () => {
  it('точка на окружности по углу, сечение через вершину конуса', () => {
    const md = evaluateScene(build(['K на окружности O 120', 'сечение SAK'], { kind: 'cone', r: 3, h: 4 }));
    expect(md.steps.every((s) => s.ok)).toBe(true);
    expect(dist(md.points.O.pos, md.points.K.pos)).toBeCloseTo(3);
    expect(describeOp(md.steps[0].op)).toMatch(/на окружности с центром O, 120°/);
    expect(opToCommand(md.steps[0].op)).toBe('K на окружности O 120');
  });

  it('сечение шара — окружность', () => {
    const md = evaluateScene(build(['K на окружности O 0', 'M на OK 1:1', 'сечение M ⊥ OK'], { kind: 'sphere', r: 2 }));
    const sec = md.polys.find((p) => p.kind === 'section');
    expect(sec.pts.length).toBeGreaterThan(40);
    const c = md.points.M.pos;
    const rr = sec.pts.map((p) => dist(p, c));
    expect(Math.max(...rr) - Math.min(...rr)).toBeLessThan(1e-9);
    expect(rr[0]).toBeCloseTo(Math.sqrt(3));
  });

  it('жидкость в цилиндре и конусе', () => {
    for (const body of [{ kind: 'cylinder', r: 2, h: 5 }, { kind: 'cone', r: 2, h: 4 }, { kind: 'sphere', r: 2 }]) {
      const md = evaluateScene(build(['уровень 50%'], body));
      expect(md.polys.some((p) => p.kind === 'water')).toBe(true);
    }
  });

  it('переименование центра — окружность находится по новому имени', () => {
    const r = renamePoint({ body: { kind: 'cylinder', r: 2, h: 5 }, ops: [] }, 'O', 'Q');
    const md = evaluateScene(build(['K на окружности Q 45'], r.scene.body));
    expect(md.points.K).toBeTruthy();
  });
});

describe('тела вращения: текст и форма', () => {
  it('строки тела туда и обратно', () => {
    for (const line of ['цилиндр 2 5', 'конус 2 4 с буквами', 'усечённый конус 3 1.5 4', 'шар 2']) {
      expect(bodyLine(parseBodyLine(line))).toBe(line);
    }
    expect(parseBodyLine('сфера 3')).toMatchObject({ kind: 'sphere', r: 3 });
  });

  it('блок с построением читается обратно', () => {
    const r = parseStereoBlock('конус 3 4\nK на окружности O 120\nсечение SAK\nцвет');
    expect(r.errors).toEqual([]);
    expect(parseStereoBlock(buildStereoBlock(r.scene, DEFAULT_CAMERA).text).errors).toEqual([]);
  });

  it('форма «Новый чертёж»', () => {
    expect(bodySpecFromForm({ ...bodyFormValues({ kind: 'cube', a: 4 }), kind: 'cylinder', r: 3, h: 6 })).toMatchObject({ kind: 'cylinder', r: 3, h: 6 });
  });
});

// Плоскость основания тела вращения — ссылка по центру «(O)»: у круга нет
// трёх именованных точек, а перпендикуляр на нижнее основание нужен.
describe('плоскость основания тела вращения: «(O)»', () => {
  const cyl = { kind: 'cylinder', r: 4, h: 1.5 };

  it('перпендикуляр из точки верхнего круга на нижнее основание — командой', () => {
    const r = parseStereoBlock('цилиндр 4 1,5\nM в круге O1 120 0,9\nH = M ⊥ (O)');
    expect(r.errors).toEqual([]);
    expect(r.scene.ops[1]).toMatchObject({ type: 'perp', from: 'M', plane: ['O'], name: 'H' });
    const md = evaluateScene(r.scene);
    const { M, H } = md.points;
    expect(H.pos.z).toBeCloseTo(-0.75);
    expect(H.pos.x).toBeCloseTo(M.pos.x);
    expect(H.pos.y).toBeCloseTo(M.pos.y);
    expect(buildStereoBlock(r.scene, DEFAULT_CAMERA).text).toContain('H = M ⊥ (O)');
  });

  it('клик по кругу основания инструментом «Перпендикуляр»', async () => {
    const { toolClick } = await import('../utils/stereo');
    const sc = parseStereoBlock('цилиндр 4 1,5\nM в круге O1 120 0,9').scene;
    const md = evaluateScene(sc);
    const disk = md.body.faces.find((f) => f.surface === 'disk' && f.center === 'O');
    const step1 = toolClick('perp', [], { point: 'M' }, md);
    const step2 = toolClick('perp', step1.pending, { face: { id: disk.id, pos: { x: 0, y: 0, z: -0.75 }, surface: 'disk', center: 'O' } }, md);
    expect(step2.error).toBeUndefined();
    expect(step2.op).toMatchObject({ type: 'perp', from: 'M', plane: ['O'] });
    expect(opToCommand(step2.op)).toBe('H = M ⊥ (O)');
  });

  it('боковая поверхность плоскостью не считается — подсказка про основание', async () => {
    const { toolClick } = await import('../utils/stereo');
    const md = evaluateScene({ body: cyl, ops: [] });
    const side = md.body.faces.find((f) => f.surface === 'side');
    const r = toolClick('perp', [{ kind: 'point', name: 'O1' }], { face: { id: side.id, pos: { x: 4, y: 0, z: 0 }, surface: 'side', center: 'O' } }, md);
    expect(r.error).toMatch(/по основанию/);
  });

  it('угол с основанием и след на нём; нет такого центра — ошибка', () => {
    const r = parseStereoBlock('конус 3 4\nM на поверхности O 300 0,5\nугол MS (O)\nX = MS ∩ (O)');
    expect(r.errors).toEqual([]);
    expect(evaluateScene(r.scene).points.X.pos.z).toBeCloseTo(-2);
    const sc = { body: cyl, ops: [] };
    expect(parseCommand('H = O1 ⊥ (K)', evaluateScene(sc)).error).toBeTruthy();
  });
});

describe('открытые центры тел вращения в тексте блока', () => {
  it('«показать O1, O2» сохраняется при выгрузке в текст (раньше пропадало)', () => {
    let sc = parseStereoBlock('цилиндр 2 4\nи шар 2\nвершины O2O1AA1OA3\nотрезок O1O2').scene;
    sc = setPointsHidden(sc, ['O1', 'O', 'O2'], false);
    const text = buildStereoBlock(sc, DEFAULT_CAMERA).text;
    expect(text).toContain('показать O1, O, O2');
    const back = parseStereoBlock(text);
    expect(back.errors).toEqual([]);
    const md = evaluateScene(back.scene);
    expect(['O1', 'O', 'O2'].map((n) => md.points[n].concealed)).toEqual([undefined, undefined, undefined]);
    expect(md.points.A.concealed).toBe(true);
  });
});
