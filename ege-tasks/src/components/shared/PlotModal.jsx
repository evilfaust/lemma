import { useMemo, useState } from 'react';
import {
  Modal, Button, Space, Segmented, InputNumber, Input, Select, Switch, Empty, Tooltip, Alert,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import CoordPlotSVG from './CoordPlotSVG';
import './PlotModal.css';
import CurveCanvas from './CurveCanvas';
import CurvePanel, { describeCurve } from './CurvePanel';
import {
  plotToSpec, specToPlotState, compileExpr, PLOT_COLORS,
  DEFAULT_LABEL_AT, DEFAULT_LABEL_DIST, newCurveState, derivativePairSpecs,
} from '../../utils/coordPlot';

// Визуальный конструктор координатной плоскости. Три режима:
//  • «График функции» — формула y = f(x) (можно несколько кривых);
//  • «Кривая по точкам» — график «как в ЕГЭ»: точки ставятся и двигаются
//    мышью, рядом рисуются производная и первообразная (CurvePanel/CurveCanvas);
//  • «Векторы» — стрелки на клетчатой плоскости с подписями a, b, …
// Окно/клетка/точки общие для обоих режимов. На каждый чих собираем DSL
// (plotToSpec) и показываем живое превью. По «Вставить» отдаём готовый сниппет.
//
// `initialSpec` включает режим ПРАВКИ: состояние поднимается из готового DSL
// (`specToPlotState`), и вызывающий редактор заменяет найденный блок, а не
// вставляет новый. В правке сериализуются обе коллекции (кривые И векторы) —
// переключение вкладки не должно стирать то, что учитель не трогал.

const COLOR_LABEL = {
  ink: 'чёрный', orange: 'оранжевый', blue: 'синий', green: 'зелёный',
  red: 'красный', violet: 'фиолетовый', gray: 'серый',
};
const COLOR_OPTIONS = PLOT_COLORS.map((c) => ({ value: c, label: COLOR_LABEL[c] || c }));

// Шаблоны формул — вставляют готовую кривую, коэффициенты правятся прямо в поле.
const TEMPLATES = [
  { label: 'Прямая', expr: '2x+1' },
  { label: 'Парабола', expr: 'x^2-4' },
  { label: 'Гипербола', expr: '2/x' },
  { label: 'Показательная', expr: '2^x' },
  { label: 'Логарифм', expr: 'log(2,x)' },
  { label: 'Корень', expr: 'sqrt(x)' },
  { label: 'Модуль', expr: 'abs(x)' },
  { label: 'Синус', expr: 'sin(x)' },
];

// Куда отодвинуть подпись от точки — по кругу, начиная с левого верха.
// Спасает, когда подпись накрывает график или соседнюю точку.
const LABEL_AT_OPTIONS = [
  { value: 'nw', label: '↖ влево-вверх' },
  { value: 'n', label: '↑ вверх' },
  { value: 'ne', label: '↗ вправо-вверх' },
  { value: 'e', label: '→ вправо' },
  { value: 'se', label: '↘ вправо-вниз' },
  { value: 's', label: '↓ вниз' },
  { value: 'sw', label: '↙ влево-вниз' },
  { value: 'w', label: '← влево' },
];

const MODE_TITLE = {
  function: 'График функции',
  curve: 'Кривая по точкам',
  vectors: 'Векторы на плоскости',
};

const SIZE_OPTIONS = [
  { value: 220, label: 'S' },
  { value: 280, label: 'M' },
  { value: 360, label: 'L' },
];

const DEFAULT_VIEW = { xrange: [-5, 5], yrange: [-5, 5], grid: 1, axisX: 'x', axisY: 'y', units: true, width: 280 };
const DEFAULT_CURVES = [{ expr: 'x^2-4', color: 'ink', from: '', to: '', dash: false }];
const DEFAULT_VECTORS = [{ label: 'a', x1: 0, y1: 0, x2: 3, y2: 2, color: 'ink', side: 'left' }];
const DEFAULT_SPLINES = [newCurveState('f', [
  { x: -4, y: -3 }, { x: -2, y: 2 }, { x: 1, y: -2 }, { x: 3, y: 3 }, { x: 4.5, y: 1 },
].map((n) => ({ ...n, flat: false, slope: null })))];
// Холст кривой крупнее итоговой картинки — точки ставить мышью удобнее.
// На широком окне он стоит в своей колонке рядом с панелью, на узком — над
// ней, и тогда его приходится ужимать: иначе холст съедает всю высоту экрана,
// а таблица точек и разбор графика уезжают под прокрутку.
// Экспортируется, чтобы тесты считали координаты ручек по тем же размерам.
export const TWO_COLUMN_MIN_WIDTH = 1100; // совпадает с медиазапросом PlotModal.css

export function curveCanvasSize() {
  const w = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const h = typeof window === 'undefined' ? 900 : window.innerHeight;
  if (w > TWO_COLUMN_MIN_WIDTH) return { width: 720, maxHeight: 460 };
  return { width: Math.max(320, Math.min(600, w - 180)), maxHeight: Math.max(260, Math.round(h * 0.38)) };
}
// Части чертежа без своего UI (отрезки, засечки, чужие строки) — конструктор
// их не показывает, но при правке переписывает как есть.
const EMPTY_EXTRA = { segments: [], xticks: [], yticks: [], raw: [] };

const inlinePlot = (spec) => `\`plot: ${spec.replace(/\n/g, '; ')}\``;

// Готовый к вставке сниппет: блочный fenced (```plot), inline-код
// (`plot: a; b`) — для ячеек markdown-таблиц — или пара «f′ | f»: однострочная
// таблица-галерея из двух inline-картинок (как в справочнике «если f′ — то f»).
export function buildPlotSnippet(spec, format, pair = null) {
  if (format === 'pair' && pair) {
    return `\n{галерея}\n| ${inlinePlot(pair.left)} | ${inlinePlot(pair.right)} |\n`;
  }
  if (format === 'inline') return inlinePlot(spec);
  return `\n\`\`\`plot\n${spec}\n\`\`\`\n`;
}

// Вкладка при правке: чем блок в основном нарисован.
function initialMode(st, kind) {
  if (!st) return kind;
  if (st.vectors.length && !st.curves.length && !st.splines.length) return 'vectors';
  if (st.splines.length && !st.curves.length && !st.vectors.length) return 'curve';
  return kind;
}

const rowStyle = { width: '100%', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #eee' };

function CurveRow({ curve, onChange, onRemove }) {
  const patch = (delta) => onChange({ ...curve, ...delta });
  const { error } = useMemo(() => compileExpr(curve.expr), [curve.expr]);
  return (
    <div style={{ borderBottom: '1px dashed #eee', padding: '6px 0' }}>
      <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space wrap size={6}>
          <span style={{ color: '#888' }}>y =</span>
          <Input
            size="small"
            style={{ width: 180 }}
            value={curve.expr}
            onChange={(e) => patch({ expr: e.target.value })}
            placeholder="x^2-4"
            status={error ? 'error' : ''}
          />
          <Select size="small" style={{ width: 118 }} value={curve.color} onChange={(color) => patch({ color })} options={COLOR_OPTIONS} />
          <Tooltip title="Пунктиром">
            <Switch size="small" checkedChildren="- -" unCheckedChildren="—" checked={!!curve.dash} onChange={(dash) => patch({ dash })} />
          </Tooltip>
          <Tooltip title="Рисовать только на части оси X (пусто — на всём окне)">
            <Space size={4}>
              <span style={{ color: '#bbb' }}>от</span>
              <Input size="small" style={{ width: 52 }} value={curve.from} onChange={(e) => patch({ from: e.target.value })} placeholder="—" />
              <span style={{ color: '#bbb' }}>до</span>
              <Input size="small" style={{ width: 52 }} value={curve.to} onChange={(e) => patch({ to: e.target.value })} placeholder="—" />
            </Space>
          </Tooltip>
        </Space>
        <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
      </Space>
      {error && <div style={{ color: '#cf1322', fontSize: 12 }}>{error}</div>}
    </div>
  );
}

function VectorRow({ vec, onChange, onRemove }) {
  const patch = (delta) => onChange({ ...vec, ...delta });
  const numProps = { size: 'small', step: 1, style: { width: 62 } };
  return (
    <Space wrap style={rowStyle}>
      <Space wrap size={6}>
        <Input size="small" style={{ width: 74 }} maxLength={16} value={vec.label} onChange={(e) => patch({ label: e.target.value })} placeholder="a" />
        <Tooltip title="Жирная подпись"><Switch size="small" checkedChildren="Ж" unCheckedChildren="Ж" checked={!!vec.bold} onChange={(bold) => patch({ bold })} /></Tooltip>
        <span style={{ color: '#888' }}>из</span>
        <InputNumber {...numProps} value={vec.x1} onChange={(v) => patch({ x1: v ?? 0 })} />
        <InputNumber {...numProps} value={vec.y1} onChange={(v) => patch({ y1: v ?? 0 })} />
        <span style={{ color: '#888' }}>в</span>
        <InputNumber {...numProps} value={vec.x2} onChange={(v) => patch({ x2: v ?? 0 })} />
        <InputNumber {...numProps} value={vec.y2} onChange={(v) => patch({ y2: v ?? 0 })} />
        <Select size="small" style={{ width: 112 }} value={vec.color} onChange={(color) => patch({ color })} options={COLOR_OPTIONS} />
        <Tooltip title="С какой стороны от стрелки стоит подпись">
          <Segmented
            size="small"
            value={vec.side || 'left'}
            onChange={(side) => patch({ side })}
            options={[{ value: 'left', label: 'подпись слева' }, { value: 'right', label: 'справа' }]}
          />
        </Tooltip>
      </Space>
      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
    </Space>
  );
}

function PointRow({ point, onChange, onRemove }) {
  const patch = (delta) => onChange({ ...point, ...delta });
  const numProps = { size: 'small', step: 1, style: { width: 62 } };
  return (
    <Space wrap style={rowStyle}>
      <Space wrap size={6}>
        <span style={{ color: '#888' }}>Точка</span>
        <InputNumber {...numProps} value={point.x} onChange={(v) => patch({ x: v ?? 0 })} />
        <InputNumber {...numProps} value={point.y} onChange={(v) => patch({ y: v ?? 0 })} />
        <Tooltip title="Закрашенная / выколотая">
          <Switch size="small" checkedChildren="●" unCheckedChildren="○" checked={point.filled !== false} onChange={(filled) => patch({ filled })} />
        </Tooltip>
        <Input size="small" style={{ width: 104 }} maxLength={48} value={point.label} onChange={(e) => patch({ label: e.target.value })} placeholder="подпись" />
        <Tooltip title="Жирная подпись">
          <Switch size="small" checkedChildren="Ж" unCheckedChildren="Ж" disabled={!point.label} checked={!!point.labelBold} onChange={(labelBold) => patch({ labelBold })} />
        </Tooltip>
        <Tooltip title="Куда сдвинуть подпись относительно точки — если её перекрывает график">
          <Select
            size="small"
            style={{ width: 138 }}
            disabled={!point.label}
            value={point.labelAt || DEFAULT_LABEL_AT}
            onChange={(labelAt) => patch({ labelAt })}
            options={LABEL_AT_OPTIONS}
          />
        </Tooltip>
        <Tooltip title="Насколько далеко отодвинуть подпись: 1 — вплотную к точке, 2–3 — если рядом проходит график">
          <InputNumber
            size="small"
            style={{ width: 62 }}
            min={0.5}
            max={5}
            step={0.5}
            disabled={!point.label}
            value={point.labelDist ?? DEFAULT_LABEL_DIST}
            onChange={(labelDist) => patch({ labelDist: labelDist ?? DEFAULT_LABEL_DIST })}
          />
        </Tooltip>
        <Select size="small" style={{ width: 112 }} value={point.color} onChange={(color) => patch({ color })} options={COLOR_OPTIONS} />
      </Space>
      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
    </Space>
  );
}

// Подпись сама по себе — без кружка. Так помечают точку пересечения графиков
// («2» на оси Y), и именно такие подписи чаще всего лезут под линию.
function LabelRow({ label, onChange, onRemove }) {
  const patch = (delta) => onChange({ ...label, ...delta });
  const numProps = { size: 'small', step: 1, style: { width: 62 } };
  return (
    <Space wrap style={rowStyle}>
      <Space wrap size={6}>
        <span style={{ color: '#888' }}>Подпись</span>
        <InputNumber {...numProps} value={label.x} onChange={(v) => patch({ x: v ?? 0 })} />
        <InputNumber {...numProps} value={label.y} onChange={(v) => patch({ y: v ?? 0 })} />
        <Input
          size="small"
          style={{ width: 140 }}
          maxLength={64}
          value={label.text}
          onChange={(e) => patch({ text: e.target.value })}
          placeholder="текст или формула"
        />
        <Tooltip title="Жирная подпись">
          <Switch size="small" checkedChildren="Ж" unCheckedChildren="Ж" checked={!!label.bold} onChange={(bold) => patch({ bold })} />
        </Tooltip>
        <Tooltip title="Куда сдвинуть подпись относительно её координаты — если её перекрывает график">
          <Select
            size="small"
            style={{ width: 138 }}
            value={label.at || DEFAULT_LABEL_AT}
            onChange={(at) => patch({ at })}
            options={LABEL_AT_OPTIONS}
          />
        </Tooltip>
        <Tooltip title="Насколько далеко отодвинуть подпись: 1 — вплотную, 2–3 — если рядом проходит график">
          <InputNumber
            size="small"
            style={{ width: 62 }}
            min={0.5}
            max={5}
            step={0.5}
            value={label.dist ?? DEFAULT_LABEL_DIST}
            onChange={(dist) => patch({ dist: dist ?? DEFAULT_LABEL_DIST })}
          />
        </Tooltip>
        <Select size="small" style={{ width: 112 }} value={label.color} onChange={(color) => patch({ color })} options={COLOR_OPTIONS} />
      </Space>
      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
    </Space>
  );
}

export default function PlotModal({
  open, onCancel, onInsert, kind = 'function', defaultFormat = 'block', initialSpec = null,
}) {
  const [mode, setMode] = useState(kind);
  const [format, setFormat] = useState(defaultFormat);
  const [view, setView] = useState(DEFAULT_VIEW);
  const [curves, setCurves] = useState(DEFAULT_CURVES);
  const [vectors, setVectors] = useState(DEFAULT_VECTORS);
  const [splines, setSplines] = useState(DEFAULT_SPLINES);
  const [annotations, setAnnotations] = useState([]);
  const [activeCurve, setActiveCurve] = useState(0);
  const [selectedNode, setSelectedNode] = useState(null);
  const [step, setStep] = useState(0.5);
  const [points, setPoints] = useState([]);
  const [labels, setLabels] = useState([]);
  const [extra, setExtra] = useState(EMPTY_EXTRA);
  const [editing, setEditing] = useState(false);

  // Состояние поднимается заново при каждом открытии: под кнопку («График» /
  // «Векторы») — дефолты, под найденный блок — его разбор. setState во время
  // рендера — обычный паттерн производного состояния, лишнего кадра не даёт.
  const [session, setSession] = useState(null);
  const token = open ? `${kind}|${initialSpec ?? ''}` : null;
  if (token !== session) {
    setSession(token);
    if (open) {
      const st = initialSpec ? specToPlotState(initialSpec) : null;
      setEditing(!!st);
      setFormat(defaultFormat);
      setView(st ? { ...DEFAULT_VIEW, ...st.view } : DEFAULT_VIEW);
      setCurves(st ? st.curves : DEFAULT_CURVES);
      setVectors(st ? st.vectors : DEFAULT_VECTORS);
      setSplines(st ? st.splines : DEFAULT_SPLINES);
      setAnnotations(st ? st.annotations : []);
      setActiveCurve(0);
      setSelectedNode(null);
      setPoints(st ? st.points : []);
      setLabels(st ? st.labels : []);
      setExtra(st ? {
        segments: st.segments, xticks: st.xticks, yticks: st.yticks, raw: st.raw,
      } : EMPTY_EXTRA);
      setMode(initialMode(st, kind));
    }
  }

  const patchView = (delta) => setView((v) => ({ ...v, ...delta }));

  // В правке сериализуется всё; при вставке — только то, что на вкладке.
  const plotState = useMemo(() => ({
    view,
    curves: editing || mode === 'function' ? curves : [],
    splines: editing || mode === 'curve' ? splines : [],
    annotations: editing || mode === 'curve' ? annotations : [],
    vectors: editing || mode === 'vectors' ? vectors : [],
    points,
    labels,
    ...extra,
  }), [view, mode, curves, splines, annotations, vectors, points, labels, extra, editing]);
  const spec = useMemo(() => plotToSpec(plotState), [plotState]);

  // Размеры холста зависят от окна браузера, поэтому считаются на открытие
  // модалки (session меняется при каждом открытии).
  const canvas = useMemo(() => curveCanvasSize(), [session]);

  const curve = splines[activeCurve] || null;
  const curveInfo = useMemo(
    () => (curve ? describeCurve(curve) : { error: null, lines: [], kinds: [] }),
    [curve],
  );
  const canPair = mode === 'curve' && !!curve;
  const effectiveFormat = format === 'pair' && !canPair ? 'block' : format;
  const pair = useMemo(
    () => (effectiveFormat === 'pair' ? derivativePairSpecs(plotState, activeCurve) : null),
    [effectiveFormat, plotState, activeCurve],
  );

  const addCurve = (expr = 'x') => setCurves((arr) => [...arr, { expr, color: 'ink', from: '', to: '', dash: false }]);
  const addVector = () => setVectors((arr) => [
    ...arr,
    { label: String.fromCharCode(97 + arr.length), x1: 0, y1: 0, x2: 2, y2: 3, color: 'ink', side: 'left' },
  ]);
  const addPoint = () => setPoints((arr) => [...arr, {
    x: 1,
    y: 1,
    filled: true,
    label: '',
    labelAt: DEFAULT_LABEL_AT,
    labelDist: DEFAULT_LABEL_DIST,
    labelBold: false,
    color: 'ink',
  }]);
  const addLabel = () => setLabels((arr) => [...arr, {
    x: 1, y: 1, text: 'A', at: DEFAULT_LABEL_AT, dist: DEFAULT_LABEL_DIST, bold: false, color: 'ink',
  }]);
  const upd = (setter) => (i, next) => setter((arr) => arr.map((it, idx) => (idx === i ? next : it)));
  const del = (setter) => (i) => setter((arr) => arr.filter((_, idx) => idx !== i));

  const handleInsert = () => {
    onInsert(buildPlotSnippet(spec, effectiveFormat, pair));
    setSession(null); // следующее открытие начнётся с чистого листа
  };

  return (
    <Modal
      title={`${editing ? 'Правка: ' : ''}${MODE_TITLE[mode] || MODE_TITLE.function}`}
      open={open}
      onCancel={onCancel}
      onOk={handleInsert}
      okText={editing ? 'Сохранить' : 'Вставить'}
      cancelText="Отмена"
      // Окно широкое: строки кривых, векторов и точек — это длинные ряды
      // контролов, на 760px они переносились по три раза. maxWidth в vw/vh
      // оставляет запас на ноутбуке и на половине экрана.
      width={1240}
      style={{ top: 16, maxWidth: '96vw', paddingBottom: 16 }}
      styles={{ body: { maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' } }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Segmented
          block
          value={mode}
          onChange={setMode}
          options={[
            { value: 'function', label: 'График функции' },
            { value: 'curve', label: 'Кривая по точкам' },
            { value: 'vectors', label: 'Векторы' },
          ]}
        />

        <div className="plot-modal-grid">
        {/* Превью: в режиме кривой — холст, на котором точки двигаются мышью */}
        <div className="plot-modal-preview">
          {mode === 'curve' && curve ? (
            <CurveCanvas
              spec={spec}
              nodes={curve.nodes}
              kinds={curveInfo.kinds}
              selected={selectedNode}
              onSelect={setSelectedNode}
              onNodesChange={(nodes) => setSplines((arr) => arr.map((c, i) => (i === activeCurve ? { ...c, nodes } : c)))}
              step={step}
              width={canvas.width}
              maxHeight={canvas.maxHeight}
            />
          ) : (
            <CoordPlotSVG spec={spec} />
          )}
          {pair && (
            <div data-testid="pair-preview" style={{ marginTop: 10, borderTop: '1px dashed #e5e5e5', paddingTop: 8 }}>
              <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>Так вставится: слева производная, справа кривая</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <CoordPlotSVG spec={pair.left} />
                <CoordPlotSVG spec={pair.right} />
              </div>
            </div>
          )}
        </div>

        <div className="plot-modal-controls">
        {/* Окно и клетка */}
        <Space wrap size={8}>
          <span style={{ color: '#888' }}>X от</span>
          <InputNumber size="small" style={{ width: 70 }} value={view.xrange[0]} onChange={(v) => patchView({ xrange: [v ?? -5, view.xrange[1]] })} />
          <span style={{ color: '#888' }}>до</span>
          <InputNumber size="small" style={{ width: 70 }} value={view.xrange[1]} onChange={(v) => patchView({ xrange: [view.xrange[0], v ?? 5] })} />
          <span style={{ color: '#888', marginLeft: 8 }}>Y от</span>
          <InputNumber size="small" style={{ width: 70 }} value={view.yrange[0]} onChange={(v) => patchView({ yrange: [v ?? -5, view.yrange[1]] })} />
          <span style={{ color: '#888' }}>до</span>
          <InputNumber size="small" style={{ width: 70 }} value={view.yrange[1]} onChange={(v) => patchView({ yrange: [view.yrange[0], v ?? 5] })} />
        </Space>
        <Space wrap size={8}>
          <span style={{ color: '#888' }}>Клетка</span>
          <InputNumber size="small" min={0} step={0.5} style={{ width: 70 }} value={view.grid} onChange={(v) => patchView({ grid: v ?? 1 })} />
          <span style={{ color: '#888', marginLeft: 8 }}>Размер</span>
          <Segmented size="small" value={view.width} onChange={(w) => patchView({ width: w })} options={SIZE_OPTIONS} />
          <span style={{ color: '#888', marginLeft: 8 }}>Оси</span>
          <Input size="small" style={{ width: 48 }} maxLength={3} value={view.axisX} onChange={(e) => patchView({ axisX: e.target.value || 'x' })} />
          <Input size="small" style={{ width: 48 }} maxLength={3} value={view.axisY} onChange={(e) => patchView({ axisY: e.target.value || 'y' })} />
          <Tooltip title="Подписывать единичный отрезок «1» и начало координат O">
            <Space size={4}>
              <span style={{ color: '#888' }}>единицы</span>
              <Switch size="small" checked={view.units !== false} onChange={(units) => patchView({ units })} />
            </Space>
          </Tooltip>
        </Space>

        {mode === 'curve' && (
          <CurvePanel
            splines={splines}
            onSplinesChange={setSplines}
            active={Math.min(activeCurve, Math.max(splines.length - 1, 0))}
            onActive={setActiveCurve}
            annotations={annotations}
            onAnnotationsChange={setAnnotations}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
            step={step}
            onStep={setStep}
            info={curveInfo}
          />
        )}
        {mode === 'function' && (
          <>
            <div>
              {curves.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Добавьте формулу" />
              ) : (
                curves.map((c, i) => (
                  <CurveRow key={i} curve={c} onChange={(next) => upd(setCurves)(i, next)} onRemove={() => del(setCurves)(i)} />
                ))
              )}
            </div>
            <Space wrap size={4}>
              <Button size="small" icon={<PlusOutlined />} onClick={() => addCurve('x')}>Формула</Button>
              <span style={{ color: '#bbb', margin: '0 4px' }}>шаблоны:</span>
              {TEMPLATES.map((t) => (
                <Button key={t.label} size="small" type="dashed" onClick={() => addCurve(t.expr)}>{t.label}</Button>
              ))}
            </Space>
            <Alert
              type="info"
              showIcon={false}
              banner
              message={(
                <span style={{ fontSize: 12 }}>
                  Можно писать: <code>2x+1</code>, <code>x^2-4</code>, <code>1/x</code>, <code>2^x</code>,{' '}
                  <code>sqrt(x-1)</code>, <code>abs(x)</code>, <code>sin(x)</code>, <code>ln(x)</code>,{' '}
                  <code>lg(x)</code>, <code>log(2,x)</code>. Дробные числа — через точку или запятую.
                </span>
              )}
            />
          </>
        )}
        {mode === 'vectors' && (
          <>
            <div>
              {vectors.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Добавьте вектор" />
              ) : (
                vectors.map((v, i) => (
                  <VectorRow key={i} vec={v} onChange={(next) => upd(setVectors)(i, next)} onRemove={() => del(setVectors)(i)} />
                ))
              )}
            </div>
            <Space>
              <Button size="small" icon={<PlusOutlined />} onClick={addVector}>Вектор</Button>
              <span style={{ color: '#bbb', fontSize: 12 }}>Подпись рисуется со стрелочкой сверху, как $\vec a$; можно с индексом — <code>F_1</code></span>
            </Space>
          </>
        )}

        {/* Точки и отдельные подписи — общие для обоих режимов */}
        <div>
          {points.map((p, i) => (
            <PointRow key={i} point={p} onChange={(next) => upd(setPoints)(i, next)} onRemove={() => del(setPoints)(i)} />
          ))}
          {labels.map((l, i) => (
            <LabelRow key={i} label={l} onChange={(next) => upd(setLabels)(i, next)} onRemove={() => del(setLabels)(i)} />
          ))}
        </div>
        <Space wrap>
          <Button size="small" icon={<PlusOutlined />} onClick={addPoint}>Точка</Button>
          <Tooltip title="Текст у координаты без кружка — например, отметить пересечение графиков">
            <Button size="small" icon={<PlusOutlined />} onClick={addLabel}>Подпись</Button>
          </Tooltip>
          <Tooltip title="Подписи набираются как формулы: индексы и степени (x_1, y^2), дроби \frac{a}{b}, корни \sqrt{2}, греческие буквы (\alpha, \pi), знаки (\le, \pm, \to, \infty), штрих f'(x). Обычные слова пишутся как есть.">
            <span style={{ color: '#bbb', fontSize: 12, cursor: 'help' }}>
              в подписи можно формулы: <code>x_1</code>, <code>\frac{'{\pi}{2}'}</code>, <code>\sqrt{'{2}'}</code>, <code>\alpha</code> ?
            </span>
          </Tooltip>
        </Space>

        {/* Формат вставки */}
        <Space align="center">
          <span style={{ color: '#888' }}>Формат:</span>
          <Segmented
            size="small"
            value={effectiveFormat}
            onChange={setFormat}
            options={[
              { value: 'block', label: 'Отдельным блоком' },
              { value: 'inline', label: 'В строку (для таблиц)' },
              ...(canPair ? [{ value: 'pair', label: `${curve.name}′ и ${curve.name} рядом` }] : []),
            ]}
          />
          <Tooltip title="«В строку» — компактный код `plot: …`, который можно вставлять прямо в ячейку markdown-таблицы. «Блоком» — картинка на отдельной строке. «Рядом» — две картинки в строку: график производной и сама кривая, как в справочнике «если f′ > 0 — то f возрастает».">
            <span style={{ color: '#bbb', cursor: 'help' }}>?</span>
          </Tooltip>
        </Space>
        </div>
        </div>
      </div>
    </Modal>
  );
}
