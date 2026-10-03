import { describe, it, expect } from 'vitest';
import katex from 'katex';
import {
  generateMetricTask, metricTaskToRecord, METRIC_TYPES, formatAngle,
} from '../utils/stereo/metricTasks';
import {
  generateGenTask, genTaskToRecord, slotPlan, GEN_TYPES, familyOf,
} from '../utils/stereo/genTasks';
import { GEN_BODIES, scaleDims } from '../utils/stereo/genBodies';
import {
  Q, sqrtQ, surdLatex, lnorm2, vsub, polygonArea2, qnum,
} from '../utils/stereo/exact';
import { buildBody } from '../utils/stereo/bodies';
import { stereoSpecFromSvg, parseStereoBlock } from '../utils/stereo/dsl';
import {
  sub, dot, cross, len, dist,
} from '../utils/stereo/vec3';

// Все формулы текста проходят KaTeX (как в MathRenderer: trust не нужен)
function expectKatex(md, where) {
  const parts = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
  let m;
  while ((m = re.exec(md))) parts.push(m[1] || m[2]);
  for (const tex of parts) {
    expect(() => katex.renderToString(tex, { throwOnError: true }), `${where}: ${tex}`).not.toThrow();
  }
}

// Ответ, пересчитанный по чертежу движка (независимо от решётки)
function modelValue(task) {
  const P = (n) => task.model.points[n].pos;
  const angle = (c) => (Math.acos(Math.min(1, Math.abs(c))) * 180) / Math.PI;
  const normal = ([a, b, c]) => cross(sub(P(b), P(a)), sub(P(c), P(a)));
  const o = task.objects;
  switch (task.type) {
    case 'angleLines': {
      const u = sub(P(o[0][1]), P(o[0][0]));
      const v = sub(P(o[1][1]), P(o[1][0]));
      return angle(dot(u, v) / (len(u) * len(v)));
    }
    case 'angleLinePlane': {
      const u = sub(P(o[0][1]), P(o[0][0]));
      const n = normal(o[1]);
      return 90 - angle(dot(u, n) / (len(u) * len(n)));
    }
    case 'anglePlanes': {
      const a = normal(o[0]);
      const b = normal(o[1]);
      return angle(dot(a, b) / (len(a) * len(b)));
    }
    case 'distPointLine': {
      const u = sub(P(o[1][1]), P(o[1][0]));
      return len(cross(sub(P(o[0][0]), P(o[1][0])), u)) / len(u);
    }
    case 'distPointPlane': {
      const n = normal(o[1]);
      return Math.abs(dot(sub(P(o[0][0]), P(o[1][0])), n)) / len(n);
    }
    case 'distSkew': {
      const n = cross(sub(P(o[0][1]), P(o[0][0])), sub(P(o[1][1]), P(o[1][0])));
      return Math.abs(dot(sub(P(o[1][0]), P(o[0][0])), n)) / len(n);
    }
    case 'volume': {
      const [a, b, c, d] = o[0].map(P);
      return Math.abs(dot(cross(sub(b, a), sub(c, a)), sub(d, a))) / 6;
    }
    default:
      return NaN;
  }
}

describe('точная арифметика', () => {
  it('корни и дроби — «по-школьному»', () => {
    expect(surdLatex(sqrtQ(Q(8)))).toBe('2\\sqrt{2}');
    expect(surdLatex(sqrtQ(Q(3, 4)))).toBe('\\dfrac{\\sqrt{3}}{2}');
    expect(surdLatex(sqrtQ(Q(1, 3)))).toBe('\\dfrac{\\sqrt{3}}{3}');
    expect(surdLatex(sqrtQ(Q(144, 25)))).toBe('\\dfrac{12}{5}');
  });

  it('площадь единичного квадрата и правильного треугольника (ось y в √3)', () => {
    const sq = [[Q(0), Q(0), Q(0)], [Q(1), Q(0), Q(0)], [Q(1), Q(1), Q(0)], [Q(0), Q(1), Q(0)]];
    expect(qnum(polygonArea2([1, 1, 1], sq))).toBe(1);
    const tri = [[Q(0), Q(0), Q(0)], [Q(2), Q(0), Q(0)], [Q(1), Q(1), Q(0)]];
    expect(qnum(polygonArea2([1, 3, 1], tri))).toBeCloseTo(3, 12); // (√3)² при стороне 2
  });

  it('угол: табличный, arccos / arctg — что короче', () => {
    expect(formatAngle(Q(1, 4)).latex).toBe('60^\\circ');
    expect(formatAngle(Q(0)).latex).toBe('90^\\circ');
    expect(formatAngle(Q(1, 3)).latex).toBe('\\arctg \\sqrt{2}');
    expect(formatAngle(Q(1, 9)).latex).toBe('\\arccos \\dfrac{1}{3}');
    expect(formatAngle(Q(1, 9)).deg).toBeCloseTo((Math.acos(1 / 3) * 180) / Math.PI, 9);
  });
});

describe('тела: точные координаты конгруэнтны чертежу движка', () => {
  for (const [key, def] of Object.entries(GEN_BODIES)) {
    it(key, () => {
      let seed = 7;
      const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (let k = 0; k < 5; k += 1) {
        const dims = scaleDims(def.shape(rand), 2);
        const lat = def.lattice(dims);
        const body = buildBody(def.spec(dims));
        expect(lat.order).toEqual(body.order);
        for (const a of body.order) {
          for (const b of body.order) {
            const exact = Math.sqrt(qnum(lnorm2(lat.g, vsub(lat.vertices[a], lat.vertices[b]))));
            expect(exact, `${key} ${a}${b}`).toBeCloseTo(dist(body.vertices[a], body.vertices[b]), 9);
          }
        }
      }
    });
  }
});

