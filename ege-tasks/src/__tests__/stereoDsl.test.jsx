import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MathRenderer from '../shared/components/MathRenderer';
import {
  parseBodyLine, bodyLine, parseStereoBlock, buildStereoBlock, stereoSvgFromSpec,
  evaluateScene, parseCommand, opToCommand,
} from '../utils/stereo';

const strip = (ops) => ops.map(({ id, ...rest }) => rest);

describe('блок ```stereo', () => {
  it('строка тела', () => {
    expect(parseBodyLine('куб 4')).toEqual({ kind: 'cube', a: 4 });
    expect(parseBodyLine('призма 6 2 5')).toEqual({ kind: 'prism', n: 6, a: 2, h: 5 });
    expect(parseBodyLine('пирамида 3 a=4 h=6 D')).toEqual({ kind: 'pyramid', n: 3, a: 4, h: 6, apex: 'D' });
    expect(parseBodyLine('параллелепипед 4 3 2,5')).toEqual({ kind: 'box', a: 4, b: 3, c: 2.5 });
    expect(parseBodyLine('тетраэдр')).toEqual({ kind: 'tetra', a: 4, apex: 'D' });
    expect(parseBodyLine('M на AB')).toBeNull();
    for (const spec of [{ kind: 'cube', a: 5 }, { kind: 'prism', n: 3, a: 4, h: 4.8 }, { kind: 'pyramid', n: 4, a: 4, h: 4.4, apex: 'S' }]) {
      expect(parseBodyLine(bodyLine(spec))).toEqual(spec);
    }
  });

  it('разбор: тело, шаги с подписями, вид, размер, комментарии', () => {
    const r = parseStereoBlock([
      'пирамида 4',
      '# это комментарий',
      'M на SA 1:2 // делим боковое ребро',
      'N на SC',
      'сечение MNB',
      'вид 40 30 1,2',
      'размер 300',
    ].join('\n'));
    expect(r.errors).toEqual([]);
    expect(r.scene.body.kind).toBe('pyramid');
    expect(r.scene.ops.map((o) => o.type)).toEqual(['pointOnLine', 'pointOnLine', 'section']);
    expect(r.scene.ops[0].note).toBe('делим боковое ребро');
    expect(r.camera).toEqual({ yaw: 40, pitch: 30, zoom: 1.2 });
    expect(r.size).toEqual({ width: 300, height: 249 });
    expect(r.color).toBe(false);
  });

  it('ошибки — с номером строки, остальное строится', () => {
    const r = parseStereoBlock('куб\nM на AA1\nX = MC1 ∩ BD\nчто-то\nN на CC1');
    expect(r.errors.map((e) => e.line)).toEqual([3, 4]);
    expect(r.errors[0].message).toMatch(/скрещиваются/);
    expect(r.scene.ops.map((o) => o.name)).toEqual(['M', 'N']);
  });

  it('туда и обратно: сцена → текст → та же сцена', () => {
    const src = [
      'куб 4',
      'M на AA1 1:2 // от вершины A',
      'N на CC1',
      'K в грани ABB1A1 0.3 0.4',
      'прямая MN',
      'X = MN ∩ AC',
      'Y = MN ∩ (ABCD)',
      'прямая K || AB',
      'сечение MNB',
      'грань ABCD',
      'заливка MNB',
    ].join('\n');
    const a = parseStereoBlock(src);
    expect(a.errors).toEqual([]);
    const { text, skipped } = buildStereoBlock(a.scene, a.camera);
    expect(skipped).toBe(0);
    const b = parseStereoBlock(text);
    expect(b.errors).toEqual([]);
    expect(strip(b.scene.ops)).toEqual(strip(a.scene.ops));
    expect(b.camera).toEqual(a.camera);
  });

  it('точка в грани командой', () => {
    const m = evaluateScene({ body: { kind: 'cube', a: 4 }, ops: [] });
    const r = parseCommand('K в грани ABB1A1 0,25 0,5', m);
    expect(r.op).toMatchObject({ type: 'pointOnFace', name: 'K', face: ['A', 'B', 'B1', 'A1'], s: 0.25, t: 0.5 });
    expect(opToCommand(r.op)).toBe('K в грани ABB1A1 0.25 0.5');
  });

  it('SVG для печати — ч/б, «цвет» — цветной, ошибки подписаны', () => {
    const mono = stereoSvgFromSpec('куб\nM на AA1\nN на CC1\nMN');
    expect(mono).toContain('width="100%"');
    expect(mono).not.toContain('#1d4ed8');
    expect(mono).toContain('stroke-dasharray');
    const color = stereoSvgFromSpec('куб\nM на AA1\nN на CC1\nMN\nцвет');
    expect(color).toContain('#1d4ed8');
    expect(stereoSvgFromSpec('куб\nабракадабра')).toMatch(/строка 2/);
  });

  it('в тексте задачи блок становится картинкой', () => {
    const { container } = render(<MathRenderer text={'Постройте сечение:\n\n```stereo\nкуб\nM на AA1\n```\n'} />);
    const svg = container.querySelector('.mr-figure .stereo-svg');
    expect(svg).not.toBeNull();
    expect(svg.querySelectorAll('line').length).toBeGreaterThanOrEqual(12);
    expect(container.querySelector('pre')).toBeNull();
  });
});
