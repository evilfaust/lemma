import { describe, it, expect } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { Form } from 'antd';
import StereoBodiesForm from '../components/stereo/StereoBodiesForm';
import { dimensionValue } from '../utils/stereo/dimensions';
import { dimensionRules } from '../components/stereo/StereoDimensionInput';
import {
  bodyFormValues, bodySpecFromForm, normalizeBodySpec, parseBodyLine, bodyLine,
  parseStereoBlock, buildStereoBlock, evaluateScene, renderStereo, DEFAULT_CAMERA,
} from '../utils/stereo';

describe('иррациональные размеры стереометрических тел', () => {
  it.each([
    ['2√3', 2 * Math.sqrt(3)], ['2*sqrt(3)', 2 * Math.sqrt(3)],
    ['√(5/2)', Math.sqrt(2.5)], ['(1+√5)/2', (1 + Math.sqrt(5)) / 2],
    ['2 √(3)', 2 * Math.sqrt(3)], ['sqrt(2+sqrt(3))', Math.sqrt(2 + Math.sqrt(3))],
    ['1,5√2', 1.5 * Math.sqrt(2)], ['2π', 2 * Math.PI], ['pi/2', Math.PI / 2],
    ['3^2/2', 4.5], ['-2^2+5', 1], ['2e-3', 0.002],
    ['sqrt(3)^2', 3],
    ['sqrt(2,5)', Math.sqrt(2.5)],
  ])('%s вычисляется без округления', (src, n) => {
    expect(dimensionValue(src)).toBeCloseTo(n, 14);
  });

  it.each(['', '2 3', 'sqrt(', '√-1', 'sqrt(-1)^0', '1/0', '(1/0)^0', '1e999', '3foo', '2**3', 'Math.sqrt(3)', 'alert(1)', 'window.x', '2;3'])('ошибка %s не становится размером', async (src) => {
    expect(dimensionValue(src)).toBeNaN();
    await expect(dimensionRules()[0].validator(null, src)).rejects.toThrow();
  });

  it('нулевые и отрицательные длины запрещены, ноль у среза разрешён', async () => {
    for (const src of ['0', '-√3', '1-√2']) {
      await expect(dimensionRules()[0].validator(null, src)).rejects.toThrow(/больше нуля/);
    }
    await expect(dimensionRules({ optional: true })[0].validator(null, '0')).resolves.toBeUndefined();
  });

  it.each([
    'куб √2 с пирамидой √3 без вершин √2/4',
    'параллелепипед √2 2√3 sqrt(5)', 'призма 3 2√3 3',
    'пирамида 4 √2 √3 S прямоугольник b=√5', 'тетраэдр sqrt(2) D',
    'шар (0,5)', 'октаэдр (1+√5)/2', 'усечённая пирамида 4 √2 √3 0.5',
    'цилиндр 2√3 3', 'цилиндр r=2*sqrt(3) h=3',
    'конус √(5/2) sqrt(3)', 'усечённый конус √5 √2 2√3', 'шар π',
  ])('форма и текст сохраняют размеры: %s', (line) => {
    const spec = parseBodyLine(line);
    expect(spec).not.toBeNull();
    expect(spec.expressions).toBeTruthy();
    expect(bodySpecFromForm(bodyFormValues(spec))).toEqual(spec);
    expect(parseBodyLine(bodyLine(spec))).toEqual(spec);
    expect(normalizeBodySpec(JSON.parse(JSON.stringify(spec)))).toEqual(spec);
    const frame = renderStereo(evaluateScene({ body: spec, ops: [] }), DEFAULT_CAMERA, { width: 400, height: 300 });
    expect(JSON.stringify(frame)).not.toMatch(/NaN|Infinity/);
  });

  it('обычная дробь и вычисленная иррациональная длина не округляются до сотых', () => {
    for (const r of [1 / 3, Math.sqrt(3), 2e-7]) {
      const spec = { kind: 'sphere', r };
      expect(parseBodyLine(bodyLine(spec))).toEqual(spec);
    }
  });

  it('скобки корня не мешают координатам основания и многогранника', () => {
    expect(parseBodyLine('призма основание (0 0)(4 0)(4 3)(0 3) h=sqrt(2,5)').h).toBe(Math.sqrt(2.5));
    expect(parseBodyLine('многогранник (0,0,0)(4,0,0)(0,4,0)(0,0,4)').kind).toBe('hull');
    expect(parseBodyLine('шар (1 + √5)').r).toBe(1 + Math.sqrt(5));
  });

  it('изменение числового размера удаляет устаревшую формулу', () => {
    const spec = parseBodyLine('цилиндр 2√3 3');
    expect(normalizeBodySpec({ ...spec, r: 5 }).expressions).toBeUndefined();
    expect(bodySpecFromForm({ ...bodyFormValues(spec), r: '5' })).toEqual({ kind: 'cylinder', r: 5, h: 3 });
  });

  it('цилиндр и вписанная треугольная призма из задачи: R=2√3, a=6, h=3', () => {
    const parsed = parseStereoBlock('цилиндр 2√3 3 каркас\nи призма 3 6 3');
    expect(parsed.errors).toEqual([]);
    expect(parsed.scene.body.parts[0].r).toBe(2 * Math.sqrt(3));
    const text = buildStereoBlock(parsed.scene).text;
    expect(text).toContain('цилиндр 2√3 3 каркас');
    expect(parseStereoBlock(text).scene.body).toEqual(parsed.scene.body);
  });

  it.each(['цилиндр 2√ 3', 'куб sqrt(-1)', 'шар r=√', 'куб (√2', 'цилиндр -√3 3', 'куб 0'])('некорректный размер даёт ошибку блока: %s', (line) => {
    expect(parseBodyLine(line)).toBeNull();
    expect(parseStereoBlock(line).errors.length).toBeGreaterThan(0);
  });

  it('форма принимает выражение, сохраняет его между телами и блокирует ошибку', async () => {
    const ref = createRef();
    function Wrap() {
      const [form] = Form.useForm();
      return <StereoBodiesForm ref={ref} form={form} body={{ kind: 'cylinder', r: 3, h: 3 }} />;
    }
    const { container } = render(<Wrap />);
    const radius = screen.getByLabelText('Радиус');
    await act(async () => { fireEvent.change(radius, { target: { value: '2√3' } }); });
    expect(ref.current.spec().r).toBe(2 * Math.sqrt(3));
    expect(container.querySelector('.stereo-body-form-svg svg')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByText('Добавить второе тело')); });
    await act(async () => { fireEvent.click(screen.getByText('1. Цилиндр')); });
    expect(screen.getByLabelText('Радиус').value).toBe('2√3');
    expect(ref.current.spec().parts[0].expressions.r).toBe('2√3');
    await act(async () => { fireEvent.change(screen.getByLabelText('Радиус'), { target: { value: '√-1' } }); });
    await act(async () => { fireEvent.click(screen.getByText('2. Шар')); });
    expect(screen.getByText('Введите число или выражение, например 2√3')).toBeTruthy();
    expect(screen.getByLabelText('Радиус').value).toBe('√-1');
  });

  it('выбор другого тела заполняет его новые обязательные размеры', async () => {
    const ref = createRef();
    let formApi;
    function Wrap() {
      const [form] = Form.useForm();
      formApi = form;
      return <StereoBodiesForm ref={ref} form={form} body={{ kind: 'cube', a: 4 }} />;
    }
    render(<Wrap />);
    await act(async () => { fireEvent.mouseDown(screen.getByLabelText('Тело')); });
    await act(async () => { fireEvent.click(screen.getByText('Цилиндр')); });
    expect(screen.getByLabelText('Радиус').value).toBe('2');
    expect(screen.getByLabelText('Высота').value).toBe('4');
    await act(async () => { await expect(formApi.validateFields()).resolves.toBeTruthy(); });
    expect(ref.current.spec()).toEqual({ kind: 'cylinder', r: 2, h: 4 });
  });
});
