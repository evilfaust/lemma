import { describe, it, expect } from 'vitest';
import {
  render, screen, fireEvent, act,
} from '@testing-library/react';
import { createRef } from 'react';
import { Form } from 'antd';
import StereoBodiesForm from '../components/stereo/StereoBodiesForm';
import {
  buildBody, evaluateScene, renderStereo, parseStereoBlock, buildStereoBlock, renamePoint,
} from '../utils/stereo';
import {
  addPart, bodyParts, bodyFromParts, placementWord, PLACEMENTS,
} from '../utils/stereo/combo';

// Комбинации тел (базовый №13, профильный №3): где стоит второе тело, имена
// точек, совпавшие окружности, форма «Новый чертёж» из нескольких тел.

const VP = { width: 400, height: 400 };
const FRONT = { yaw: 0, pitch: 15, zoom: 1 };
const frameOf = (text) => {
  const r = parseStereoBlock(text);
  expect(r.errors).toEqual([]);
  return renderStereo(evaluateScene(r.scene), FRONT, VP);
};
const partsOf = (text) => parseStereoBlock(text).scene.body.parts.map((p) => [p.kind, p.at]);

describe('размещение второго тела', () => {
  it('«на дне», «вверху» — внутри, донышком и верхом', () => {
    expect(partsOf('конус 3 6\nи цилиндр 1,5 3 на дне')[1]).toEqual(['cylinder', [0, 0, -1.5]]);
    expect(partsOf('шар 3\nи конус 2,6 4,5 вверху')[1]).toEqual(['cone', [0, 0, 0.75]]);
    expect(partsOf('конус 3 4\nи шар 1,5 внизу')[1]).toEqual(['sphere', [0, 0, -0.5]]);
  });

  it('«сверху» и «снизу» — на тело и под него', () => {
    expect(partsOf('цилиндр 2 3\nи конус 2 2 сверху')[1]).toEqual(['cone', [0, 0, 2.5]]);
    expect(partsOf('конус 2 3\nи конус 2 3 вершиной вниз снизу')[1]).toEqual(['cone', [0, 0, -3]]);
  });

  it('у каждого размещения есть слово, и оно читается обратно', () => {
    for (const { key, word } of PLACEMENTS) {
      const g = addPart({ kind: 'cube', a: 4 }, { kind: 'sphere', r: 1 }, { kind: key });
      const text = `куб 4\nи шар 1 ${word}`.trim();
      expect({ key, at: parseStereoBlock(text).scene.body.parts[1].at }).toEqual({ key, at: g.parts[1].at });
    }
  });

  it('части ⇄ тело: размещение узнаётся по сдвигу', () => {
    const body = parseStereoBlock('конус 3 6 каркас\nи цилиндр 1,5 3 на дне\nи шар 0,5 сверху\nи шар 1 сдвиг 5 0 0').scene.body;
    const parts = bodyParts(body);
    expect(parts.map((p) => p.placement.kind)).toEqual(['center', 'floor', 'top', 'shift']);
    expect(parts[0].frame).toBe(true);
    expect(parts[3].placement.at).toEqual([5, 0, 0]);
    expect(bodyFromParts(parts)).toEqual(body);
    expect(placementWord(parts[3].placement)).toBe('сдвиг 5 0 0');
  });

  it('текст блока — словами, туда и обратно', () => {
    const src = 'конус 3 6 каркас\nи цилиндр 1.5 3 на дне\nи конус 1 1 вершиной вниз снизу';
    const r = parseStereoBlock(src);
    const text = buildStereoBlock(r.scene).text;
    expect(text.startsWith(src)).toBe(true);
    expect(parseStereoBlock(text).scene.body).toEqual(r.scene.body);
  });
});

