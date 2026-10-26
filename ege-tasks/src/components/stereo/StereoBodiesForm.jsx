import {
  forwardRef, useImperativeHandle, useMemo, useState,
} from 'react';
import {
  Button, Checkbox, Form, InputNumber, Segmented, Select, Space,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import StereoBodyForm from './StereoBodyForm';
import { bodyFormValues, bodySpecFromForm, bodyTitle } from '../../utils/stereo';
import {
  PLACEMENTS, MAX_BODY_PARTS, bodyParts, bodyFromParts,
} from '../../utils/stereo/combo';

// «Новый чертёж» из нескольких тел: шар в кубе, конус в цилиндре, две кружки.
// Вкладка на тело; у второго и дальше — где оно стоит (внутри, на дне,
// справа…); у любого — «каркас» (прозрачное: вписанное в него видно
// сплошными линиями). Поля тела — та же StereoBodyForm на одной форме:
// при смене вкладки значения уходят в список, форма заполняется заново.

const NEW_PART = { kind: 'sphere', r: 2 };

const partsFrom = (body) => bodyParts(body).map(({ spec, placement, frame }) => ({
  values: bodyFormValues(spec), placement, frame,
}));

const specOf = (list) => bodyFromParts(list.map((p) => ({
  spec: bodySpecFromForm(p.values), placement: p.placement, frame: p.frame,
})));

const shortTitle = (values) => bodyTitle(bodySpecFromForm(values || {})).split(' ')[0];

/** Значения следующей вкладки поверх текущих: ключи, которых у неё нет, — пустые. */
const replaceValues = (prev, next) => ({
  ...Object.fromEntries(Object.keys(prev || {}).map((k) => [k, undefined])),
  ...next,
});

const SHIFT_LABELS = ['вправо', 'назад', 'вверх'];

const StereoBodiesForm = forwardRef(function StereoBodiesForm({ form, body }, ref) {
  const [parts, setParts] = useState(() => partsFrom(body));
  const [active, setActive] = useState(0);
  const live = Form.useWatch([], form);

  const current = useMemo(
    () => parts.map((p, i) => (i === active && live ? { ...p, values: live } : p)),
    [parts, active, live],
  );
  const combined = useMemo(() => (current.length > 1 ? specOf(current) : null), [current]);

  useImperativeHandle(ref, () => ({
    spec: () => specOf(parts.map((p, i) => (i === active ? { ...p, values: form.getFieldsValue(true) } : p))),
  }), [parts, active, form]);

  // Сохранить поля открытой вкладки и открыть другую (или новую)
  const switchTo = (i, list = null) => {
    const vals = form.getFieldsValue(true);
    const saved = (list || parts).map((p, j) => (j === active ? { ...p, values: vals } : p));
    setParts(saved);
    setActive(i);
    form.setFieldsValue(replaceValues(vals, saved[i].values));
  };

  const addPart = () => {
    const next = [...parts, { values: bodyFormValues(NEW_PART), placement: { kind: 'center' }, frame: false }];
    switchTo(next.length - 1, next);
  };

  const removePart = () => {
    if (!active) return;
    const vals = form.getFieldsValue(true);
    const rest = parts.filter((_, j) => j !== active);
    const to = active - 1;
    setParts(rest);
    setActive(to);
    form.setFieldsValue(replaceValues(vals, rest[to].values));
  };

  const patch = (fields) => setParts((ps) => ps.map((p, j) => (j === active ? { ...p, ...fields } : p)));

  const part = parts[active];
  const multi = parts.length > 1;
  const canAdd = parts.length < MAX_BODY_PARTS && !current.some((p) => p.values?.kind === 'space');
  const placementOptions = [
    ...PLACEMENTS.map((p) => ({ value: p.key, label: p.label })),
    ...(part.placement.kind === 'shift' ? [{ value: 'shift', label: 'Точно: сдвиг' }] : []),
  ];

  return (
    <div className="stereo-bodies-form">
      <div className="stereo-bodies-tabs">
        {multi && (
          <Segmented
            value={active}
            onChange={(i) => switchTo(i)}
            options={current.map((p, i) => ({ value: i, label: `${i + 1}. ${shortTitle(p.values)}` }))}
          />
        )}
        <Button size="small" icon={<PlusOutlined />} disabled={!canAdd} onClick={addPart}>
          {multi ? 'Ещё тело' : 'Добавить второе тело'}
        </Button>
        {multi && active > 0 && (
          <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={removePart}>
            Убрать это тело
          </Button>
        )}
      </div>
      {multi && (
        <div className="stereo-bodies-place">
          {active > 0 && (
            <Space wrap align="center">
              <span>Где стоит:</span>
              <Select
                style={{ width: 210 }}
                value={part.placement.kind}
                options={placementOptions}
                onChange={(kind) => patch({ placement: kind === 'shift' ? part.placement : { kind } })}
              />
              {part.placement.kind === 'shift' && part.placement.at.map((x, k) => (
                <InputNumber
                  key={SHIFT_LABELS[k]}
                  size="small"
                  step={0.5}
                  value={x}
                  addonBefore={SHIFT_LABELS[k]}
                  style={{ width: 130 }}
                  onChange={(v) => patch({ placement: { kind: 'shift', at: part.placement.at.map((y, j) => (j === k ? Number(v) || 0 : y)) } })}
                />
              ))}
            </Space>
          )}
          <Checkbox checked={part.frame} onChange={(e) => patch({ frame: e.target.checked })}>
            Прозрачное (каркас) — тело внутри него видно сплошными линиями
          </Checkbox>
        </div>
      )}
      <Form form={form} layout="vertical" initialValues={parts[0].values}>
        <StereoBodyForm form={form} initialValues={part.values} previewSpec={combined} noSpace={multi} />
      </Form>
    </div>
  );
});

export default StereoBodiesForm;
