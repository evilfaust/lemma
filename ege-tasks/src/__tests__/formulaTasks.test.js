import { describe, it, expect } from 'vitest';
import { generateFormulaTask, FORMULA_TYPES, formulaTaskToRecord } from '../utils/stereo/formulaTasks';
import { GEN_BODY_KEYS } from '../utils/stereo/genBodies';
import {
  GEN_TYPES, generateGenTask, genTaskToRecord, genCodePrefix, familyOf,
} from '../utils/stereo/genTasks';
import { dist, sub, cross, dot, len } from '../utils/stereo/vec3';
import { parseStereoBlock } from '../utils/stereo/dsl';

// Задачи первой части (база №13, профиль №3). Ответ пересчитывается
// НЕЗАВИСИМО — по телу на чертеже движка: объём и площадь — по граням,
// длины — по искомому отрезку. Подписи длин сверяет сам генератор.

function faceArea(body, f) {
  const P = f.verts.map((v) => body.vertices[v]);
  let s = { x: 0, y: 0, z: 0 };
  for (let i = 1; i + 1 < P.length; i += 1) {
    const c = cross(sub(P[i], P[0]), sub(P[i + 1], P[0]));
    s = { x: s.x + c.x, y: s.y + c.y, z: s.z + c.z };
  }
  return len(s) / 2;
}

function bodyVolume(body) {
  return body.faces.reduce((acc, f) => acc + (faceArea(body, f) * dot(f.n, body.vertices[f.verts[0]])) / 3, 0);
}

function recompute(task) {
  const body = task.model.body;
  switch (task.type) {
    case 'fVolume': return bodyVolume(body);
    case 'fSurface': {
      const faces = /боковой/.test(task.statement) ? body.faces.filter((f) => Math.abs(f.n.z) < 0.999) : body.faces;
      const S = faces.reduce((acc, f) => acc + faceArea(body, f), 0);
      return /\\sqrt3\}\$\.$/.test(task.statement) ? S / Math.sqrt(3) : S;
    }
    case 'fLength':
    case 'fReverse': {
      const [a, b] = task.ask;
      return dist(task.model.points[a].pos, task.model.points[b].pos);
    }
    default: return null;
  }
}

const SEEDS = [11, 222, 3333, 44444, 555];

describe('задачи первой части: генерация по всем телам и уровням', () => {
  for (const type of Object.keys(FORMULA_TYPES)) {
    it(`${type}: каждое тело, каждый уровень — ответ конечной дробью и сходится с чертежом`, () => {
      for (const body of GEN_BODY_KEYS) {
        for (const level of [1, 2, 3]) {
          for (const seed of SEEDS) {
            const t = generateFormulaTask({ body, type, level, seed });
            expect({ body, level, seed, ok: !!t }).toEqual({ body, level, seed, ok: true });
            expect(Number.isFinite(t.answerValue)).toBe(true);
            expect(String(t.answerValue).split('.')[1]?.length || 0).toBeLessThanOrEqual(3);
            expect(t.model.steps.every((s) => s.ok)).toBe(true);
            const r = recompute(t);
            if (r != null) {
              expect({ body, level, seed, stmt: t.statement, v: Math.round(r * 1e6) / 1e6 })
                .toEqual({ body, level, seed, stmt: t.statement, v: Math.round(t.answerValue * 1e6) / 1e6 });
            }
            if (t.type === 'fLength' || t.type === 'fReverse') expect(t.ask).toHaveLength(2);
          }
        }
      }
    });
  }

  it('подписи на чертеже совпадают с данными условия', () => {
    const t = generateFormulaTask({ body: 'box', type: 'fVolume', level: 1, seed: 7 });
    const labels = t.scene.ops.filter((o) => o.type === 'lengthMark').map((o) => o.text);
    for (const l of labels) expect(t.statement).toContain(`= ${l}$`);
    expect(t.model.lengthMarks).toHaveLength(3);
  });

  it('«в 2 раза», «в 5 раз»', () => {
    const texts = [];
    for (let seed = 1; seed < 60; seed += 1) {
      const t = generateFormulaTask({ body: 'cube', type: 'fScale', level: 2, seed });
      texts.push(t.statement);
    }
    expect(texts.some((x) => /в \$[234]\$ раза\?/.test(x))).toBe(true);
    expect(texts.some((x) => /в \$5\$ раз\?/.test(x))).toBe(true);
    expect(texts.some((x) => /в \$[234]\$ раз\?/.test(x))).toBe(false);
  });
});

describe('задачи первой части в общем генераторе', () => {
  it('типы — в группе «Первая часть ЕГЭ», семейство formula', () => {
    for (const type of Object.keys(FORMULA_TYPES)) {
      expect(GEN_TYPES[type]).toMatchObject({ group: 'Первая часть ЕГЭ', family: 'formula' });
      expect(familyOf(type)).toBe('formula');
      expect(genCodePrefix(type)).toBe(FORMULA_TYPES[type].prefix);
    }
  });

  it('запись банка: чертёж с исходником, решение с блоком stereo читается', () => {
    const t = generateGenTask({ body: 'pyramid4', type: 'fLength', level: 2, seed: 5 });
    const rec = genTaskToRecord(t, { code: 'FL-1' });
    expect(rec).toMatchObject({ code: 'FL-1', section: 'stereo', origin: 'gen', answer: t.answer });
    expect(rec.drawing_svg).toContain('<!--stereo:');
    const block = /```stereo\n([\s\S]*?)\n```/.exec(rec.solution_md)[1];
    expect(parseStereoBlock(block).errors).toEqual([]);
    expect(formulaTaskToRecord(t).title).toMatch(/Диагональ, ребро, высота/);
  });
});