describe('автоматическое вписывание и описывание', () => {
  it.each([
    ['цилиндр 3 4\nи шар 2 вписано', [{ r: 3, h: 6 }, { r: 3 }]],
    ['шар 1\nи куб 4 описано', [{ r: 1 }, { a: 2 }]],
    ['пирамида 4 4 6\nи конус 2 4 описано', [{ a: 4, h: 6 }, { r: Math.sqrt(8), h: 6 }]],
    ['куб √3\nи шар 2 описано', [{ a: Math.sqrt(3) }, { r: 1.5 }]],
    ['цилиндр 2 3\nи призма 4 2 4 описано', [{ r: 2, h: 3 }, { a: 4, h: 3 }]],
    ['конус 28√2 28√2\nи шар 2 описано', [{ r: 28 * Math.sqrt(2) }, { r: 28 * Math.sqrt(2) }]],
    ['цилиндр √3 2\nи призма 3 2 4 описано', [{ r: Math.sqrt(3), h: 2 }, { a: 6, h: 2 }]],
    ['призма 3 6 2\nи цилиндр 2 4 вписано', [{ a: 6, h: 2 }, { r: Math.sqrt(3), h: 2 }]],
    ['цилиндр 2√3 3\nи призма 3 2 4 вписано', [{ r: 2 * Math.sqrt(3), h: 3 }, { a: 6, h: 3 }]],
    ['конус 2 5\nи цилиндр 4 3 описано', [{ r: 2, h: 5 }, { r: 2, h: 5 }]],
    ['шар 2\nи конус 1 3 вписано', [{ r: 2 }, { r: 2, h: 2 }]],
  ])('вычисляет размеры и сохраняет связь в тексте: %s', (src, expected) => {
    const { scene, errors } = parseStereoBlock(src);
    expect(errors).toEqual([]);
    scene.body.parts.forEach((part, i) => {
      for (const [key, value] of Object.entries(expected[i])) expect(part[key]).toBeCloseTo(value, 12);
    });
    expect(bodyFromParts(bodyParts(scene.body))).toEqual(scene.body);
    expect(parseStereoBlock(buildStereoBlock(scene).text).scene.body).toEqual(scene.body);
    expect(frameOf(src).strokes.length).toBeGreaterThan(4);
  });

  it.each(['', ' вершиной вниз'])('сфера через вершину и основание конуса%s', (direction) => {
    const { scene, errors } = parseStereoBlock(`конус √5 4${direction}\nи шар 1 описано`);
    expect(errors).toEqual([]);
    const [cone, sphere] = scene.body.parts;
    const apex = (direction ? -1 : 1) * cone.h / 2;
    expect(Math.abs(apex - sphere.at[2])).toBeCloseTo(sphere.r, 14);
    expect(Math.hypot(cone.r, -apex - sphere.at[2])).toBeCloseTo(sphere.r, 14);
    expect(parseStereoBlock(buildStereoBlock(scene).text).scene.body).toEqual(scene.body);
  });

  it.each(['', ' вершиной вниз'])('шар касается основания и боковой поверхности конуса%s', (direction) => {
    const { scene, errors } = parseStereoBlock(`конус 3 5${direction}\nи шар 2 вписано`);
    expect(errors).toEqual([]);
    const [cone, sphere] = scene.body.parts;
    const z = (direction ? -1 : 1) * sphere.at[2];
    expect(z + cone.h / 2).toBeCloseTo(sphere.r, 14);
    expect((cone.h / 2 - z) * cone.r / Math.hypot(cone.r, cone.h)).toBeCloseTo(sphere.r, 14);
    expect(parseStereoBlock(buildStereoBlock(scene).text).scene.body).toEqual(scene.body);
  });

  it.each([
    'куб 4\nи пирамида 4 2 4 вписано',
    'призма 4 4 3 наклон 60\nи цилиндр 2 4 вписано',
    'куб 4\nи шар 2\nи шар 2 вписано',
  ])('отклоняет неподдерживаемую связь: %s', (src) => {
    expect(parseStereoBlock(src).errors).toMatchObject([{ message: expect.stringContaining('поддерживаемых пар') }]);
  });
});

