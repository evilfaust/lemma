import { describe, it, expect } from 'vitest';
import {
  generateSectionTask, verifySectionTask, exactCubeSectionArea, constructionSteps, SECTION_BODIES, texName,
  sectionTaskToRecord,
} from '../utils/stereo/sectionTasks';
import { stereoSpecFromSvg, parseStereoBlock } from '../utils/stereo/dsl';
import { buildBody } from '../utils/stereo/bodies';
import { planeFromPoints, sectionPolygon } from '../utils/stereo/geometry';
import { evaluateScene } from '../utils/stereo/scene';
import { sub, cross, add, len } from '../utils/stereo/vec3';

const polyArea = (pts) => {
  let s = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < pts.length; i += 1) s = add(s, cross(pts[i], pts[(i + 1) % pts.length]));
  return len(s) / 2;
};

describe('генератор сечений: построение подтверждает модель', () => {
  for (const body of Object.keys(SECTION_BODIES)) {
    for (const level of [1, 2, 3]) {
      it(`${body}, уровень ${level}`, () => {
        for (let seed = 1; seed <= 12; seed += 1) {
          const t = generateSectionTask({ body, level, seed });
          expect(t, `seed ${seed}`).not.toBeNull();
          expect(t.level).toBe(level);
          expect(verifySectionTask(t)).toBe(true);
          // уровень 1 — без следов и параллельных, 2–3 — с ними
          if (level === 1) expect(t.traces + t.parallels).toBe(0);
          else if (!t.given.some((g) => g.face)) expect(t.traces + t.parallels).toBeGreaterThan(0);
          expect(t.statement).toMatch(/Постройте сечение/);
          expect(t.answer).toMatch(/угольник/);
        }
      });
    }
  }

  it('одно и то же зерно — одно и то же задание', () => {
    const a = generateSectionTask({ body: 'cube', level: 3, seed: 42 });
    const b = generateSectionTask({ body: 'cube', level: 3, seed: 42 });
    expect(a.statement).toBe(b.statement);
    expect(a.solutionScene).toEqual(b.solutionScene);
  });

  it('рёбра в тексте — по-учебному, доля сходится с чертежом', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const t = generateSectionTask({ body: 'cube', level: 2, seed });
      for (const g of t.given) {
        const [u, v] = g.edge;
        expect(u.charCodeAt(0) < v.charCodeAt(0) || (u[0] === v[0] && u < v), `${u}${v}`).toBe(true);
        const op = t.scene.ops.find((o) => o.name === g.name);
        expect(op.ref).toEqual(g.edge);
        expect(op.t).toBeCloseTo(g.ratio[0] / (g.ratio[0] + g.ratio[1]));
      }
    }
    const pyr = generateSectionTask({ body: 'pyramid4', level: 2, seed: 5 });
    pyr.given.filter((g) => g.edge?.includes('S')).forEach((g) => expect(g.edge[0]).toBe('S'));
  });

  it('решение — шаги движка после данных точек, финальный шаг — сечение', () => {
    const t = generateSectionTask({ body: 'cube', level: 3, seed: 7 });
    const steps = constructionSteps(t);
    expect(steps.at(-1).type).toBe('section');
    expect(steps.some((s) => s.type === 'trace' || s.type === 'parallel')).toBe(true);
  });
});

