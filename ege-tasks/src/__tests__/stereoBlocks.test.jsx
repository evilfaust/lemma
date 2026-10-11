import { describe, it, expect } from 'vitest';
import {
  buildBody, normalizeBodySpec, evaluateScene, tryAppendOp, parseCommand, renderStereo,
  DEFAULT_CAMERA, parseStereoBlock, buildStereoBlock, renamePoint, splitByVisibility, toolClick,
} from '../utils/stereo';
import { blocksVolume } from '../utils/stereo/blocks';
import { parseBodyLine, bodyLine } from '../utils/stereo/dsl';

// Ступенчатые многогранники («все двугранные углы прямые»): блоки на общей
// сетке, невыпуклая видимость, сечения кусками, имена вершин по координатам.

const L = { kind: 'blocks', boxes: [[0, 0, 0, 4, 3, 1], [0, 0, 1, 2, 3, 2]] };
const NOTCH = { kind: 'blocks', boxes: [[0, 0, 0, 4, 4, 4]], minus: [[2, 0, 2, 2, 2, 2]] };

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

describe('ступенчатое тело: топология', () => {
  it('L-образная призма: 12 вершин, 18 рёбер, объём 24', () => {
    const b = buildBody(L);
    expect([b.order.length, b.edges.length]).toEqual([12, 18]);
    expect(blocksVolume(b)).toBe(24);
  });

  it('куб с вырезанным углом: 14 вершин, 21 ребро, объём 56', () => {
    const b = buildBody(NOTCH);
    expect([b.order.length, b.edges.length]).toEqual([14, 21]);
    expect(blocksVolume(b)).toBe(56);
  });

  it('граница двух слитых блоков — не ребро (плоскость без излома)', () => {
    const b = buildBody({ kind: 'blocks', boxes: [[0, 0, 0, 2, 2, 2], [2, 0, 0, 2, 2, 2]] });
    expect([b.order.length, b.edges.length]).toEqual([8, 12]); // это просто параллелепипед 4×2×2
  });

  it('пустое тело — куб по умолчанию', () => {
    expect(normalizeBodySpec({ kind: 'blocks', boxes: [[0, 0, 0, 2, 2, 2]], minus: [[0, 0, 0, 2, 2, 2]] }).kind).toBe('cube');
  });
});

describe('ступенчатое тело: видимость', () => {
  it('отрезок за двумя столбами — два скрытых куска', () => {
    const b = buildBody({ kind: 'blocks', boxes: [[0, 0, 0, 1, 1, 3], [3, 0, 0, 1, 1, 3], [0, 4, 0, 4, 1, 1]] });
    // центр габаритов: x 0..4, y 0..5, z 0..3 → сдвиг (2, 2.5, 1.5)
    const A = { x: -3, y: 2.5 - 2.5 + 0.5, z: 1.5 - 1.5 };
    const B = { x: 3, y: A.y, z: A.z };
    const pieces = splitByVisibility(b, A, B, { x: 0, y: -1, z: 0 });
    expect(pieces.filter((p) => p.hidden)).toHaveLength(2);
  });

  it('у выреза пунктир есть, точки вне тела видны', () => {
    const fr = renderStereo(evaluateScene({ body: NOTCH, ops: [] }), DEFAULT_CAMERA, { width: 400, height: 360 });
    expect(fr.strokes.some((s) => s.hidden)).toBe(true);
    expect(fr.strokes.some((s) => !s.hidden)).toBe(true);
  });
});

describe('ступенчатое тело: имена, построения, сечения, жидкость', () => {
  it('вершины без имени скрыты; имя — по координате', () => {
    const md = evaluateScene({ body: L, ops: [] });
    expect(md.pointOrder.every((n) => md.points[n].concealed)).toBe(true);
    const r = parseStereoBlock('ступенчатый многогранник (0 0 0 4 3 1) (0 0 1 2 3 2)\nвершины A(0 0 0) B(4 0 0) C(2 3 3)');
    expect(r.errors).toEqual([]);
    const m2 = evaluateScene(r.scene);
    expect(['A', 'B', 'C'].every((n) => m2.points[n] && !m2.points[n].concealed)).toBe(true);
    expect(m2.points.A.pos.x).toBeCloseTo(-2); // центр габаритов в начале координат
    expect(parseStereoBlock('ступенчатый многогранник (0 0 0 4 3 1)\nвершины A(1 1 1)').errors[0].message).toMatch(/Нет вершины/);
  });

  it('переименование скрытой вершины даёт ей имя и показывает её', () => {
    const sc = { body: L, ops: [] };
    const md = evaluateScene(sc);
    const v = md.pointOrder[0];
    const r = renamePoint(sc, v, 'A');
    expect(r.error).toBeUndefined();
    const m2 = evaluateScene(r.scene);
    expect(m2.points.A.concealed).toBeFalsy();
  });

  it('отрезок, подпись длины, расстояние — по именованным вершинам', () => {
    const sc = parseStereoBlock('ступенчатый многогранник (0 0 0 4 3 1) (0 0 1 2 3 2)\nвершины A(0 0 0) C(2 3 3)\nAC\nподпись AC √22').scene;
    const md = evaluateScene(sc);
    expect(md.steps.every((s) => s.ok)).toBe(true);
    expect(md.steps[1].created.value).toBe('≈ 4,69'); // √(4 + 9 + 9)
  });

  it('сечение — куски по ячейкам, внутренние стороны не обводятся', () => {
    const sc = parseStereoBlock('ступенчатый многогранник (0 0 0 4 4 4) минус (2 0 2 2 2 2)\nвершины A(0 0 0) B(4 0 0) C(4 4 0) D(0 4 4)\nсечение ABD').scene;
    const md = evaluateScene(sc);
    expect(md.steps.every((s) => s.ok)).toBe(true);
    const pieces = md.polys.filter((p) => p.kind === 'section');
    expect(pieces.length).toBeGreaterThan(1);
    const outer = pieces.reduce((acc, p) => acc + p.pts.length - (p.skip?.length || 0), 0);
    const all = pieces.reduce((acc, p) => acc + p.pts.length, 0);
    expect(outer).toBeLessThan(all);
  });

  it('жидкость в ступенчатом сосуде', () => {
    const md = evaluateScene(build(['уровень 2'], L));
    expect(md.polys.filter((p) => p.kind === 'water').length).toBeGreaterThan(0);
  });

  it('инструмент по части грани без имён — понятная ошибка', () => {
    const md = evaluateScene({ body: L, ops: [] });
    const r = toolClick('plane', [], { face: { id: 'q0', verts: null } }, md);
    expect(r.error).toMatch(/нет вершин с именами/);
  });
});

describe('ступенчатое тело: текст', () => {
  it('строка тела туда и обратно', () => {
    for (const line of [
      'ступенчатый многогранник (0 0 0 4 3 1) (0 0 1 2 3 2)',
      'ступенчатый многогранник (0 0 0 4 4 4) минус (2 0 2 2 2 2)',
      'ступенчатый многогранник (0 0 0 4 3 1) все буквы',
    ]) expect(bodyLine(parseBodyLine(line))).toBe(line);
  });

  it('блок с именами вершин выгружается и читается обратно', () => {
    const r = parseStereoBlock('ступенчатый многогранник (0 0 0 4 3 1) (0 0 1 2 3 2)\nвершины A(0 0 0) C(2 3 3)\nAC');
    const text = buildStereoBlock(r.scene, DEFAULT_CAMERA).text;
    expect(text).toContain('вершины A(0 0 0) C(2 3 3)');
    expect(parseStereoBlock(text).errors).toEqual([]);
  });
});
