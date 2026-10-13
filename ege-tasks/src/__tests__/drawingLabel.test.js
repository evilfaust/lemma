// Подписи-формулы на чертежах (utils/drawingLabel), штрихи в именах точек
// планиметрии и надписи стереометрии (шаг «текст»).

import { describe, it, expect } from 'vitest';
import { drawingLabelTex, drawingLabelSvg, measureDrawingLabel } from '../utils/drawingLabel';
import { parsePlanimBlock, planimSvgFromSpec } from '../utils/planim/dsl';
import { evaluateScene as evalPlanim, renamePoint as renamePlanim } from '../utils/planim/scene';
import { prettyName, splitNames } from '../utils/planim/refs';
import { normalizeCommand } from '../utils/planim/commands';
import {
  parseStereoBlock, buildStereoBlock, evaluateScene, renderStereo, stereoSvgString,
  parseCommand, describeOp, opToCommand, removeOpCascade, renamePointInScene, DEFAULT_CAMERA,
} from '../utils/stereo';
import { splitLabel } from '../utils/stereo/render';

describe('drawingLabelTex — старый «простой» синтаксис → LaTeX', () => {
  it.each([
    ['1/2', '\\frac{1}{2}'],
    ['a/2', '\\frac{a}{2}'],
    ['(a+b)/2', '\\frac{a+b}{2}'],
    ['2√3/3', '\\frac{2\\sqrt{3}}{3}'],
    ['\\sqrt{3}/2', '\\frac{\\sqrt{3}}{2}'],
    ['sqrt(3)', '\\sqrt{3}'],
    ['a√3', 'a\\sqrt{3}'],
    ['√(a+b)', '\\sqrt{a+b}'],
    ['альфа', '\\alpha'],
    ['2 alpha', '2 \\alpha'],
    ['0,5', '0{,}5'],
    ['$\\frac{\\pi}{3}$', '\\frac{\\pi}{3}'],
    ['60°', '60°'],
    ['6 см', '6 см'],
    ['пирамида', 'пирамида'], // «пи» — только отдельным словом
  ])('%s → %s', (src, tex) => {
    expect(drawingLabelTex(src)).toBe(tex);
  });

  it('дробь — столбиком: черта и числитель над знаменателем', () => {
    const svg = drawingLabelSvg('a/2', 50, 40, { size: 15 });
    expect(svg).toMatch(/<line [^>]*stroke="#111827"/);
    const ys = [...svg.matchAll(/<text [^>]*y="([\d.]+)"[^>]*>([^<]*)</g)].map((m) => [m[2], Number(m[1])]);
    const a = ys.find(([t]) => t === 'a')[1];
    const two = ys.find(([t]) => t === '2')[1];
    expect(a).toBeLessThan(two);
  });

  it('дробь выше строки, но не шире «a/2» строкой', () => {
    const frac = measureDrawingLabel('a/2');
    const line = measureDrawingLabel('a');
    expect(frac.ascent + frac.descent).toBeGreaterThan(line.ascent + line.descent + 5);
    expect(frac.width).toBeLessThan(20);
  });

  it('подложка — тот же набор белым и толще', () => {
    const svg = drawingLabelSvg('x', 0, 0, { halo: true });
    expect(svg).toMatch(/<text stroke="#ffffff" stroke-width="3"/);
    expect(svg).toMatch(/fill="#111827">x</);
  });
});

