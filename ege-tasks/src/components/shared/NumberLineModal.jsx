import { useMemo, useState } from 'react';
import {
  Modal, Button, Space, Segmented, InputNumber, Input, Switch, Empty, Tooltip,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import NumberLineSVG from './NumberLineSVG';
import { shapesToSpec, pointsToSpec, specToNumlineState } from '../../utils/numberLine';

// Визуальный конструктор числовой прямой. Два типа:
//  • «Неравенства» — лучи/отрезки/точки со штриховкой (open/fill);
//  • «Точки на прямой» — линейка с целыми засечками + помеченные точки A,B,C,D.
// На каждый чих собираем DSL (shapesToSpec / pointsToSpec) и показываем живое
// превью. По «Вставить» отдаём готовый сниппет (блок или inline для таблиц).
//
// `initialSpec` включает режим ПРАВКИ: курсор стоял внутри готовой прямой,
// конструктор открывается с ней (specToNumlineState), а вызывающий заменяет
// старый блок. Разбирается ли текст без потерь, проверяет вызывающий.

// Координаты — строки: позволяют вводить дроби «1/2», «-3/4» наряду с «0.5», «2».
const SHAPE_DEFAULTS = {
  ray: { type: 'ray', dir: 'right', x: '1', filled: false },
  seg: { type: 'seg', a: '1', b: '2', ea: false, eb: false },
  point: { type: 'point', x: '0', filled: true },
  // «Вся прямая» параметров не имеет: штриховка от края до края, точек нет.
  all: { type: 'all' },
  // Подпись под осью без точки (tick): число, дробь или формула.
  tick: { type: 'tick', x: '1', label: '', bold: false },
};

// Готовый к вставке сниппет: блочный fenced (```numline) или inline-код
// (`numline: a; b`) — последний нужен для ячеек markdown-таблиц.
export function buildNumlineSnippet(spec, format) {
  if (format === 'inline') {
    return `\`numline: ${spec.replace(/\n/g, '; ')}\``;
  }
  return `\n\`\`\`numline\n${spec}\n\`\`\`\n`;
}

function ShapeRow({ shape, onChange, onRemove }) {
  const patch = (delta) => onChange({ ...shape, ...delta });
  return (
    <Space wrap style={{ width: '100%', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #eee' }}>
      <Space wrap size={6}>
        {shape.type === 'ray' && (
          <>
            <span style={{ color: '#888' }}>Луч</span>
            <Segmented
              size="small"
              value={shape.dir}
              onChange={(dir) => patch({ dir })}
              options={[{ value: 'left', label: '← влево' }, { value: 'right', label: 'вправо →' }]}
            />
            <span style={{ color: '#888' }}>от</span>
            <Input size="small" style={{ width: 64 }} value={shape.x} onChange={(e) => patch({ x: e.target.value })} placeholder="1/2" />
            <Tooltip title="Закрашенная точка = нестрогое неравенство (≤/≥)">
              <Switch size="small" checkedChildren="●" unCheckedChildren="○" checked={shape.filled} onChange={(filled) => patch({ filled })} />
            </Tooltip>
          </>
        )}
        {shape.type === 'seg' && (
          <>
            <span style={{ color: '#888' }}>Отрезок</span>
            <Input size="small" style={{ width: 60 }} value={shape.a} onChange={(e) => patch({ a: e.target.value })} placeholder="1/2" />
            <Switch size="small" checkedChildren="●" unCheckedChildren="○" checked={shape.ea} onChange={(ea) => patch({ ea })} />
            <span style={{ color: '#888' }}>—</span>
            <Input size="small" style={{ width: 60 }} value={shape.b} onChange={(e) => patch({ b: e.target.value })} placeholder="2" />
            <Switch size="small" checkedChildren="●" unCheckedChildren="○" checked={shape.eb} onChange={(eb) => patch({ eb })} />
          </>
        )}
        {shape.type === 'all' && (
          <span style={{ color: '#888' }}>Вся прямая — решение любое число</span>
        )}
        {shape.type === 'point' && (
          <>
            <span style={{ color: '#888' }}>Точка</span>
            <Input size="small" style={{ width: 64 }} value={shape.x} onChange={(e) => patch({ x: e.target.value })} placeholder="1/2" />
            <Switch size="small" checkedChildren="●" unCheckedChildren="○" checked={shape.filled} onChange={(filled) => patch({ filled })} />
          </>
        )}
        {shape.type === 'tick' && (
          <>
            <span style={{ color: '#888' }}>Подпись в</span>
            <Input size="small" style={{ width: 64 }} value={shape.x} onChange={(e) => patch({ x: e.target.value })} placeholder="1.41" />
            <Input size="small" style={{ width: 110 }} maxLength={40} value={shape.label} onChange={(e) => patch({ label: e.target.value })} placeholder="\sqrt{2}" />
            <Tooltip title="Жирная подпись">
              <Switch size="small" checkedChildren="Ж" unCheckedChildren="Ж" checked={!!shape.bold} onChange={(bold) => patch({ bold })} />
            </Tooltip>
          </>
        )}
      </Space>
      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
    </Space>
  );
}

function MarkRow({ mark, onChange, onRemove }) {
  const patch = (delta) => onChange({ ...mark, ...delta });
  return (
    <Space wrap style={{ width: '100%', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #eee' }}>
      <Space wrap size={6}>
        <span style={{ color: '#888' }}>Точка</span>
        <Input size="small" style={{ width: 90 }} maxLength={24} value={mark.label} onChange={(e) => patch({ label: e.target.value })} placeholder="A" />
        <Tooltip title="Жирная подпись">
          <Switch size="small" checkedChildren="Ж" unCheckedChildren="Ж" checked={!!mark.bold} onChange={(bold) => patch({ bold })} />
        </Tooltip>
        <span style={{ color: '#888' }}>в координате</span>
        <InputNumber size="small" step={0.1} style={{ width: 90 }} value={mark.x} onChange={(x) => patch({ x: x ?? 0 })} />
      </Space>
      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
    </Space>
  );
}

const DEFAULT_INTERVALS = { domain: [0, 3], shapes: [{ ...SHAPE_DEFAULTS.ray }] };
const DEFAULT_POINTS = {
  scale: { from: -1, to: 5, step: 1 },
  marks: [{ label: 'A', x: 0 }, { label: 'B', x: 2 }],
};

const DEFAULT_STATE = {
  kind: 'intervals',
  axisLabel: 'x',
  axisBold: false,
  domain: DEFAULT_INTERVALS.domain,
  shapes: DEFAULT_INTERVALS.shapes,
  showLabels: true,
};

export default function NumberLineModal({
  open, onCancel, onInsert, defaultFormat = 'block', initialSpec = null,
}) {
  const [kind, setKind] = useState('intervals'); // 'intervals' | 'points'
  const [axisLabel, setAxisLabel] = useState('x');
  const [axisBold, setAxisBold] = useState(false);
  const [format, setFormat] = useState(defaultFormat);
  const [editing, setEditing] = useState(false);

  // тип «Неравенства»
  const [domain, setDomain] = useState(DEFAULT_INTERVALS.domain);
  const [shapes, setShapes] = useState(DEFAULT_INTERVALS.shapes);
  // Подписи координат под осью. Обычно нужны, но для задач «определите знаки
  // коэффициентов по рисунку» точки должны остаться без чисел.
  const [showLabels, setShowLabels] = useState(true);

  // тип «Точки на прямой»
  const [scale, setScale] = useState(DEFAULT_POINTS.scale);
  const [marks, setMarks] = useState(DEFAULT_POINTS.marks);
  // Засечки можно выключить: голая ось с буквами (диапазон — из domain).
  const [useScale, setUseScale] = useState(true);

  // Состояние поднимается заново при каждом открытии (тот же приём, что в
  // GridPaperModal): под правку — из готового DSL, под вставку — из дефолтов.
  const [session, setSession] = useState(null);
  const token = open ? `${initialSpec ?? ''}|${defaultFormat}` : null;
  if (token !== session) {
    setSession(token);
    if (open) {
      const parsed = initialSpec ? specToNumlineState(initialSpec) : null;
      const st = parsed?.ok ? parsed.state : DEFAULT_STATE;
      setEditing(!!parsed?.ok);
      setKind(st.kind);
      setAxisLabel(st.axisLabel);
      setAxisBold(st.axisBold);
      setFormat(defaultFormat);
      if (st.kind === 'points') {
        setUseScale(!!st.scale);
        setScale(st.scale || DEFAULT_POINTS.scale);
        setDomain(st.domain || DEFAULT_INTERVALS.domain);
        setMarks(st.marks);
        setShapes([{ ...SHAPE_DEFAULTS.ray }]);
        setShowLabels(st.showLabels);
      } else {
        setDomain(st.domain);
        setShapes(st.shapes.map((sh) => ({ ...sh })));
        setShowLabels(st.showLabels);
        setUseScale(true);
        setScale(DEFAULT_POINTS.scale);
        setMarks(DEFAULT_POINTS.marks.map((m) => ({ ...m })));
      }
    }
  }

  const spec = useMemo(() => (
    kind === 'points'
      ? pointsToSpec({
        scale: useScale ? scale : null, domain: useScale ? null : domain, marks, axisLabel, axisBold, showLabels,
      })
      : shapesToSpec({
        domain, shapes, axisLabel, axisBold, showLabels,
      })
  ), [kind, scale, useScale, marks, domain, shapes, axisLabel, axisBold, showLabels]);

  const addShape = (type) => setShapes((arr) => [...arr, { ...SHAPE_DEFAULTS[type] }]);
  const updateShape = (i, next) => setShapes((arr) => arr.map((s, idx) => (idx === i ? next : s)));
  const removeShape = (i) => setShapes((arr) => arr.filter((_, idx) => idx !== i));

  const addMark = () => setMarks((arr) => [...arr, { label: '', x: 0, bold: false }]);
  const updateMark = (i, next) => setMarks((arr) => arr.map((m, idx) => (idx === i ? next : m)));
  const removeMark = (i) => setMarks((arr) => arr.filter((_, idx) => idx !== i));

  const handleInsert = () => onInsert(buildNumlineSnippet(spec, format));

  // Подписи координат: у штриховки — числа под точками, у линейки — числа засечек.
  const labelsSwitch = (
    <Space>
      <span style={{ color: '#888' }}>Подписи координат:</span>
      <Tooltip title="Выключите, если по рисунку нужно определить знаки коэффициентов: точки и штриховка останутся, чисел под осью не будет">
        <Switch
          size="small"
          checkedChildren="1"
          unCheckedChildren="—"
          checked={showLabels}
          onChange={setShowLabels}
        />
      </Tooltip>
    </Space>
  );

  // Диапазон оси — общий для штриховки и для оси без засечек.
  const domainInputs = (
    <Space>
      <span style={{ color: '#888' }}>Диапазон оси:</span>
      <InputNumber size="small" style={{ width: 80 }} value={domain[0]} onChange={(v) => setDomain([v ?? 0, domain[1]])} />
      <span>…</span>
      <InputNumber size="small" style={{ width: 80 }} value={domain[1]} onChange={(v) => setDomain([domain[0], v ?? 1])} />
    </Space>
  );

  return (
    <Modal
      title={editing ? 'Правка числовой прямой' : 'Числовая прямая'}
      open={open}
      onCancel={onCancel}
      onOk={handleInsert}
      okText={editing ? 'Сохранить' : 'Вставить'}
      cancelText="Отмена"
      width={580}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Тип прямой */}
        <Segmented
          block
          value={kind}
          onChange={setKind}
          options={[
            { value: 'intervals', label: 'Неравенства (штриховка)' },
            { value: 'points', label: 'Точки на прямой' },
          ]}
        />

        {/* Превью */}
        <div style={{ textAlign: 'center', padding: '10px 8px', background: '#fafafa', border: '1px solid #eee', borderRadius: 6 }}>
          <NumberLineSVG spec={spec} />
        </div>

        {/* Буква оси */}
        <Space>
          <span style={{ color: '#888' }}>Буква оси:</span>
          <Input size="small" style={{ width: 96 }} maxLength={16} value={axisLabel} onChange={(e) => setAxisLabel(e.target.value || 'x')} placeholder="x" />
          <Tooltip title="Жирная буква оси">
            <Switch size="small" checkedChildren="Ж" unCheckedChildren="Ж" checked={axisBold} onChange={setAxisBold} />
          </Tooltip>
          <Tooltip title="Подписи набираются как формулы: индексы (A_1), дроби \frac{1}{2}, корни \sqrt{2}, греческие буквы (\pi, \varphi). Обыкновенную дробь можно писать и просто «1/2».">
            <span style={{ color: '#bbb', cursor: 'help' }}>(x, y, t, \varphi… — можно формулой) ?</span>
          </Tooltip>
        </Space>

        {kind === 'intervals' ? (
          <>
            {domainInputs}

            {/* Подписи координат — выключаются целиком (точки без чисел) */}
            {labelsSwitch}

            {/* Список фигур */}
            <div>
              {shapes.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Пустая прямая — решений нет. Или добавьте луч, отрезок, точку" />
              ) : (
                shapes.map((s, i) => (
                  <ShapeRow key={i} shape={s} onChange={(next) => updateShape(i, next)} onRemove={() => removeShape(i)} />
                ))
              )}
            </div>

            <Space>
              <Button size="small" icon={<PlusOutlined />} onClick={() => addShape('ray')}>Луч</Button>
              <Button size="small" icon={<PlusOutlined />} onClick={() => addShape('seg')}>Отрезок</Button>
              <Button size="small" icon={<PlusOutlined />} onClick={() => addShape('point')}>Точка</Button>
              <Tooltip title="Заштрихованная прямая целиком, без точек — когда решением служит любое число">
                <Button size="small" icon={<PlusOutlined />} onClick={() => addShape('all')}>Вся прямая</Button>
              </Tooltip>
              <Tooltip title="Подпись под осью без точки: число, дробь или формула (\sqrt{2}, \pi)">
                <Button size="small" icon={<PlusOutlined />} onClick={() => addShape('tick')}>Подпись</Button>
              </Tooltip>
            </Space>
            <span style={{ color: '#bbb', fontSize: 12 }}>В координате можно вводить дроби: 1/2, -3/4 (отрисуются дробью под осью)</span>
          </>
        ) : (
          <>
            {/* Линейка (засечки с числами) или голая ось с диапазоном */}
            <Space wrap>
              <span style={{ color: '#888' }}>Засечки:</span>
              <Tooltip title="Выключите, если числа на оси не нужны — останутся только буквы над точками">
                <Switch size="small" checked={useScale} onChange={setUseScale} />
              </Tooltip>
              {useScale && (
                <>
                  <InputNumber size="small" style={{ width: 72 }} value={scale.from} onChange={(v) => setScale((s) => ({ ...s, from: v ?? 0 }))} />
                  <span>…</span>
                  <InputNumber size="small" style={{ width: 72 }} value={scale.to} onChange={(v) => setScale((s) => ({ ...s, to: v ?? 1 }))} />
                  <span style={{ color: '#888' }}>шаг</span>
                  <InputNumber size="small" min={0.1} style={{ width: 64 }} value={scale.step} onChange={(v) => setScale((s) => ({ ...s, step: v ?? 1 }))} />
                </>
              )}
            </Space>
            {useScale ? labelsSwitch : domainInputs}

            {/* Помеченные точки */}
            <div>
              {marks.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Добавьте помеченную точку" />
              ) : (
                marks.map((m, i) => (
                  <MarkRow key={i} mark={m} onChange={(next) => updateMark(i, next)} onRemove={() => removeMark(i)} />
                ))
              )}
            </div>

            <Button size="small" icon={<PlusOutlined />} onClick={addMark}>Точка (A, B, …)</Button>
          </>
        )}

        {/* Формат вставки */}
        <Space align="center">
          <span style={{ color: '#888' }}>Формат:</span>
          <Segmented
            size="small"
            value={format}
            onChange={setFormat}
            options={[
              { value: 'block', label: 'Отдельным блоком' },
              { value: 'inline', label: 'В строку (для таблиц)' },
            ]}
          />
          <Tooltip title="«В строку» — компактный код `numline: …`, который можно вставлять прямо в ячейку markdown-таблицы. «Блоком» — крупная прямая на всю ширину.">
            <span style={{ color: '#bbb', cursor: 'help' }}>?</span>
          </Tooltip>
        </Space>
      </div>
    </Modal>
  );
}
