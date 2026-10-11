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
