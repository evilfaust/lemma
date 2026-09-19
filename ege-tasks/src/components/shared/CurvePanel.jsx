import { useMemo } from 'react';
import {
  Button, Checkbox, Input, InputNumber, Segmented, Select, Space, Switch, Tag, Tooltip,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { cleanCurveNodes, newCurveState, PLOT_COLORS } from '../../utils/coordPlot';
import { POINT_STYLE_OPTIONS, POINT_SIZE_OPTIONS } from './plotPointOptions';
import {
  buildSpline, splineAnalysis, splineZeros, splineSignIntervals, integersInIntervals,
} from '../../utils/splineCurve';

// Панель конструктора «Кривая по точкам»: список кривых, что рисовать (кривую,
// её производную, первообразную), таблица опорных точек, разметка (касательная,
// точки на графике, пунктиры к оси, отрезок оси) и разбор графика — экстремумы
// и промежутки монотонности, посчитанные по той же модели, что рисует картинку.
//
// У кривой две РОЛИ. Обычно точки задают саму функцию f. Но в задачах ЕГЭ чаще
// рисуют производную («на рисунке изображён график f′(x)»), и тогда те же точки
// задают f′, а сама функция получается первообразной. В DSL роль видна по
// штриху в имени (`spline f'` + `prim f f'`), поэтому отдельного поля состояния
// нет — роль читается из имени, а разбор графика переключается вместе с ней:
// точки максимума f — это нули f′ со сменой + на −.
// Холст с перетаскиванием точек живёт отдельно (CurveCanvas) и делит с панелью
// выбранную точку.

const COLOR_LABEL = {
  ink: 'чёрный', orange: 'оранжевый', blue: 'синий', green: 'зелёный',
  red: 'красный', violet: 'фиолетовый', gray: 'серый',
};
const COLOR_OPTIONS = PLOT_COLORS.map((c) => ({ value: c, label: COLOR_LABEL[c] || c }));
const STYLE_OPTIONS = [
  { value: 'normal', label: '—' },
  { value: 'bold', label: 'жирно' },
  { value: 'dash', label: 'пунктир' },
];
const STYLE_SHORT = [
  { value: 'normal', label: '—' },
  { value: 'bold', label: 'жирно' },
  { value: 'dash', label: '- -' },
];
const STEP_OPTIONS = [
  { value: 1, label: '1' },
  { value: 0.5, label: '0,5' },
  { value: 0.1, label: '0,1' },
];
const KIND_TAG = {
  max: { color: 'volcano', text: 'максимум' },
  min: { color: 'green', text: 'минимум' },
  flat: { color: 'purple', text: 'f′ = 0' },
  plateau: { color: 'default', text: 'полка' },
  end: { color: 'default', text: 'край' },
};
const ANNOTATION_TYPES = [
  { value: 'part', label: 'Цветной участок', short: 'Участок' },
  { value: 'tangent', label: 'Касательная', short: 'Касательная' },
  { value: 'mark', label: 'Точка на графике', short: 'Точка' },
  { value: 'drop', label: 'Пунктир к оси', short: 'Пунктир' },
  { value: 'band', label: 'Отрезок оси', short: 'Отрезок оси' },
];
// В строке разметки тип — короткой подписью: строка и так плотная.
const ANNOTATION_SELECT = ANNOTATION_TYPES.map((t) => ({ value: t.value, label: t.short }));
const NAME_RE = /^[A-Za-z][A-Za-z0-9_]*'{0,2}$/;
const CURVE_NAMES = ['f', 'g', 'h', 'p', 'q', 'u', 'v', 'w'];

const fmt = (v) => String(Math.round(v * 1e4) / 1e4).replace('.', ',').replace(/^-/, '−');
const styleOf = (o) => (o.dash ? 'dash' : o.bold ? 'bold' : 'normal');
const styleDelta = (v) => ({ bold: v === 'bold', dash: v === 'dash' });
// Штрих в имени хранится прямым апострофом (так его пишут в DSL), а показываем
// типографский: f' → f′, f'' → f″.
const showName = (name) => String(name || '').replace(/''/g, '″').replace(/'/g, '′');
const prime = (name) => showName(`${name}'`);
const isDerivName = (name) => /'$/.test(String(name || ''));
const baseName = (name) => String(name || '').replace(/'+$/, '');
// Имя первообразной по умолчанию: f → F, F → F1.
const primNameFor = (base) => (base.toUpperCase() !== base ? base.toUpperCase() : `${base}1`);
const rowStyle = { borderBottom: '1px dashed #eee', padding: '6px 0' };
// Поля чисел: без хвостовых нулей («2», а не «2.0» — InputNumber добивает до
// точности шага) и с десятичной запятой. Пока учитель печатает, текст не трогаем.
const numFormat = {
  formatter: (v, info) => {
    if (info && info.userTyping) return v;
    if (v === '' || v === undefined || v === null) return '';
    const n = Number(v);
    return Number.isFinite(n) ? String(n) : v;
  },
  parser: (v) => String(v ?? '').replace(',', '.').replace(/[−–—]/g, '-'),
};
const muted = { color: '#888' };

// Кривая, её f′ и F как варианты ссылки для разметки.
function refOptions(splines) {
  return splines.flatMap((c) => [
    { value: c.name, label: showName(c.name) },
    { value: `${c.name}'`, label: prime(c.name) },
    ...(c.prim && c.prim.on ? [{ value: c.prim.name, label: showName(c.prim.name) }] : []),
  ]);
}

/**
 * Что читается по графику. Роль кривой решает, о какой функции идёт речь:
 * обычная кривая описывается сама (экстремумы, монотонность, первообразная),
 * кривая-производная (имя со штрихом) — описывает СВОЮ функцию: её экстремумы
 * стоят в нулях нарисованной кривой, а возрастает она там, где кривая выше оси.
 */
export function describeCurve(curve) {
  const spline = buildSpline(cleanCurveNodes(curve.nodes));
  if (!spline.ok) return { error: spline.error, lines: [], kinds: [] };
  const an = splineAnalysis(spline);
  const xs = (arr) => (arr.length ? arr.map((p) => fmt(p.x)).join('; ') : 'нет');
  const iv = (arr) => (arr.length ? arr.map(([a, b]) => `[${fmt(a)}; ${fmt(b)}]`).join(', ') : 'нет');
  const n = showName(curve.name);
  const done = (lines) => ({
    error: null, warning: spline.warning, lines, kinds: spline.nodes.map((p) => p.kind),
  });

  if (isDerivName(curve.name)) {
    const fname = showName(
      curve.prim && curve.prim.on && curve.prim.name ? curve.prim.name : baseName(curve.name),
    );
    const zeros = splineZeros(spline).filter((z) => !z.atEdge);
    const at = (type) => {
      const list = zeros.filter((z) => z.type === type).map((z) => fmt(z.x));
      return list.length ? list.join('; ') : 'нет';
    };
    const sign = splineSignIntervals(spline);
    const part = (s) => {
      const list = sign.filter((i) => i.sign === s).map((i) => `[${fmt(i.a)}; ${fmt(i.b)}]`);
      return list.length ? list.join(', ') : 'нет';
    };
    const ints = integersInIntervals(sign.filter((i) => i.sign > 0));
    const extrema = [...an.maxima, ...an.minima].sort((a, b) => a.x - b.x);
    const lines = [
      `Точки максимума ${fname}: ${at('down')} · минимума: ${at('up')} (нули ${n} со сменой знака)`,
      `${fname} возрастает на ${part(1)} · убывает на ${part(-1)}`,
      `Целых точек, где ${n} > 0: ${ints.length}${ints.length ? ` (${ints.map(fmt).join('; ')})` : ''}`,
    ];
    if (extrema.length) lines.push(`Экстремумы самой ${n} (перегибы ${fname}): ${xs(extrema)}`);
    return done(lines);
  }

  const lines = [
    `Точки максимума ${n}: ${xs(an.maxima)} · минимума: ${xs(an.minima)}`,
    `${n} возрастает на ${iv(an.increasing)} · убывает на ${iv(an.decreasing)}`,
  ];
  if (an.stationary.length) lines.push(`${prime(n)} = 0 без смены знака: x = ${xs(an.stationary)}`);
  if (curve.prim && curve.prim.on) {
    const zs = splineZeros(spline).filter((z) => !z.atEdge);
    const at = (type) => {
      const list = zs.filter((z) => z.type === type).map((z) => fmt(z.x));
      return list.length ? list.join('; ') : 'нет';
    };
    lines.push(`Точки максимума ${showName(curve.prim.name)}: ${at('down')} · минимума: ${at('up')} (нули ${n})`);
  }
  return done(lines);
}

// Граница видимой части графика: пусто = «до конца кривой». Значения хранятся
// строками ('' = не задано), поэтому число приходится разворачивать в обе стороны.
function RangeEdge({ label, value, onChange }) {
  return (
    <>
      <span style={muted}>{label}</span>
      <InputNumber
        size="small"
        style={{ width: 62 }}
        step={0.5}
        {...numFormat}
        placeholder="—"
        aria-label={`видно ${label}`}
        value={value === '' || value == null ? null : Number(value)}
        onChange={(v) => onChange(v ?? '')}
      />
    </>
  );
}

function LineStyle({ value, onChange, range = true }) {
  return (
    <Space size={6} wrap>
      <Select size="small" style={{ width: 112 }} value={value.color || 'ink'} onChange={(color) => onChange({ color })} options={COLOR_OPTIONS} />
      <Segmented size="small" value={styleOf(value)} onChange={(v) => onChange(styleDelta(v))} options={STYLE_OPTIONS} />
      {range && (
        <Tooltip title="Показывать только часть графика. Можно заполнить одно поле: «видно от 0» — правая половина кривой. Пусто — кривая целиком">
          <Space size={4}>
            <RangeEdge label="от" value={value.from} onChange={(from) => onChange({ from })} />
            <RangeEdge label="до" value={value.to} onChange={(to) => onChange({ to })} />
          </Space>
        </Tooltip>
      )}
    </Space>
  );
}

function NodeRow({
  node, index, kind, selected, onSelect, onChange, onCommitX, onRemove,
}) {
  const patch = (delta) => onChange({ ...node, ...delta });
  const numProps = { size: 'small', style: { width: 72 }, step: 0.5, ...numFormat };
  const extremum = kind === 'max' || kind === 'min';
  const tag = KIND_TAG[kind];
  return (
    <div
      style={{
        ...rowStyle, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        background: selected ? '#e6f4ff' : undefined, paddingInline: 6, borderRadius: 4,
      }}
      onClick={() => onSelect(index)}
    >
      <span style={{ ...muted, width: 18 }}>{index + 1}</span>
      <span style={muted}>x</span>
      <InputNumber {...numProps} aria-label={`x точки ${index + 1}`} value={node.x} onChange={(x) => patch({ x })} onBlur={onCommitX} />
      <span style={muted}>y</span>
      <InputNumber {...numProps} aria-label={`y точки ${index + 1}`} value={node.y} onChange={(y) => patch({ y })} />
      <span style={{ width: 84 }}>{tag ? <Tag color={tag.color} style={{ marginInlineEnd: 0 }}>{tag.text}</Tag> : null}</span>
      <Tooltip title="Горизонтальная касательная без экстремума: f′ = 0, но знак не меняется (как у x³ в нуле)">
        <Checkbox
          disabled={extremum || kind === 'end'}
          checked={!!node.flat && !extremum}
          onChange={(e) => patch({ flat: e.target.checked, slope: e.target.checked ? null : node.slope })}
        >
          f′ = 0
        </Checkbox>
      </Tooltip>
      <Tooltip title="Наклон касательной в точке (f′). Пусто — подберётся сам. Нужен для задач «найдите f′(x₀) по касательной».">
        <Space size={4}>
          <span style={muted}>наклон</span>
          <InputNumber
            size="small"
            style={{ width: 72 }}
            step={0.5}
            {...numFormat}
            placeholder="авто"
            aria-label={`наклон в точке ${index + 1}`}
            disabled={extremum || !!node.flat}
            value={extremum || node.flat ? null : node.slope}
            onChange={(slope) => patch({ slope })}
          />
        </Space>
      </Tooltip>
      <Button
        size="small"
        type="text"
        danger
        aria-label={`удалить точку ${index + 1}`}
        icon={<DeleteOutlined />}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        style={{ marginInlineStart: 'auto' }}
      />
    </div>
  );
}

function AnnotationRow({
  item, refs, onChange, onRemove,
}) {
  const patch = (delta) => onChange({ ...item, ...delta });
  const numProps = { size: 'small', style: { width: 68 }, step: 0.5, ...numFormat };
  return (
    <div style={{ ...rowStyle, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Select
        size="small"
        style={{ width: 124 }}
        value={item.type}
        onChange={(type) => {
          const x = Number.isFinite(item.x) ? item.x : (Number.isFinite(item.a) ? item.a : 0);
          patch({
            type,
            x,
            ref: item.ref || (refs[0] && refs[0].value),
            a: Number.isFinite(item.a) ? item.a : x - 2,
            b: Number.isFinite(item.b) ? item.b : x + 2,
            // Цвет по умолчанию у типа свой: выделение красное, выноска чёрная.
            color: type === 'band' || type === 'part' ? 'red' : 'ink',
          });
        }}
        options={ANNOTATION_SELECT}
      />
      {item.type === 'part' && (
        <>
          <span style={muted}>кривой</span>
          <Select size="small" style={{ width: 64 }} value={item.ref} onChange={(ref) => patch({ ref })} options={refs} />
        </>
      )}
      {item.type === 'band' || item.type === 'part' ? (
        <>
          <span style={muted}>от</span>
          <InputNumber {...numProps} value={item.a} onChange={(a) => patch({ a })} />
          <span style={muted}>до</span>
          <InputNumber {...numProps} value={item.b} onChange={(b) => patch({ b })} />
        </>
      ) : (
        <>
          <span style={muted}>x =</span>
          <InputNumber {...numProps} value={item.x} onChange={(x) => patch({ x })} />
          <span style={muted}>к графику</span>
          <Select size="small" style={{ width: 64 }} value={item.ref} onChange={(ref) => patch({ ref })} options={refs} />
        </>
      )}
      <Select
        size="small"
        style={{ width: 106 }}
        value={item.color || (item.type === 'band' || item.type === 'part' ? 'red' : 'ink')}
        onChange={(color) => patch({ color })}
        options={COLOR_OPTIONS}
      />
      {item.type === 'mark' && (
        <>
          <Tooltip title="Вид точки: закрашенная, выколотая, крестик или плюсик">
            <Select
              size="small"
              style={{ width: 128 }}
              aria-label="вид точки на графике"
              value={item.style || 'fill'}
              onChange={(style) => patch({ style })}
              options={POINT_STYLE_OPTIONS}
            />
          </Tooltip>
          <Tooltip title="Насколько крупно рисовать точку">
            <Select
              size="small"
              style={{ width: 92 }}
              aria-label="размер точки на графике"
              value={item.size || 'normal'}
              onChange={(size) => patch({ size })}
              options={POINT_SIZE_OPTIONS}
            />
          </Tooltip>
        </>
      )}
      {item.type === 'drop' && (
        <Tooltip title="Пунктир / сплошная">
          <Switch size="small" checkedChildren="- -" unCheckedChildren="—" checked={!item.solid} onChange={(v) => patch({ solid: !v })} />
        </Tooltip>
      )}
      {(item.type === 'tangent' || item.type === 'part') && (
        <Segmented size="small" value={styleOf(item)} onChange={(v) => patch(styleDelta(v))} options={STYLE_SHORT} />
      )}
      <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} style={{ marginInlineStart: 'auto' }} />
    </div>
  );
}

export default function CurvePanel({
  splines, onSplinesChange, active, onActive,
  annotations, onAnnotationsChange, selectedNode, onSelectNode,
  step, onStep, info,
}) {
  const curve = splines[active];
  const refs = useMemo(() => refOptions(splines), [splines]);

  const patchCurve = (delta) => onSplinesChange(splines.map((c, i) => (i === active ? { ...c, ...delta } : c)));
  const patchDeriv = (delta) => patchCurve({ deriv: { ...curve.deriv, ...delta } });
  const patchPrim = (delta) => patchCurve({ prim: { ...curve.prim, ...delta } });

  // Пока имя стёрто или набрано наполовину, помним последнее годное (prevName)
  // — иначе разметка, ссылавшаяся на «f», осиротеет после «f → (пусто) → g».
  // Переименование кривых в разметке: пара «было → стало» тянет за собой и
  // ссылку на производную (f → f′). Замена идёт одним проходом по старым
  // ссылкам, поэтому переименования не накладываются друг на друга.
  const remapRefs = (pairs) => {
    const map = new Map();
    for (const [from, to] of pairs) {
      if (!from || !to || from === to) continue;
      map.set(from, to);
      map.set(`${from}'`, `${to}'`);
    }
    if (!map.size) return;
    onAnnotationsChange(annotations.map((a) => (map.has(a.ref) ? { ...a, ref: map.get(a.ref) } : a)));
  };

  const rename = (name) => {
    const old = NAME_RE.test(curve.name || '') ? curve.name : curve.prevName;
    if (!NAME_RE.test(name)) { patchCurve({ name, prevName: old }); return; }
    patchCurve({ name, prevName: undefined });
    remapRefs([[old, name]]);
  };

  // Роль кривой: точки задают саму функцию или её производную. Отдельного поля
  // в состоянии нет — роль это штрих в имени. В режиме f′ нарисованная кривая
  // зовётся f′, а первообразная и есть искомая f (по умолчанию не рисуется:
  // ученик должен прочитать её по графику производной, а не увидеть готовой).
  const role = isDerivName(curve.name) ? 'deriv' : 'f';
  const setRole = (next) => {
    if (next === role) return;
    const base = baseName(curve.name) || 'f';
    const name = next === 'deriv' ? `${base}'` : base;
    const prim = next === 'deriv'
      ? { ...curve.prim, on: true, show: curve.prim.on ? curve.prim.show !== false : false, name: base }
      : { ...curve.prim, on: false, name: primNameFor(base) };
    patchCurve({ name, prevName: undefined, prim });
    remapRefs([[curve.name, name], [curve.prim.name, prim.name]]);
  };

  const setNodes = (nodes) => patchCurve({ nodes });
  const changeNode = (i, next) => setNodes(curve.nodes.map((n, k) => (k === i ? next : n)));
  // Порядок точек восстанавливаем, когда учитель ушёл из поля x: пересортировка
  // на каждую цифру перекидывала бы набор в чужую строку таблицы.
  const sortNodes = (i) => {
    const moved = curve.nodes[i];
    const sorted = [...curve.nodes].sort((a, b) => (Number(a.x) || 0) - (Number(b.x) || 0));
    if (sorted.every((n, k) => n === curve.nodes[k])) return;
    setNodes(sorted);
    onSelectNode(sorted.indexOf(moved));
  };

  const addCurve = () => {
    const name = CURVE_NAMES.find((nm) => !splines.some((c) => c.name === nm)) || `f${splines.length + 1}`;
    const next = [...splines, newCurveState(name, [{ x: -2, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 0 }])];
    onSplinesChange(next);
    onActive(next.length - 1);
  };
  const removeCurve = () => {
    const gone = curve.name;
    onSplinesChange(splines.filter((_, i) => i !== active));
    onAnnotationsChange(annotations.filter((a) => a.ref !== gone && a.ref !== `${gone}'`
      && !(curve.prim && curve.prim.on && a.ref === curve.prim.name)));
    onActive(Math.max(0, active - 1));
  };

  const addAnnotation = (type) => {
    const sel = curve && curve.nodes[selectedNode];
    const x = sel ? Number(sel.x) : 0;
    const highlight = type === 'band' || type === 'part';
    const base = { type, color: highlight ? 'red' : 'ink' };
    const name = curve ? curve.name : 'f';
    let item;
    if (type === 'band') item = { ...base, a: x - 2, b: x + 2 };
    // Кусок кривой ложится поверх неё, поэтому по умолчанию жирный.
    else if (type === 'part') item = { ...base, ref: name, a: x - 2, b: x + 2, bold: true, dash: false };
    else {
      item = {
        ...base, x, ref: name, solid: false, style: 'fill', size: 'normal', bold: false, dash: false, from: '', to: '',
      };
    }
    onAnnotationsChange([...annotations, item]);
  };

  if (!curve) {
    return (
      <Button size="small" icon={<PlusOutlined />} onClick={addCurve}>Кривая по точкам</Button>
    );
  }

  const nameError = !NAME_RE.test(curve.name || '');
  const primNameError = curve.prim.on && !NAME_RE.test(curve.prim.name || '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Кривые */}
      <Space wrap size={8} style={{ justifyContent: 'space-between', width: '100%' }}>
        <Space wrap size={8}>
          {splines.length > 1 && (
            <Segmented
              size="small"
              value={active}
              onChange={(i) => { onActive(i); onSelectNode(null); }}
              options={splines.map((c, i) => ({ value: i, label: c.name || '?' }))}
            />
          )}
          <Button size="small" icon={<PlusOutlined />} onClick={addCurve}>Ещё кривая</Button>
        </Space>
        <Space size={6}>
          <span style={muted}>Шаг точек</span>
          <Segmented size="small" value={step} onChange={onStep} options={STEP_OPTIONS} />
          {splines.length > 1 && (
            <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={removeCurve}>кривую</Button>
          )}
        </Space>
      </Space>

      {/* Что рисовать */}
      <div style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6, padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '3px 0' }}>
          <Tooltip title="«производную f′» — это задачи ЕГЭ «на рисунке изображён график производной»: точки ставятся на графике f′, а сама f читается по нему (первообразная)">
            <span style={muted}>Точки задают</span>
          </Tooltip>
          <Segmented
            size="small"
            value={role}
            onChange={setRole}
            options={[
              { value: 'f', label: `функцию ${showName(baseName(curve.name) || 'f')}` },
              { value: 'deriv', label: `производную ${prime(baseName(curve.name) || 'f')}` },
            ]}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '3px 0' }}>
          <Checkbox checked={curve.show !== false} onChange={(e) => patchCurve({ show: e.target.checked })}>Кривая</Checkbox>
          <Tooltip title="Имя кривой: по нему к ней обращаются производная, разметка и подписи">
            <Input
              size="small"
              style={{ width: 52 }}
              maxLength={4}
              aria-label="имя кривой"
              status={nameError ? 'error' : ''}
              value={curve.name}
              onChange={(e) => rename(e.target.value.trim())}
            />
          </Tooltip>
          <LineStyle value={curve} onChange={patchCurve} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '3px 0' }}>
          <Checkbox checked={!!curve.deriv.on} onChange={(e) => patchDeriv({ on: e.target.checked })}>
            Производная {prime(curve.name)}
          </Checkbox>
          {curve.deriv.on && <LineStyle value={curve.deriv} onChange={patchDeriv} />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '3px 0' }}>
          <Tooltip title={role === 'deriv'
            ? 'Сама функция: её график — первообразная нарисованной кривой. Обычно её не рисуют — ученик читает f по графику f′'
            : 'Кривая по точкам — это производная, а рисуем функцию: график первообразной F, у которой F′ = f'}
          >
            <Checkbox
              checked={role === 'deriv' ? curve.prim.show !== false : !!curve.prim.on}
              onChange={(e) => (role === 'deriv'
                ? patchPrim({ on: true, show: e.target.checked })
                : patchPrim({ on: e.target.checked, show: true }))}
            >
              {role === 'deriv' ? `Функция ${showName(curve.prim.name)}` : 'Первообразная'}
            </Checkbox>
          </Tooltip>
          {curve.prim.on && (
            <>
              <Input
                size="small"
                style={{ width: 52 }}
                maxLength={4}
                aria-label="имя первообразной"
                status={primNameError ? 'error' : ''}
                value={curve.prim.name}
                onChange={(e) => patchPrim({ name: e.target.value.trim() })}
              />
              <Tooltip title="Через какую точку проходит первообразная (пусто — через ноль на левом краю кривой)">
                <Space size={4}>
                  <span style={muted}>через (</span>
                  <InputNumber size="small" style={{ width: 60 }} {...numFormat} aria-label="x0 первообразной" value={curve.prim.x0 === '' ? null : Number(curve.prim.x0)} onChange={(v) => patchPrim({ x0: v ?? '' })} />
                  <span style={muted}>;</span>
                  <InputNumber size="small" style={{ width: 60 }} {...numFormat} aria-label="y0 первообразной" value={curve.prim.y0 === '' ? null : Number(curve.prim.y0)} onChange={(v) => patchPrim({ y0: v ?? '' })} />
                  <span style={muted}>)</span>
                </Space>
              </Tooltip>
              <LineStyle value={curve.prim} onChange={patchPrim} />
            </>
          )}
        </div>
      </div>

      {/* Опорные точки */}
      <div>
        {curve.nodes.map((n, i) => (
          <NodeRow
            key={i}
            node={n}
            index={i}
            kind={info.kinds[i]}
            selected={i === selectedNode}
            onSelect={onSelectNode}
            onChange={(next) => changeNode(i, next)}
            onCommitX={() => sortNodes(i)}
            onRemove={() => { setNodes(curve.nodes.filter((_, k) => k !== i)); onSelectNode(null); }}
          />
        ))}
        {curve.nodes.length < 2 && (
          <div style={{ color: '#8c8c8c', fontSize: 12, padding: '6px 0' }}>Поставьте хотя бы две точки — кликом по холсту.</div>
        )}
      </div>

      {/* Разбор графика */}
      <div
        data-testid="curve-analysis"
        style={{
          fontSize: 12, background: '#f3f6f9', borderRadius: 6, padding: '8px 10px', lineHeight: 1.6,
        }}
      >
        {info.error
          ? <span style={{ color: '#cf1322' }}>{info.error}</span>
          : info.lines.map((l) => <div key={l}>{l}</div>)}
        {info.warning && <div style={{ color: '#d46b08' }}>{info.warning}</div>}
      </div>

      {/* Разметка */}
      <div>
        {annotations.map((a, i) => (
          <AnnotationRow
            key={i}
            item={a}
            refs={refs}
            onChange={(next) => onAnnotationsChange(annotations.map((it, k) => (k === i ? next : it)))}
            onRemove={() => onAnnotationsChange(annotations.filter((_, k) => k !== i))}
          />
        ))}
      </div>
      <Space wrap size={4}>
        <span style={{ ...muted, marginInlineEnd: 4 }}>Разметка:</span>
        {ANNOTATION_TYPES.map((t) => (
          <Button key={t.value} size="small" type="dashed" icon={<PlusOutlined />} onClick={() => addAnnotation(t.value)}>
            {t.label}
          </Button>
        ))}
      </Space>
    </div>
  );
}
