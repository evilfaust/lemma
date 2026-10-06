import { useMemo } from 'react';
import {
  Checkbox, Form, InputNumber, Select, Space,
} from 'antd';
import {
  BODY_KINDS, TILT_DIRS, DEFAULT_TILT_DIR, bodySpecFromForm, baseShapeOptions, apexPosOptions,
  evaluateScene, renderStereo, stereoSvgString, DEFAULT_CAMERA, bodyTitle,
} from '../../utils/stereo';

// Форма «Новый чертёж»: тело, основание, размеры, наклон призмы, положение
// вершины пирамиды и живое превью. Значения ⇄ описание тела —
// bodyFormValues / bodySpecFromForm (utils/stereo/bodies.js).

const KIND_DEFAULT_SHAPE = {
  box: 'rect', prism: 'regular:3', pyramid: 'regular:4', frustum: 'regular:4', tetra: 'regular',
};

const DIR_OPTIONS = [
  { value: DEFAULT_TILT_DIR, label: 'вправо и назад' },
  ...Object.entries(TILT_DIRS).map(([label, value]) => ({ value, label })),
];

const SIZE = { min: 0.5, max: 50, step: 0.5 };

export default function StereoBodyForm({ form, initialValues }) {
  const values = Form.useWatch([], form) || initialValues;
  const kind = values?.kind || 'cube';
  const spec = useMemo(() => bodySpecFromForm(values || {}), [values]);
  const preview = useMemo(() => {
    try {
      const model = evaluateScene({ body: spec, ops: [] });
      const frame = renderStereo(model, DEFAULT_CAMERA, { width: 240, height: 200 });
      return stereoSvgString(frame, { background: false, responsive: true });
    } catch {
      return '';
    }
  }, [spec]);

  const hasShape = kind !== 'cube';
  const hasApex = kind === 'pyramid' || kind === 'frustum' || (kind === 'tetra' && values?.shape && values.shape !== 'regular') || (kind === 'tetra' && values?.apexPos && values.apexPos !== 'center');
  const canTilt = kind === 'prism' || kind === 'box';
  const shape = values?.shape || '';
  const hasB = (kind === 'box' && shape !== 'rhombus') || ((kind === 'prism' || kind === 'pyramid' || kind === 'frustum') && (shape === 'rect' || shape === 'parallelogram'));
  const aLabel = kind === 'cube' ? 'Ребро'
    : kind === 'box' || shape === 'rect' || shape === 'parallelogram' ? 'AB'
      : shape === 'trapezoid' ? 'Основание AD'
        : shape === 'right' ? 'Гипотенуза AB'
          : 'Ребро основания AB';

  const onKindChange = (k) => {
    form.setFieldsValue({ shape: KIND_DEFAULT_SHAPE[k], apexPos: 'center', oblique: false });
  };

  return (
    <div className="stereo-body-form">
      <div className="stereo-body-form-fields">
        <Form.Item name="kind" label="Тело">
          <Select
            onChange={onKindChange}
            options={Object.entries(BODY_KINDS).map(([value, v]) => ({ value, label: v.label }))}
          />
        </Form.Item>
        {hasShape && (
          <Form.Item name="shape" label={kind === 'tetra' ? 'Вид' : 'В основании'}>
            <Select options={baseShapeOptions(kind)} listHeight={360} />
          </Form.Item>
        )}
        <Space wrap align="start">
          <Form.Item name="a" label={aLabel}>
            <InputNumber {...SIZE} />
          </Form.Item>
          {hasB && (
            <Form.Item name="b" label="AD"><InputNumber {...SIZE} /></Form.Item>
          )}
          {kind === 'box' && (
            <Form.Item name="c" label="Высота"><InputNumber {...SIZE} /></Form.Item>
          )}
          {(kind === 'prism' || kind === 'pyramid' || kind === 'frustum' || (kind === 'tetra' && hasApex)) && (
            <Form.Item name="h" label="Высота"><InputNumber {...SIZE} /></Form.Item>
          )}
          {kind === 'frustum' && (
            <Form.Item name="k" label="Верх : низ" tooltip="Во сколько раз верхнее основание меньше нижнего (0,1–0,9)">
              <InputNumber min={0.1} max={0.9} step={0.1} />
            </Form.Item>
          )}
          {(kind === 'pyramid' || kind === 'tetra') && (
            <Form.Item name="apex" label="Вершина">
              <Select style={{ width: 80 }} options={['S', 'D', 'M', 'P'].map((v) => ({ value: v, label: v }))} />
            </Form.Item>
          )}
        </Space>
        {canTilt && (
          <Space wrap align="start">
            <Form.Item name="oblique" valuePropName="checked" label=" " colon={false}>
              <Checkbox>Наклонная</Checkbox>
            </Form.Item>
            {values?.oblique && (
              <>
                <Form.Item name="tilt" label="Угол ребра с основанием, °">
                  <InputNumber min={15} max={89} step={5} />
                </Form.Item>
                <Form.Item name="dir" label="Верх сдвинут">
                  <Select style={{ width: 160 }} options={DIR_OPTIONS} />
                </Form.Item>
              </>
            )}
          </Space>
        )}
        {(kind === 'pyramid' || kind === 'frustum' || kind === 'tetra') && (
          <Form.Item name="apexPos" label={kind === 'frustum' ? 'Вершина полной пирамиды проектируется' : 'Вершина проектируется'}>
            <Select options={apexPosOptions(spec)} listHeight={320} />
          </Form.Item>
        )}
        {(kind === 'pyramid' || kind === 'frustum' || kind === 'tetra') && values?.apexPos === 'shift' && (
          <Space wrap>
            <Form.Item name="sx" label="Сдвиг вправо"><InputNumber step={0.5} min={-20} max={20} /></Form.Item>
            <Form.Item name="sy" label="Сдвиг назад"><InputNumber step={0.5} min={-20} max={20} /></Form.Item>
          </Space>
        )}
        <Form.Item
          name="cw"
          valuePropName="checked"
          extra="Если смотреть сверху: A — спереди слева, B — сзади слева, дальше по кругу. Так подписывают в части учебников (Атанасян). Без галочки — против часовой: B спереди справа."
        >
          <Checkbox>Буквы основания по часовой стрелке</Checkbox>
        </Form.Item>
      </div>
      <div className="stereo-body-form-preview">
        {/* SVG собирает наш же движок (stereoSvgString) — внешних данных в нём нет */}
        <div className="stereo-body-form-svg" dangerouslySetInnerHTML={{ __html: preview }} />
        <div className="stereo-body-form-title">{bodyTitle(spec)}</div>
      </div>
    </div>
  );
}
