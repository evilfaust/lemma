import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App as AntApp } from 'antd';
import StereoEditor from '../components/stereo/StereoEditor';
import {
  buildBody, normalizeBodySpec, evaluateScene, renderStereo, DEFAULT_CAMERA, renamePoint, cameraBasis,
} from '../utils/stereo';
import { parseStereoBlock, buildStereoBlock, bodyLine } from '../utils/stereo/dsl';

// Обход основания сверху: знак z-компоненты площади (Гаусс). >0 — против часовой.
const orient = (body, names) => {
  const p = names.map((n) => body.vertices[n]);
  let s = 0;
  p.forEach((a, i) => { const b = p[(i + 1) % p.length]; s += a.x * b.y - b.x * a.y; });
  return Math.sign(s);
};
const len = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

// Все вершины — по внутреннюю сторону каждой грани (нормали наружу).
const convexOk = (body) => body.faces.every((f) => body.order.every((v) => {
  const P = body.vertices[v];
  return f.n.x * P.x + f.n.y * P.y + f.n.z * P.z <= f.d + 1e-9;
}));

describe('буквы основания по часовой стрелке', () => {
  it('куб: A спереди слева, B сзади слева, D спереди справа; обычный — наоборот', () => {
    const ccw = buildBody({ kind: 'cube', a: 4 });
    const cw = buildBody({ kind: 'cube', a: 4, cw: true });
    expect(orient(ccw, ['A', 'B', 'C', 'D'])).toBe(1);
    expect(orient(cw, ['A', 'B', 'C', 'D'])).toBe(-1);
    expect(orient(cw, ['A1', 'B1', 'C1', 'D1'])).toBe(-1);
    const { A, B, D } = cw.vertices;
    expect(A.x < 0 && A.y < 0).toBe(true);
    expect(B.x < 0 && B.y > 0).toBe(true);
    expect(D.x > 0 && D.y < 0).toBe(true);
    expect(cw.vertices.A1.x).toBe(A.x); // A₁ над A
    expect(convexOk(cw)).toBe(true);
  });

  it('параллелепипед: AB = a, AD = b и по часовой', () => {
    const cw = buildBody({ kind: 'box', a: 5, b: 3, c: 2, cw: true });
    expect(len(cw.vertices.A, cw.vertices.B)).toBeCloseTo(5, 9);
    expect(len(cw.vertices.A, cw.vertices.D)).toBeCloseTo(3, 9);
    expect(len(cw.vertices.A, cw.vertices.A1)).toBeCloseTo(2, 9);
    expect(convexOk(cw)).toBe(true);
  });

  it('призмы, пирамиды, тетраэдр: обход по часовой, нормали наружу', () => {
    for (const spec of [
      { kind: 'prism', n: 3 }, { kind: 'prism', n: 6 }, { kind: 'pyramid', n: 4 }, { kind: 'pyramid', n: 3 }, { kind: 'tetra' },
    ]) {
      const b = buildBody({ ...spec, a: 4, cw: true });
      const base = b.order.filter((n) => /^[A-Z]$/.test(n)).slice(0, spec.n || 3);
      expect({ spec, o: orient(b, base) }).toEqual({ spec, o: -1 });
      expect({ spec, ok: convexOk(b) }).toEqual({ spec, ok: true });
    }
  });

  it('сечение и видимость работают как обычно', () => {
    const sc = {
      body: { kind: 'cube', a: 4, cw: true },
      ops: [
        { id: 'm', type: 'pointOnLine', name: 'M', ref: ['A', 'A1'], t: 0.5 },
        { id: 's', type: 'section', pts: ['M', 'C1', 'B'] },
      ],
    };
    const m = evaluateScene(sc);
    expect(m.steps.every((st) => st.ok)).toBe(true);
    expect(m.polys[0].pts.length).toBeGreaterThanOrEqual(3);
    // По умолчанию смотрим спереди-справа-сверху: D (спереди справа внизу) виден, B (сзади слева внизу) — нет.
    const frame = renderStereo(m, DEFAULT_CAMERA, { width: 500, height: 400 });
    const dot = (n) => frame.dots.find((d) => d.name === n);
    expect(dot('D').hidden).toBe(false);
    expect(dot('B').hidden).toBe(true);
    expect(cameraBasis(DEFAULT_CAMERA).toViewer.z).toBeGreaterThan(0);
  });

  it('текст: «куб 4 по часовой» туда и обратно; «против часовой» — обычный', () => {
    expect(bodyLine({ kind: 'cube', a: 4, cw: true })).toBe('куб 4 по часовой');
    expect(bodyLine({ kind: 'pyramid', n: 4, a: 4, h: 5, apex: 'S', cw: true })).toBe('пирамида 4 4 5 S по часовой');
    const r = parseStereoBlock('куб 4 по часовой\nM на AB 1:1');
    expect(r.errors).toEqual([]);
    expect(r.scene.body.cw).toBe(true);
    expect(parseStereoBlock('куб 4 против часовой').scene.body.cw).toBeUndefined();
    expect(parseStereoBlock('куб 4').scene.body.cw).toBeUndefined();
    const back = parseStereoBlock(buildStereoBlock({ body: { kind: 'box', a: 5, b: 3, c: 2, cw: true }, ops: [] }).text);
    expect(back.scene.body).toMatchObject({ kind: 'box', a: 5, b: 3, cw: true });
  });

  it('переименование вершин сохраняет обход', () => {
    const r = renamePoint({ body: { kind: 'cube', a: 4, cw: true }, ops: [] }, 'A', 'K');
    expect(normalizeBodySpec(r.scene.body).cw).toBe(true);
    expect(buildBody(r.scene.body).vertices.K.y).toBeLessThan(0);
  });

  it('в окне «Новый чертёж» есть галочка', () => {
    localStorage.clear();
    render(<AntApp><StereoEditor /></AntApp>);
    fireEvent.click(screen.getByText('Новый чертёж'));
    expect(screen.getByText('Буквы основания по часовой стрелке')).toBeTruthy();
  });
});