describe('метрические задачи: ответ сходится с чертежом движка', () => {
  for (const body of Object.keys(GEN_BODIES)) {
    for (const type of Object.keys(METRIC_TYPES)) {
      it(`${body}, ${type}`, () => {
        for (const level of [1, 2, 3]) {
          for (let seed = 1; seed <= 4; seed += 1) {
            const t = generateMetricTask({ body, type, level, seed });
            const where = `${body} ${type} L${level} seed ${seed}`;
            expect(t, where).not.toBeNull();
            expect(t.model.steps.every((s) => s.ok), where).toBe(true);
            expect(modelValue(t), where).toBeCloseTo(t.answerValue, 6);
            // Уровень = какие точки даны
            if (level === 1) expect(t.given, where).toEqual([]);
            else expect(t.given.length, where).toBeGreaterThan(0);
            if (level === 3) {
              expect(t.given.some((g) => (g.kind === 'e' && g.ratio[0] !== g.ratio[1]) || (g.kind === 'c')), where).toBe(true);
            }
          }
        }
      });
    }
  }

  it('одно зерно — одно задание', () => {
    const a = generateMetricTask({ body: 'prism3', type: 'distSkew', level: 3, seed: 11 });
    const b = generateMetricTask({ body: 'prism3', type: 'distSkew', level: 3, seed: 11 });
    expect(a.statement).toBe(b.statement);
    expect(a.solutionScene).toEqual(b.solutionScene);
  });

  it('куб и тетраэдр в задаче на угол — без чисел, решение принимает ребро само', () => {
    const t = generateMetricTask({ body: 'cube', type: 'angleLines', level: 2, seed: 5 });
    expect(t.statement).toMatch(/^Дан куб/);
    expect(t.solutionText).toMatch(/примем ребро равным/);
  });

  it('пирамида с боковым ребром — в решении выведена высота', () => {
    let found = null;
    for (let seed = 1; seed <= 40 && !found; seed += 1) {
      const t = generateMetricTask({ body: 'pyramid4', type: 'distPointPlane', level: 2, seed });
      if (/боковое ребро/.test(t.statement)) found = t;
    }
    expect(found).not.toBeNull();
    expect(found.solutionText).toMatch(/Высота пирамиды \$SO = \\sqrt\{SA\^2 - OA\^2\}/);
  });

  it('угол между прямыми переносом: треугольник и теорема косинусов', () => {
    const t = generateMetricTask({ body: 'cube', type: 'angleLines', level: 1, seed: 3 });
    expect(t.solutionText).toMatch(/теореме косинусов/);
    expect(t.facets).not.toContain('Метод координат в пространстве');
  });
});

describe('задание → запись банка', () => {
  it('формулы рендерятся, блок решения разбирается целиком', () => {
    for (const body of ['cube', 'prism3', 'prism6', 'tetra', 'pyramid4', 'pyramid6']) {
      for (const type of Object.keys(METRIC_TYPES)) {
        const t = generateMetricTask({ body, type, level: 2, seed: 9 });
        const where = `${body} ${type}`;
        const rec = metricTaskToRecord(t);
        expect(rec).toMatchObject({ origin: 'gen', section: 'stereo', drawing_view: 'svg' });
        expectKatex(rec.statement_md, where);
        expectKatex(rec.answer, where);
        expectKatex(t.solutionText, where);
        const spec = stereoSpecFromSvg(rec.drawing_svg);
        expect(parseStereoBlock(spec).errors, where).toEqual([]);
        const block = /```stereo\n([\s\S]*?)\n```/.exec(rec.solution_md)[1];
        const parsed = parseStereoBlock(block);
        expect(parsed.errors, where).toEqual([]);
        expect(parsed.scene.ops, where).toHaveLength(t.solutionScene.ops.length);
        expect(rec.solution_md).toMatch(/\*\*Ответ:\*\*/);
        expect(rec.hints).toHaveLength(1);
      }
    }
  });
});

describe('общая точка входа', () => {
  it('типы по кругу, тела — после круга типов', () => {
    const types = ['angleLines', 'distSkew', 'volume'];
    const bodies = ['cube', 'pyramid4'];
    const plan = Array.from({ length: 6 }, (_, i) => slotPlan(types, bodies, i));
    expect(plan.map((p) => p.type)).toEqual([...types, ...types]);
    expect(plan.map((p) => p.body)).toEqual(['cube', 'cube', 'cube', 'pyramid4', 'pyramid4', 'pyramid4']);
  });

  it('каждый тип даёт задание и запись с фасетами', () => {
    for (const type of Object.keys(GEN_TYPES)) {
      const t = generateGenTask({ body: 'cube', type, level: 2, seed: 4 });
      expect(t, type).not.toBeNull();
      expect(t.family).toBe(familyOf(type));
      expect(t.tag).toBeTruthy();
      expect(t.facets[0]).toBe('Куб');
      expect(genTaskToRecord(t, { code: 'X-1' }).code).toBe('X-1');
    }
  });
});
