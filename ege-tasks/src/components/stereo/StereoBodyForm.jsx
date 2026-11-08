import { useMemo } from 'react';
import {
  Checkbox, Form, InputNumber, Select, Space,
} from 'antd';
import StereoDimensionInput, { dimensionRules, DIMENSION_HINT } from './StereoDimensionInput';
import { BODY_DIMENSIONS } from '../../utils/stereo/dimensions';
import { REVOLUTION_KINDS } from '../../utils/stereo/revolution';
import {
  BODY_KINDS, TILT_DIRS, DEFAULT_TILT_DIR, bodySpecFromForm, baseShapeOptions, apexPosOptions,
  evaluateScene, renderStereo, stereoSvgString, DEFAULT_CAMERA, bodyTitle, ROOF_KINDS,
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

const SIZE_RULES = dimensionRules();

function sizeField(name, label, calculatedSizes) {
  const value = calculatedSizes?.[name];
  if (value == null) {
    return <Form.Item name={name} label={label} rules={SIZE_RULES}><StereoDimensionInput /></Form.Item>;
  }
  const id = `stereo-calculated-${name}`;
  return (
    <Form.Item label={label} htmlFor={id} extra="Рассчитывается автоматически">
      <StereoDimensionInput id={id} value={String(Number(value.toPrecision(12)))} readOnly />
    </Form.Item>
  );
}

/**
 * @param previewSpec — что показать в превью вместо этого тела (весь чертёж
 *   из нескольких тел, StereoBodiesForm)
 * @param noSpace — без пункта «Без тела» (второе тело чертежа)
 */
export default function StereoBodyForm({
  form, initialValues, previewSpec = null, calculatedSizes, noSpace = false,
}) {
  const values = Form.useWatch([], form) || initialValues;
  const kind = values?.kind || 'cube';
  const spec = useMemo(() => bodySpecFromForm(values || {}), [values]);
  const shown = previewSpec || spec;
  const preview = useMemo(() => {
    try {
      const model = evaluateScene({ body: shown, ops: [] });
      const frame = renderStereo(model, DEFAULT_CAMERA, { width: 240, height: 200 });
      return stereoSvgString(frame, { background: false, responsive: true });
    } catch {
      return '';
    }
  }, [shown]);
  const kindOptions = Object.entries(BODY_KINDS)
    .filter(([value]) => value !== 'hull' && value !== 'blocks' && !(noSpace && value === 'space'))
    .map(([value, v]) => ({ value, label: v.label }));

  const hasShape = kind !== 'cube' && kind !== 'octa' && kind !== 'space';
  const hasApex = kind === 'pyramid' || kind === 'frustum' || (kind === 'tetra' && values?.shape && values.shape !== 'regular') || (kind === 'tetra' && values?.apexPos && values.apexPos !== 'center');
  const canTilt = kind === 'prism' || kind === 'box';
  const shape = values?.shape || '';
  const hasB = (kind === 'box' && shape !== 'rhombus') || ((kind === 'prism' || kind === 'pyramid' || kind === 'frustum') && (shape === 'rect' || shape === 'parallelogram'));
  const aLabel = kind === 'cube' || kind === 'octa' ? 'Ребро'
    : kind === 'box' || shape === 'rect' || shape === 'parallelogram' ? 'AB'
      : shape === 'trapezoid' ? 'Основание AD'
        : shape === 'right' ? 'Гипотенуза AB'
          : 'Ребро основания AB';

  const onKindChange = (k) => {
    const next = { kind: k, shape: KIND_DEFAULT_SHAPE[k], apexPos: 'center', oblique: false };
    const defaults = bodySpecFromForm({ ...values, ...next });
    const missing = Object.fromEntries(BODY_DIMENSIONS
      .filter((key) => values?.[key] == null && defaults[key] != null)
      .map((key) => [key, defaults[key]]));
    form.setFieldsValue({ ...next, ...missing });
  };

  if (REVOLUTION_KINDS.includes(kind)) {
    return (
      <div className="stereo-body-form">
        <div className="stereo-body-form-fields">
          <Form.Item name="kind" label="Тело">
            <Select onChange={onKindChange} options={kindOptions} />
          </Form.Item>
          <Space wrap align="start">
            {sizeField('r', kind === 'tcone' ? 'Радиус нижнего основания' : 'Радиус', calculatedSizes)}
            {kind === 'tcone' && (
              <Form.Item name="r2" rules={SIZE_RULES} label="Радиус верхнего"><StereoDimensionInput /></Form.Item>
            )}
            {kind !== 'sphere' && sizeField('h', 'Высота', calculatedSizes)}
          </Space>
          <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>{DIMENSION_HINT}</div>
          {kind === 'cone' && (
            <Form.Item name="down" valuePropName="checked" extra="Сосуд-воронка; два конуса с общим основанием — второй вершиной вниз, «Снизу»">
              <Checkbox>Вершиной вниз</Checkbox>
            </Form.Item>
          )}
          <Form.Item
            name="letters"
            valuePropName="checked"
            extra={kind === 'sphere' ? 'Центр O и точка A на экваторе.' : 'Центры оснований O, O₁ (вершина S), точки A, A₁ на окружностях. Без галочки точки есть, но не подписаны — как на рисунках задач.'}
          >
            <Checkbox>Подписать точки</Checkbox>
          </Form.Item>
        </div>
        <div className="stereo-body-form-preview">
          <div className="stereo-body-form-svg" dangerouslySetInnerHTML={{ __html: preview }} />
          <div className="stereo-body-form-title">{bodyTitle(shown)}</div>
        </div>
      </div>
    );
  }

  if (kind === 'space') {
    return (
      <div className="stereo-body-form">
        <div className="stereo-body-form-fields">
          <Form.Item name="kind" label="Тело">
            <Select onChange={onKindChange} options={kindOptions} />
          </Form.Item>
          <div style={{ color: '#6b7280', fontSize: 13 }}>
            Чертёж без тела. «Точка» (P) — клик в любое место: точка встанет на «пол» (z = 0);
            тянуть — по горизонтали, с Shift — по высоте. «Плоскость» (G) — три точки или одна
            точка дважды (горизонтально через неё): получится лист α, линии под ним станут пунктиром.
            Командами: «A = (0; 0; 0)», «лист α через M». Все команды — в «?».
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stereo-body-form">
      <div className="stereo-body-form-fields">
        {/* «Многогранник по точкам» задаётся только текстом (блок ```stereo) */}
        <Form.Item name="kind" label="Тело">
          <Select onChange={onKindChange} options={kindOptions} />
        </Form.Item>
        {hasShape && (
          <Form.Item name="shape" label={kind === 'tetra' ? 'Вид' : 'В основании'}>
            <Select options={baseShapeOptions(kind)} listHeight={360} />
          </Form.Item>
        )}
        <Space wrap align="start">
          {sizeField('a', aLabel, calculatedSizes)}
          {hasB && (
            <Form.Item name="b" rules={SIZE_RULES} label="AD"><StereoDimensionInput /></Form.Item>
          )}
          {kind === 'box' && (
            <Form.Item name="c" rules={SIZE_RULES} label="Высота"><StereoDimensionInput /></Form.Item>
          )}
          {(kind === 'prism' || kind === 'pyramid' || kind === 'frustum' || (kind === 'tetra' && hasApex))
            && sizeField('h', 'Высота', calculatedSizes)}
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
        <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 16 }}>{DIMENSION_HINT}</div>
        <Space wrap align="start">
          {ROOF_KINDS.includes(kind) && (
            <Form.Item name="roof" rules={dimensionRules({ optional: true })} label="Пирамида сверху, высота" tooltip="«К кубу приклеили пирамиду»: 0 — без неё">
              <StereoDimensionInput />
            </Form.Item>
          )}
          <Form.Item name="cut" rules={dimensionRules({ optional: true })} label="Срезать вершины на" tooltip="«Отпилили все вершины»: отрезок, отсекаемый от каждой вершины на рёбрах; 0 — не срезать. Буквы у такого тела не ставятся">
            <StereoDimensionInput />
          </Form.Item>
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
        <div className="stereo-body-form-title">{bodyTitle(shown)}</div>
      </div>
    </div>
  );
}