describe('несколько тел: имена и окружности', () => {
  it('призма в цилиндре получает свои A, B, C, D — спрятанные точки цилиндра уступают', () => {
    const b = buildBody(parseStereoBlock('цилиндр 2 4 каркас\nи призма 4 2,83 4').scene.body);
    expect(b.order.slice(-8)).toEqual(['A', 'B', 'C', 'D', 'A1', 'B1', 'C1', 'D1']);
    expect(b.order.slice(0, 4)).toEqual(['O', 'O1', 'A2', 'A11']);
  });

  it('многогранник первым — имена как раньше (генератор задач)', () => {
    const b = buildBody(parseStereoBlock('куб 4 каркас\nи шар 2').scene.body);
    expect(b.order.slice(-2)).toEqual(['O', 'A2']);
  });

  it('«вершины …» у нескольких тел — все подряд, и выгрузка их сохраняет', () => {
    const r = parseStereoBlock('цилиндр 2 4\nи шар 2\nвершины OO1AA1PQ');
    expect(r.errors).toEqual([]);
    expect(buildBody(r.scene.body).order).toEqual(['O', 'O1', 'A', 'A1', 'P', 'Q']);
    const renamed = renamePoint(parseStereoBlock('цилиндр 2 4\nи шар 2').scene, 'O2', 'M').scene;
    const text = buildStereoBlock(renamed).text;
    expect(text).toMatch(/\nвершины OO1AA1MA2\n/);
    expect(buildBody(parseStereoBlock(text).scene.body).order).toContain('M');
    expect(parseStereoBlock('цилиндр 2 4\nи шар 2\nвершины OO1AA1P').errors[0].message).toMatch(/Нужно 6/);
  });

  it('общее основание двух конусов рисуется одной окружностью (задняя половина — пунктир)', () => {
    const b = buildBody(parseStereoBlock('конус 2 3\nи конус 2 3 вершиной вниз снизу').scene.body);
    expect(b.curves).toHaveLength(1);
    const fr = frameOf('конус 2 3\nи конус 2 3 вершиной вниз снизу');
    const curve = fr.strokes.filter((s) => s.objId.startsWith('curve:'));
    expect(curve.some((s) => s.hidden)).toBe(true);
    expect(curve.some((s) => !s.hidden)).toBe(true);
  });
});

// Чертежи из заданий «Решу ЕГЭ» (база №13, профиль №3), которые редактор
// обязан покрывать: присланы учителем 26.10.2026.
const GALLERY = {
  'две кружки': 'цилиндр 1 2\nи цилиндр 2,5 2,5 справа\nвид 0 15\nK на окружности O 0\nL на окружности O2 0\nOO1\nOK\nO2O12\nO2L\nскрыть K, L',
  'часть цилиндра': 'цилиндр 4 1,5\nвид 0 20\nK на окружности O1 200\nL на окружности O1 250\nK1 на окружности O 200\nL1 на окружности O 250\nO1K\nO1L\nOK1\nOL1\nOO1\nKK1\nLL1\nскрыть K, L, K1, L1',
  'сечение конуса через середину высоты': 'конус 3 4\nвид 0 15\nP на OS 1:1\nсечение P ⊥ OS\nOS\nпоказать O',
  'два шара': 'шар 2\nи шар 1 справа\nвид 0 15\nK на окружности O 330\nOK\nL на окружности O2 330\nO2L\nскрыть K, L',
  'конус в цилиндре': 'цилиндр 2 5\nи конус 2 5\nвид 0 15\nO2S\nK на окружности O2 0\nO2K\nскрыть K',
  'шар в цилиндре': 'цилиндр 2 4\nи шар 2\nвид 0 15\nпоказать O, O1, O2\nOO1\nK на окружности O2 0\nO2K\nподпись O2K R\nскрыть K',
};

describe('чертежи заданий с двумя телами', () => {
  for (const [name, text] of Object.entries(GALLERY)) {
    it(name, () => {
      const fr = frameOf(text);
      expect(fr.strokes.length).toBeGreaterThan(4);
    });
  }

  it('без каркаса внешнее тело закрывает вписанный конус — он пунктиром', () => {
    const fr = frameOf(GALLERY['конус в цилиндре']);
    const cone = fr.strokes.filter((s) => s.objId === 'sil:2' || s.objId === 'sil:3');
    expect(cone.length).toBeGreaterThan(0);
    expect(cone.every((s) => s.hidden)).toBe(true);
  });
});