describe('площадь сечения куба — точно', () => {
  it('треугольник через середины трёх рёбер у вершины: √3/2 при ребре 2', () => {
    const body = buildBody({ kind: 'cube', a: 4 });
    const given = [
      { edge: ['A', 'B'], ratio: [1, 1] },
      { edge: ['A', 'D'], ratio: [1, 1] },
      { edge: ['A', 'A1'], ratio: [1, 1] },
    ];
    const pos = given.map(({ edge }) => {
      const U = body.vertices[edge[0]];
      return add(U, { x: (body.vertices[edge[1]].x - U.x) / 2, y: (body.vertices[edge[1]].y - U.y) / 2, z: (body.vertices[edge[1]].z - U.z) / 2 });
    });
    const poly = sectionPolygon(body, planeFromPoints(pos[0], pos[1], pos[2], body.size));
    const r = exactCubeSectionArea(body, 2, given, poly);
    expect(r.latex).toBe('\\dfrac{\\sqrt{3}}{2}');
    expect(r.value).toBeCloseTo(Math.sqrt(3) / 2, 10);
  });

  it('совпадает с площадью по модели; ответы «школьные»', () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const t = generateSectionTask({ type: 'area', level: (seed % 3) + 1, seed });
      expect(t, `seed ${seed}`).not.toBeNull();
      expect(t.body).toBe('cube');
      expect(t.statement).toMatch(/Ребро куба .* равно \$\d+\$.*Найдите площадь сечения/);
      const model = evaluateScene(t.solutionScene);
      const poly = model.polys.find((p) => p.kind === 'section');
      // чертёж — тело в настоящих размерах условия
      expect(t.area.value).toBeCloseTo(polyArea(poly.pts), 6);
      const den = /\{(\d+)\}$/.exec(t.area.latex);
      if (t.area.latex.startsWith('\\dfrac')) expect(Number(den[1])).toBeLessThanOrEqual(4);
      const root = /\\sqrt\{(\d+)\}/.exec(t.area.latex);
      if (root) expect(Number(root[1])).toBeLessThanOrEqual(150);
      expect(t.answer).toBe(`$${t.area.latex}$`);
    }
  });

  it('площадь сечения призм, пирамид и тетраэдра — точно и по чертежу', () => {
    for (const body of Object.keys(SECTION_BODIES)) {
      for (const level of [1, 2]) {
        for (let seed = 1; seed <= 4; seed += 1) {
          const t = generateSectionTask({ body, type: 'area', level, seed });
          const where = `${body} L${level} seed ${seed}`;
          expect(t, where).not.toBeNull();
          expect(t.statement, where).toMatch(/Найдите площадь сечения/);
          expect(t.dims, where).toBeTruthy();
          const poly = evaluateScene(t.solutionScene).polys.find((p) => p.kind === 'section');
          expect(t.area.value, where).toBeCloseTo(polyArea(poly.pts), 6);
          expect(t.facets, where).toContain('Площадь сечения');
        }
      }
    }
  });

  it('имена с индексом — в LaTeX', () => {
    expect(texName('A1')).toBe('A_1');
    expect(texName('M')).toBe('M');
    expect(sub).toBeTypeOf('function');
  });
});

describe('задание → запись банка', () => {
  it('чертёж с исходником, решение — блок ```stereo, который разбирается целиком', () => {
    for (const [body, level, seed] of [['cube', 3, 3], ['cube', 2, 8], ['prism3', 3, 4], ['pyramid4', 2, 2], ['tetra', 3, 6]]) {
      const t = generateSectionTask({ body, level, seed });
      const rec = sectionTaskToRecord(t);
      expect(rec).toMatchObject({ origin: 'gen', section: 'stereo', drawing_view: 'svg', source: 'Генератор сечений' });
      const spec = stereoSpecFromSvg(rec.drawing_svg);
      expect(parseStereoBlock(spec).scene.ops).toHaveLength(t.scene.ops.length);
      const block = /```stereo\n([\s\S]*?)\n```/.exec(rec.solution_md)[1];
      const parsed = parseStereoBlock(block);
      expect(parsed.errors, `${body} ${level} ${seed}`).toEqual([]);
      expect(parsed.scene.ops).toHaveLength(t.solutionScene.ops.length);
      expect(rec.solution_md).toMatch(/\*\*Ответ:\*\*/);
      if (level > 1 && !t.given.some((g) => g.face)) expect(rec.hints).toHaveLength(1);
    }
  });
});
