import { describe, it, expect } from 'vitest';
import {
  EXAM_TYPES, EXAM_SECTIONS, generateExamTask, examTaskToRecord,
} from '../utils/stereo/examTasks';
import { familyOf, generateGenTask, genCodePrefix, genTaskToRecord, GEN_TYPES } from '../utils/stereo/genTasks';
import { parseStereoBlock } from '../utils/stereo/dsl';
import { renderStereo, DEFAULT_CAMERA } from '../utils/stereo';
import { dist, sub, cross, dot, len } from '../utils/stereo/vec3';

// Каталог первой части ЕГЭ по типам экзамена (База №11, №13, Профиль №3).

const faceArea = (f, body) => {
  const P = f.pts3 || f.verts.map((v) => body.vertices[v]);
  let s = { x: 0, y: 0, z: 0 };
  for (let i = 1; i + 1 < P.length; i += 1) {
    const c = cross(sub(P[i], P[0]), sub(P[i + 1], P[0]));
    s = { x: s.x + c.x, y: s.y + c.y, z: s.z + c.z };
  }
  return len(s) / 2;
};
const volume = (body) => body.faces.reduce((a, f) => a + (faceArea(f, body) * dot(f.n, (f.pts3 || f.verts.map((v) => body.vertices[v]))[0])) / 3, 0);

// Типы, где на чертеже само искомое тело в настоящих размерах — объём по граням
const BY_VOLUME = ['b13_rightPrism', 'b13_regPyramidVolume', 'b13_specialPyramid', 'b11_stepsVolume'];

describe('каталог первой части', () => {
  it('три номера, у каждого типа — группа, подпись, фасет', () => {
    expect(EXAM_SECTIONS.map((s) => s.short)).toEqual(['Б11', 'Б13', 'П3']);
    for (const [k, t] of Object.entries(EXAM_TYPES)) {
      expect({ k, ok: !!(t.group && t.label && t.facet && t.gen) }).toEqual({ k, ok: true });
    }
    expect(Object.keys(EXAM_TYPES).length).toBeGreaterThanOrEqual(35);
  });

  for (const type of Object.keys(EXAM_TYPES)) {
    it(`${type}: задания на разных числах, ответ — конечная дробь, чертёж строится`, () => {
      const seen = new Set();
      for (let seed = 1; seed <= 30; seed += 1) {
        const t = generateExamTask({ type, seed: seed * 7919 });
        expect({ seed, ok: !!t }).toEqual({ seed, ok: true });
        expect(t.statement).not.toMatch(/undefined|NaN|\[object/);
        expect(Number.isFinite(t.answerValue)).toBe(true);
        expect(String(t.answerValue).split('.')[1]?.length || 0).toBeLessThanOrEqual(3);
        expect(t.model.steps.every((s) => s.ok)).toBe(true);
        if (t.ask) {
          const d = dist(t.model.points[t.ask[0]].pos, t.model.points[t.ask[1]].pos);
          expect(/квадрат расстояния/.test(t.statement) ? d * d : d).toBeCloseTo(t.answerValue, 6);
        }
        if (BY_VOLUME.includes(type) && /объём/.test(t.statement)) expect(volume(t.model.body)).toBeCloseTo(t.answerValue, 6);
        if (type === 'b13_pyramidLateral') {
          const side = t.model.body.faces.filter((f) => f.verts.includes('S')).reduce((a, f) => a + faceArea(f, t.model.body), 0);
          expect(side).toBeCloseTo(t.answerValue, 6);
        }
        seen.add(`${t.statement}|${t.answer}|${JSON.stringify(t.scene.body)}`);
      }
      expect(seen.size).toBeGreaterThan(3); // числа, сюжеты, тела меняются
      const fr = renderStereo(generateExamTask({ type, seed: 5 }).model, DEFAULT_CAMERA, { width: 360, height: 300 });
      expect(fr.strokes.length).toBeGreaterThan(0);
    });
  }
});

describe('каталог в общем генераторе', () => {
  it('семейство exam, в меню «второй части» его нет', () => {
    const k = 'b13_boxFaceDiag';
    expect(familyOf(k)).toBe('exam');
    expect(GEN_TYPES[k]).toBeUndefined();
    expect(genCodePrefix(k)).toBe('B13');
    expect(generateGenTask({ type: k, body: 'exam', level: 2, seed: 3 })).toMatchObject({ family: 'exam', type: k });
  });

  it('запись банка: номер в названии, решение с блоком stereo', () => {
    const t = generateExamTask({ type: 'b11_coneVessel', seed: 11 });
    const rec = genTaskToRecord(t, { code: 'B11-1' });
    expect(rec.title).toMatch(/^Б11\. Сосуды:/);
    expect(rec.drawing_svg).toContain('<!--stereo:');
    const block = /```stereo\n([\s\S]*?)\n```/.exec(rec.solution_md)[1];
    expect(parseStereoBlock(block).errors).toEqual([]);
    expect(examTaskToRecord(t).code).toMatch(/^Б11-/);
  });
});