describe('форма «Новый чертёж» из нескольких тел', () => {
  function Wrap({ body, bodiesRef }) {
    const [form] = Form.useForm();
    return <StereoBodiesForm ref={bodiesRef} form={form} body={body} />;
  }

  it('второе тело добавляется и попадает в чертёж, поля первого сохраняются', async () => {
    const ref = createRef();
    render(<Wrap body={{ kind: 'cone', r: 3, h: 6 }} bodiesRef={ref} />);
    expect(ref.current.spec()).toMatchObject({ kind: 'cone', r: 3, h: 6 });
    await act(async () => { fireEvent.click(screen.getByText('Добавить второе тело')); });
    expect(screen.getByText('2. Шар')).toBeTruthy();
    expect(screen.getByText(/Прозрачное \(каркас\)/)).toBeTruthy();
    const spec = ref.current.spec();
    expect(spec.kind).toBe('group');
    expect(spec.parts.map((p) => p.kind)).toEqual(['cone', 'sphere']);
    // Вернуться к первому — его поля на месте
    await act(async () => { fireEvent.click(screen.getByText('1. Конус')); });
    expect(ref.current.spec().parts[0]).toMatchObject({ kind: 'cone', r: 3, h: 6 });
  });

  it('открывает готовую комбинацию: вкладки, размещение и каркас', () => {
    const ref = createRef();
    const body = parseStereoBlock('конус 3 6 каркас\nи цилиндр 1,5 3 на дне').scene.body;
    const { container } = render(<Wrap body={body} bodiesRef={ref} />);
    expect(screen.getByText('1. Конус')).toBeTruthy();
    expect(screen.getByText('2. Цилиндр')).toBeTruthy();
    expect(container.querySelector('.ant-checkbox-checked')).toBeTruthy();
    expect(ref.current.spec()).toEqual(body);
    expect(container.querySelector('.stereo-body-form-svg svg')).toBeTruthy();
  });

  it('включает вписывание и пересчитывает второе тело при изменении первого', async () => {
    const ref = createRef();
    const { container } = render(<Wrap body={{ kind: 'cylinder', r: 2, h: 3 }} bodiesRef={ref} />);
    await act(async () => { fireEvent.click(screen.getByText('Добавить второе тело')); });
    await act(async () => { fireEvent.mouseDown(screen.getByLabelText('Где стоит:')); });
    await act(async () => { fireEvent.click(screen.getByText('Вписать в первое тело')); });
    expect(screen.getByLabelText('Радиус').readOnly).toBe(true);
    expect(screen.getByLabelText('Радиус').value).toBe('2');
    await act(async () => { fireEvent.click(screen.getByText('1. Цилиндр')); });
    expect(screen.getByLabelText('Высота').readOnly).toBe(true);
    await act(async () => { fireEvent.change(screen.getByLabelText('Радиус'), { target: { value: '2√3' } }); });
    expect(screen.getByLabelText('Высота').value).toBe(String(Number((4 * Math.sqrt(3)).toPrecision(12))));
    expect(ref.current.spec().parts).toMatchObject([
      { r: 2 * Math.sqrt(3), h: 4 * Math.sqrt(3), expressions: { r: '2√3' } },
      { r: 2 * Math.sqrt(3), fit: 'inscribed' },
    ]);
    expect(container.querySelector('.stereo-body-form-svg svg')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByText('2. Шар')); });
    expect(screen.getByLabelText('Радиус').value).toBe(String(Number((2 * Math.sqrt(3)).toPrecision(12))));
    await act(async () => { fireEvent.mouseDown(screen.getByLabelText('Где стоит:')); });
    await act(async () => { fireEvent.click(screen.getByText('Описать вокруг первого тела')); });
    expect(ref.current.spec()).toBeNull();
    expect(screen.getByRole('alert').textContent).toMatch(/Для этой пары вписывание недоступно/);
  });

  it('при повторном открытии берёт первую вкладку из чертежа, а не из прежней формы', async () => {
    const ref = createRef();
    const body = parseStereoBlock('куб √3\nи шар 2 описано').scene.body;
    function Reopen({ open }) {
      const [form] = Form.useForm();
      return open && <StereoBodiesForm ref={ref} form={form} body={body} />;
    }
    const { rerender } = render(<Reopen open />);
    await act(async () => { fireEvent.click(screen.getByText('2. Шар')); });
    expect(screen.getByLabelText('Радиус').readOnly).toBe(true);
    expect(screen.getByText('Описать вокруг первого тела')).toBeTruthy();
    rerender(<Reopen open={false} />);
    rerender(<Reopen open />);
    expect(screen.getByLabelText('Ребро').value).toBe('√3');
    expect(ref.current.spec()).toEqual(body);
  });

  it('сохраняет произвольное основание и отклоняет вписывание в такую призму', async () => {
    const ref = createRef();
    const src = 'призма основание (0 0)(4 0)(4 3)(0 3) h=4\nи цилиндр 1 2';
    const { scene, errors } = parseStereoBlock(src);
    expect(errors).toEqual([]);
    render(<Wrap body={scene.body} bodiesRef={ref} />);
    expect(ref.current.spec()).toEqual(scene.body);
    await act(async () => { fireEvent.click(screen.getByText('2. Цилиндр')); });
    await act(async () => { fireEvent.mouseDown(screen.getByLabelText('Где стоит:')); });
    await act(async () => { fireEvent.click(screen.getByText('Вписать в первое тело')); });
    expect(ref.current.spec()).toBeNull();
  });
});
