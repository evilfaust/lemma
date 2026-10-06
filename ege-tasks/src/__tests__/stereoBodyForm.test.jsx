import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Form } from 'antd';
import StereoBodyForm from '../components/stereo/StereoBodyForm';
import {
  bodyFormValues, bodySpecFromForm, normalizeBodySpec, apexPosOptions, baseShapeOptions,
} from '../utils/stereo';

const SPECS = [
  { kind: 'cube', a: 4 },
  { kind: 'box', a: 4, b: 3, c: 5, base: 'parallelogram', tilt: 60, dir: 180 },
  { kind: 'prism', n: 5, a: 3, h: 4 },
  { kind: 'prism', n: 3, base: 'free', tilt: 70, cw: true },
  { kind: 'prism', base: 'trapezoid', a: 6, h: 4 },
  { kind: 'pyramid', n: 4, over: [0] },
  { kind: 'pyramid', n: 4, base: 'rect', b: 3, over: [1, 2] },
  { kind: 'pyramid', n: 3, base: 'free', shift: [1, 0.5], apex: 'D' },
  { kind: 'frustum', n: 3, k: 0.4 },
  { kind: 'tetra', apex: 'D' },
  { kind: 'tetra', base: 'free', apex: 'D', h: 3 },
];

describe('форма «Новый чертёж» ⇄ тело', () => {
  it('значения формы возвращают то же тело', () => {
    for (const spec of SPECS) {
      const s = normalizeBodySpec(spec);
      expect({ spec, back: bodySpecFromForm(bodyFormValues(s)) }).toEqual({ spec, back: s });
    }
  });

  it('варианты основания и положения вершины', () => {
    const groups = baseShapeOptions('prism');
    expect(groups.map((g) => g.label)).toEqual(['Правильное', 'Произвольное', 'Особое']);
    expect(baseShapeOptions('box').map((o) => o.value)).toEqual(['rect', 'parallelogram', 'rhombus']);
    const pos = apexPosOptions({ kind: 'pyramid', n: 4 }).map((o) => o.value);
    expect(pos).toEqual(['center', 'v:0', 'v:1', 'v:2', 'v:3', 'e:0', 'e:1', 'e:2', 'e:3', 'shift']);
    expect(apexPosOptions({ kind: 'tetra', apex: 'D' })[1].label).toMatch(/вершину A/);
  });

  it('превью и название тела', () => {
    const init = bodyFormValues({ kind: 'prism', n: 3, base: 'free', tilt: 60 });
    function Wrap() {
      const [form] = Form.useForm();
      return <Form form={form} initialValues={init}><StereoBodyForm form={form} initialValues={init} /></Form>;
    }
    const { container } = render(<Wrap />);
    expect(container.querySelector('.stereo-body-form-svg svg')).toBeTruthy();
    expect(screen.getByText('Наклонная призма ABCA₁B₁C₁')).toBeTruthy();
  });
});