describe('планиметрия: штрихи в именах точек', () => {
  it('A\', A1\', A\'\' — имена; ′ и ’ понимаются как \'', () => {
    expect(splitNames("A'B'")).toEqual(["A'", "B'"]);
    expect(splitNames("AA1'C''")).toEqual(['A', "A1'", "C''"]);
    expect(normalizeCommand('A′B′')).toBe("A'B'");
    expect(normalizeCommand('a’ = (1; 2)')).toBe("A' = (1;2)");
    expect(prettyName("A1'")).toBe('A₁′');
  });

  it('построения со штрихами и подпись A′ на чертеже', () => {
    const spec = [
      'A = (0; 0)', 'B = (4; 0)', 'C = (1; 3)', "A' = (5; 2)", "C' = (7; 4)",
      'многоугольник ABC', "AA'", "CC'", "X = AA' ∩ BC", "M на A'C' 1:1",
    ].join('\n');
    const r = parsePlanimBlock(spec);
    expect(r.errors).toEqual([]);
    const md = evalPlanim(r.scene);
    expect(md.steps.every((s) => s.ok)).toBe(true);
    expect(md.points["A'"]).toBeTruthy();
    const svg = planimSvgFromSpec(spec, { maxWidth: 400 });
    expect(typeof svg === 'string' ? svg : svg.svg).toContain('>A′<');
  });

  it('переименование в имя со штрихом', () => {
    const r = parsePlanimBlock('A = (0; 0)\nB = (3; 0)\nAB');
    const res = renamePlanim(r.scene, 'B', "A'");
    expect(res.error).toBeFalsy();
    expect(evalPlanim(res.scene).points["A'"]).toBeTruthy();
  });

  it('буква: штрих — у буквы, индекс — внизу', () => {
    expect(splitLabel("A1'")).toEqual({ base: 'A′', sub: '1' });
    expect(splitLabel("B''")).toEqual({ base: 'B′′', sub: '' });
  });

  it('подпись отрезка дробью — в SVG формулой', () => {
    const svg = planimSvgFromSpec('треугольник ABC 5 6 7\nдлина AB \\frac{a}{2}\nугол BAC \\frac{\\pi}{3}', { maxWidth: 400 });
    const s = typeof svg === 'string' ? svg : svg.svg;
    expect(s).not.toContain('frac');
    expect(s).toMatch(/>π</);
  });
});

describe('стереометрия: надписи (шаг «текст»)', () => {
  const VP = { width: 400, height: 360 };

  it('разбор: у точки и в точке пространства, LaTeX не трогается', () => {
    const m = evaluateScene(parseStereoBlock('куб 4').scene);
    const near = parseCommand('текст у C1 вершина', m).op;
    expect(near).toMatchObject({ type: 'text', near: 'C1', text: 'вершина' });
    const at = parseCommand('надпись (0; 0; 3) V = \\frac{1}{3}Sh', m).op;
    expect(at).toMatchObject({ type: 'text', at: [0, 0, 3], text: 'V = \\frac{1}{3}Sh' });
    expect(parseCommand('текст ABC', m).error).toMatch(/Надпись/);
    expect(describeOp(near)).toBe('Надпись у C₁: вершина');
    expect(opToCommand(at)).toBe('текст (0; 0; 3) V = \\frac{1}{3}Sh');
  });

  it('блок: туда и обратно, на чертеже — формулой', () => {
    const src = 'куб 4\nтекст у C1 вершина\nтекст (0; 0; 3) \\frac{a}{2}\nподпись AB \\frac{a}{2}';
    const r = parseStereoBlock(src);
    expect(r.errors).toEqual([]);
    const back = parseStereoBlock(buildStereoBlock(r.scene).text);
    expect(back.scene.ops.map((o) => o.type)).toEqual(['text', 'text', 'lengthMark']);
    const md = evaluateScene(r.scene);
    expect(md.texts).toHaveLength(2);
    const fr = renderStereo(md, DEFAULT_CAMERA, VP);
    const texts = fr.angleTexts.filter((t) => t.id.endsWith(':txt'));
    expect(texts).toHaveLength(2);
    const svg = stereoSvgString(fr);
    expect(svg).toContain('>вершина<');
    expect(svg).not.toContain('frac');
  });

  it('надпись у точки не садится на её букву', () => {
    const fr = renderStereo(evaluateScene(parseStereoBlock('куб 4\nтекст у C1 вершина').scene), DEFAULT_CAMERA, VP);
    const t = fr.angleTexts.find((x) => x.id.endsWith(':txt'));
    const l = fr.labels.find((x) => x.name === 'C1');
    const ox = Math.min(t.x + t.w / 2, l.x + l.w / 2) - Math.max(t.x - t.w / 2, l.x - l.w / 2);
    const oy = Math.min(t.y + t.h / 2, l.y + l.h / 2) - Math.max(t.y - t.h / 2, l.y - l.h / 2);
    expect(ox > 0 && oy > 0).toBe(false);
  });

  it('переименование и удаление точки уносят надпись', () => {
    const r = parseStereoBlock('куб 4\nM на AB 1:1\nтекст у M середина');
    const renamed = renamePointInScene(r.scene, 'M', 'K');
    expect(renamed.ops[1].near).toBe('K');
    const { scene, removed } = removeOpCascade(r.scene, r.scene.ops[0].id);
    expect(removed).toHaveLength(2);
    expect(scene.ops).toHaveLength(0);
  });
});
