import { describe, it, expect } from 'vitest';
import {
  buildBody, bodyTitle, normalizeBodySpec, evaluateScene, tryAppendOp, parseCommand,
  renderStereo, DEFAULT_CAMERA, parseStereoBlock, buildStereoBlock, bodySpecFromForm, bodyFormValues,
} from '../utils/stereo';
import { parseBodyLine, bodyLine } from '../utils/stereo/dsl';
import { convexHull3 } from '../utils/stereo/hull';
import { dist } from '../utils/stereo/vec3';

// Тела по точкам: выпуклая оболочка (hull), октаэдр, пирамида сверху (roof),
// срезанные вершины (cut), «без букв» (bare).

const euler = (b) => b.order.length - b.edges.length + b.faces.length;
const p = (x, y, z) => ({ x, y, z });

describe('выпуклая оболочка', () => {
  it('куб: 8 вершин, 12 рёбер, 6 граней-квадратов; точка внутри отбрасывается', () => {
    const pts = [];
    for (const x of [0, 1]) for (const y of [0, 1]) for (const z of [0, 1]) pts.push(p(x, y, z));
    pts.push(p(0.5, 0.5, 0.5), p(0.5, 0, 0)); // центр и середина ребра
    const h = convexHull3(pts);
    expect(h.vertices).toHaveLength(8);
    expect(h.edges).toHaveLength(12);
    expect(h.faces).toHaveLength(6);
    expect(h.faces.every((f) => f.verts.length === 4)).toBe(true);
  });

  it('грани смотрят наружу, обход — против часовой снаружи', () => {
    const h = convexHull3([p(0, 0, 0), p(1, 0, 0), p(0, 1, 0), p(0, 0, 1)]);
    for (const f of h.faces) {
      const [a, b, c] = f.verts.map((i) => [p(0, 0, 0), p(1, 0, 0), p(0, 1, 0), p(0, 0, 1)][i]);
      const n = {
        x: (b.y - a.y) * (c.z - a.z) - (b.z - a.z) * (c.y - a.y),
        y: (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z),
        z: (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x),
      };
      expect(n.x * f.n.x + n.y * f.n.y + n.z * f.n.z).toBeGreaterThan(0);
    }
  });

  it('точки в одной плоскости — не тело', () => {
    expect(convexHull3([p(0, 0, 0), p(1, 0, 0), p(0, 1, 0), p(1, 1, 0)])).toBeNull();
    expect(normalizeBodySpec({ kind: 'hull', pts: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0]] }).kind).toBe('cube');
  });
});

describe('тела по точкам', () => {
  it('октаэдр: 6 вершин, 12 рёбер длины a, 8 граней', () => {
    const b = buildBody({ kind: 'octa', a: 4 });
    expect([b.order.length, b.edges.length, b.faces.length]).toEqual([6, 12, 8]);
    for (const [u, v] of b.edges) expect(dist(b.vertices[u], b.vertices[v])).toBeCloseTo(4);
    expect(bodyTitle({ kind: 'octa', a: 4 })).toBe('Октаэдр ABCDEF');
  });

  it('куб с пирамидой: 9 вершин, вершина S над центром верхней грани', () => {
    const b = buildBody({ kind: 'cube', a: 4, roof: 2 });
    expect([b.order.length, b.edges.length, b.faces.length]).toEqual([9, 16, 9]);
    const S = b.vertices.S;
    const A1 = b.vertices.A1;
    expect(S.z - A1.z).toBeCloseTo(2);
    expect(b.faces.some((f) => f.verts.join('') === 'A1B1C1D1')).toBe(false); // верхней грани больше нет
  });

  it('куб без вершин: 24 вершины, 36 рёбер, 14 граней, букв нет', () => {
    const b = buildBody({ kind: 'cube', a: 4, cut: 1 });
    expect([b.order.length, b.edges.length, b.faces.length]).toEqual([24, 36, 14]);
    const md = evaluateScene({ body: { kind: 'cube', a: 4, cut: 1 }, ops: [] });
    const fr = renderStereo(md, DEFAULT_CAMERA, { width: 400, height: 360 });
    expect(fr.labels).toHaveLength(0);
  });

  it('у всех — формула Эйлера', () => {
    for (const s of [
      { kind: 'octa', a: 3 }, { kind: 'box', a: 4, b: 3, c: 2, roof: 1.5 }, { kind: 'prism', n: 6, a: 2, h: 4, cut: 0.5 },
      { kind: 'tetra', a: 4, cut: 2 }, { kind: 'pyramid', n: 4, a: 4, h: 5, cut: 1 },
    ]) expect(euler(buildBody(s))).toBe(2);
  });

  it('сечение, видимость и жидкость работают на теле по точкам', () => {
    let sc = { body: { kind: 'octa', a: 4 }, ops: [] };
    for (const c of ['M на EA 1:1', 'N на EC 1:1', 'сечение MNB', 'уровень 50%']) {
      const r = tryAppendOp(sc, parseCommand(c, evaluateScene(sc)).op);
      expect({ c, error: r.error }).toEqual({ c, error: null });
      sc = r.scene;
    }
    const md = evaluateScene(sc);
    expect(md.polys.find((pg) => pg.kind === 'section').pts.length).toBeGreaterThanOrEqual(3);
    const fr = renderStereo(md, DEFAULT_CAMERA, { width: 400, height: 360 });
    expect(fr.strokes.some((s) => s.hidden)).toBe(true);
  });
});

describe('тела по точкам: текст и форма', () => {
  it('строки блока туда и обратно', () => {
    for (const line of [
      'октаэдр 4', 'куб 4 с пирамидой 2', 'куб 4 без вершин 1', 'параллелепипед 4 3 2 с пирамидой 1.5',
      'пирамида 4 4 5 S без букв', 'многогранник (0 0 0) (4 0 0) (4 4 0) (0 4 0) (2 2 3)',
      'многогранник K(0 0 0) L(4 0 0) M(0 4 0) N(0 0 4)',
    ]) {
      const spec = parseBodyLine(line);
      expect({ line, spec: spec && bodyLine(spec) }).toEqual({ line, spec: line });
    }
  });

  it('многогранник со своими именами точек', () => {
    const b = buildBody(parseBodyLine('многогранник K(0 0 0) L(4 0 0) M(0 4 0) N(0 0 4)'));
    expect(b.order).toEqual(['K', 'L', 'M', 'N']);
  });

  it('блок с многогранником строит сечение', () => {
    const r = parseStereoBlock('многогранник (0 0 0) (4 0 0) (4 4 0) (0 4 0) (2 2 3)\nсечение ABE');
    expect(r.errors).toEqual([]);
    expect(buildStereoBlock(r.scene, DEFAULT_CAMERA).text.split('\n')[0]).toBe('многогранник (0 0 0) (4 0 0) (4 4 0) (0 4 0) (2 2 3)');
  });

  it('форма: пирамида сверху и срез вершин переживают круг', () => {
    const spec = bodySpecFromForm({ ...bodyFormValues({ kind: 'cube', a: 4 }), roof: 2 });
    expect(spec).toMatchObject({ kind: 'cube', roof: 2 });
    expect(bodySpecFromForm({ ...bodyFormValues(spec), roof: 0, cut: 1 })).toMatchObject({ kind: 'cube', cut: 1 });
    expect(bodySpecFromForm({ ...bodyFormValues(spec), roof: 0 }).roof).toBeUndefined();
  });
});
