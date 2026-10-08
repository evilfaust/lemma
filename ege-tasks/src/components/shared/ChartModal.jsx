import { useMemo, useState } from 'react';
import {
  Modal, Button, Space, Segmented, InputNumber, Input, Select, Switch, Tooltip, Alert, Typography,
} from 'antd';
import { PlusOutlined, DeleteOutlined, ColumnHeightOutlined } from '@ant-design/icons';
import './PlotModal.css';
import {
  parseChartSpec, chartToSpec, chartSvgFromSpec, buildChartSnippet, emptyChartDoc,
  parseTablePaste, fitAxesToData, CHART_COLORS, CHART_SIZES, CHART_DEFAULT_FONT,
} from '../../utils/chartSpec';

// Конструктор графика по таблице значений (блок ```chart): осадки по дням,
// температура по часам, столбики по месяцам — как на картинках базы №3/№7.
// У каждой оси свой масштаб и подписи словами — то, чего не умеет
// координатная плоскость «Графика» (там клетка квадратная).
//
// Состояние = документ chartSpec (DSL ↔ doc без потерь), поэтому правка
// готового блока — это parseChartSpec, а вставка — chartToSpec.

const COLOR_LABEL = {
  ink: 'чёрный', orange: 'оранжевый', blue: 'синий', green: 'зелёный',
  red: 'красный', violet: 'фиолетовый', gray: 'серый',
};
const COLOR_OPTIONS = CHART_COLORS.map((c) => ({ value: c, label: COLOR_LABEL[c] || c }));
const DECIMALS_OPTIONS = [
  { value: 'auto', label: 'как есть (4,5 · 4)' },
  { value: 0, label: '0 знаков (4)' },
  { value: 1, label: '1 знак (4,0)' },
  { value: 2, label: '2 знака (4,00)' },
];
const SIZE_OPTIONS = Object.keys(CHART_SIZES).map((k) => ({ value: k, label: k }));
const FONT_OPTIONS = [
  { value: 1, label: 'мельче' },
  { value: CHART_DEFAULT_FONT, label: 'обычный' },
  { value: 1.35, label: 'крупнее' },
];

// Пример по умолчанию — осадки по дням, как в задачах «Решу ЕГЭ».
const SAMPLE_SPEC = `x 8 24 step 1
y 0 4,5 step 0,5 decimals 1
xtitle Число месяца
ytitle Количество осадков, мм
values 4 1,5 0,25 1,5 4 0 3 1,5 1,75 0,5 1 0 0,5 0,8 0 0 0,5`;

const BAR_SAMPLE = [
  ['янв', 30], ['фев', 25], ['мар', 35], ['апр', 40], ['май', 50], ['июн', 70],
];

const numProps = { size: 'small', decimalSeparator: ',', style: { width: 84 } };
const labelStyle = { color: '#888', minWidth: 70, display: 'inline-block' };

function sizeKey(size) {
  return Object.keys(CHART_SIZES).find((k) => CHART_SIZES[k][0] === size.w && CHART_SIZES[k][1] === size.h) || 'custom';
}

function AxisRow({ title, axis, onChange, withDecimals }) {
  const patch = (d) => onChange({ ...axis, ...d });
  return (
    <Space wrap size={8}>
      <span style={labelStyle}>{title}</span>
      <span>от</span>
      <InputNumber {...numProps} value={axis.min} onChange={(v) => v != null && patch({ min: v })} />
      <span>до</span>
      <InputNumber {...numProps} value={axis.max} onChange={(v) => v != null && patch({ max: v })} />
      <Tooltip title="Шаг клетки — расстояние между линиями сетки">
        <span>шаг</span>
      </Tooltip>
      <InputNumber {...numProps} min={0.001} value={axis.step} onChange={(v) => v > 0 && patch({ step: v })} />
      <Tooltip title="Подписывать каждое такое значение. Пусто — каждую линию сетки">
        <span>подписи через</span>
      </Tooltip>
      <InputNumber {...numProps} min={0.001} value={axis.label} placeholder="шаг" onChange={(v) => patch({ label: v > 0 ? v : null })} />
      {withDecimals && (
        <Select
          size="small"
          style={{ width: 170 }}
          value={Number.isInteger(axis.decimals) ? axis.decimals : 'auto'}
          onChange={(v) => patch({ decimals: v === 'auto' ? null : v })}
          options={DECIMALS_OPTIONS}
        />
      )}
    </Space>
  );
}

function PasteBox({ onApply, hint }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const apply = () => {
    const parsed = parseTablePaste(text);
    if (!parsed) { setError('Не разобрал. Нужны числа: столбцом, строкой или два столбца (x и значение).'); return; }
    setError('');
    onApply(parsed);
    setText('');
  };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <Input.TextArea
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={hint}
        style={{ fontFamily: 'monospace', fontSize: 12 }}
      />
      <Space>
        <Button size="small" onClick={apply} disabled={!text.trim()}>Заменить данные</Button>
        {error && <span style={{ color: '#cf1322', fontSize: 12 }}>{error}</span>}
      </Space>
    </div>
  );
}

function SeriesEditor({ series, step, onChange, onRemove }) {
  const patch = (d) => onChange({ ...series, ...d });
  const setPoint = (i, j, v) => {
    if (v == null) return;
    const points = series.points.map((p, k) => (k === i ? (j === 0 ? [v, p[1]] : [p[0], v]) : p));
    patch({ points });
  };
  // x правится по месту без пересортировки (иначе строка уезжает из-под
  // курсора), порядок наводится на blur поля
  const sortPoints = () => patch({ points: [...series.points].sort((a, b) => a[0] - b[0]) });
  const addPoint = () => {
    const last = series.points.at(-1);
    patch({ points: [...series.points, last ? [last[0] + step, last[1]] : [0, 0]] });
  };
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Space wrap size={10}>
        <span style={{ color: '#888' }}>Цвет:</span>
        <Select size="small" style={{ width: 120 }} value={series.color} onChange={(v) => patch({ color: v })} options={COLOR_OPTIONS} />
        <span style={{ color: '#888' }}>Точки:</span>
        <Switch size="small" checked={series.dots !== false} onChange={(v) => patch({ dots: v })} />
        <Tooltip title="Плавная кривая через точки вместо ломаной">
          <span style={{ color: '#888' }}>Плавно:</span>
        </Tooltip>
        <Switch size="small" checked={!!series.smooth} onChange={(v) => patch({ smooth: v })} />
        <span style={{ color: '#888' }}>Пунктир:</span>
        <Switch size="small" checked={!!series.dash} onChange={(v) => patch({ dash: v })} />
        {onRemove && <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={onRemove}>Убрать линию</Button>}
      </Space>
      <div className="chart-modal-points">
        {series.points.map((p, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Space key={i} size={4} className="chart-modal-point">
            <InputNumber {...numProps} style={{ width: 100 }} value={p[0]} onChange={(v) => setPoint(i, 0, v)} onBlur={sortPoints} addonBefore="x" />
            <InputNumber {...numProps} style={{ width: 108 }} value={p[1]} onChange={(v) => setPoint(i, 1, v)} addonBefore="y" />
            <Button
              size="small"
              type="text"
              icon={<DeleteOutlined />}
              onClick={() => patch({ points: series.points.filter((_, k) => k !== i) })}
              aria-label="Удалить точку"
            />
          </Space>
        ))}
      </div>
      <div>
        <Button size="small" icon={<PlusOutlined />} onClick={addPoint}>Точка</Button>
      </div>
    </div>
  );
}

function BarsEditor({ doc, onChange }) {
  const setBar = (i, d) => onChange({ ...doc, bars: doc.bars.map((b, k) => (k === i ? { ...b, ...d } : b)) });
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <Space wrap size={10}>
        <span style={{ color: '#888' }}>Цвет:</span>
        <Select size="small" style={{ width: 120 }} value={doc.barColor} onChange={(v) => onChange({ ...doc, barColor: v })} options={COLOR_OPTIONS} />
      </Space>
      <div className="chart-modal-points">
        {doc.bars.map((b, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Space key={i} size={4} className="chart-modal-point">
            <Input size="small" style={{ width: 70 }} value={b.label} placeholder={String(i + 1)} onChange={(e) => setBar(i, { label: e.target.value })} />
            <InputNumber {...numProps} style={{ width: 76 }} value={b.v} onChange={(v) => v != null && setBar(i, { v })} />
            <Button
              size="small"
              type="text"
              icon={<DeleteOutlined />}
              onClick={() => onChange({ ...doc, bars: doc.bars.filter((_, k) => k !== i) })}
              aria-label="Удалить столбик"
            />
          </Space>
        ))}
      </div>
      <div>
        <Button size="small" icon={<PlusOutlined />} onClick={() => onChange({ ...doc, bars: [...doc.bars, { label: '', v: doc.bars.at(-1)?.v ?? 0 }] })}>
          Столбик
        </Button>
      </div>
    </div>
  );
}

export default function ChartModal({
  open, onCancel, onInsert, defaultFormat = 'block', initialSpec = null,
}) {
  const [doc, setDoc] = useState(() => parseChartSpec(SAMPLE_SPEC).doc);
  const [format, setFormat] = useState(defaultFormat);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState([]);
  const [seriesIdx, setSeriesIdx] = useState(0);

  // Состояние поднимается заново при каждом открытии (приём PlotModal):
  // под правку — из готового DSL, под вставку — пример.
  const [session, setSession] = useState(null);
  const token = open ? `${initialSpec ?? ''}|${defaultFormat}` : null;
  if (token !== session) {
    setSession(token);
    if (open) {
      const parsed = parseChartSpec(initialSpec ?? SAMPLE_SPEC);
      setDoc(parsed.doc);
      setErrors(initialSpec ? parsed.errors : []);
      setEditing(!!initialSpec);
      setFormat(defaultFormat);
      setSeriesIdx(0);
    }
  }

  const spec = useMemo(() => chartToSpec(doc), [doc]);
  const svg = useMemo(() => chartSvgFromSpec(spec), [spec]);
  const series = doc.series[Math.min(seriesIdx, doc.series.length - 1)];

  const setType = (type) => {
    if (type === doc.type) return;
    let next = { ...doc, type };
    // Переключение без данных — подставляем заготовку, чтобы было что править
    if (type === 'bar' && !doc.bars.length) {
      const src = doc.series[0]?.points;
      next.bars = src?.length
        ? src.map(([x, y]) => ({ label: String(x).replace('.', ','), v: y }))
        : BAR_SAMPLE.map(([label, v]) => ({ label, v }));
      next = fitAxesToData(next);
    }
    if (type === 'line' && !doc.series.length) {
      next.series = [{
        color: 'ink', dots: true, smooth: false, dash: false, points: doc.bars.map((b, i) => [i + 1, b.v]),
      }];
      next = fitAxesToData(next);
    }
    setDoc(next);
  };

  const updateSeries = (s) => setDoc({ ...doc, series: doc.series.map((x, i) => (x === series ? s : x)) });
  const addSeries = () => {
    const base = series?.points || [];
    const color = CHART_COLORS.find((c) => !doc.series.some((s) => s.color === c)) || 'ink';
    setDoc({ ...doc, series: [...doc.series, {
      color, dots: true, smooth: false, dash: doc.series.length > 0, points: base.map(([x, y]) => [x, y]),
    }] });
    setSeriesIdx(doc.series.length);
  };

  const applyPaste = ({ rows, values }) => {
    if (doc.type === 'bar') {
      setDoc(fitAxesToData({ ...doc, bars: rows.map(([label, v]) => ({ label: values ? '' : label, v })) }));
      return;
    }
    const points = values
      ? rows.map(([, v], i) => [doc.x.min + i * doc.x.step, v])
      : rows.map(([x, v]) => [Number(String(x).replace(',', '.')), v]);
    if (points.some(([x]) => !Number.isFinite(x))) return;
    const s = series || { color: 'ink', dots: true, smooth: false, dash: false };
    const nextSeries = doc.series.length ? doc.series.map((x) => (x === series ? { ...s, points } : x)) : [{ ...s, points }];
    setDoc(fitAxesToData({ ...doc, series: nextSeries }));
  };

  const handleInsert = () => onInsert(buildChartSnippet(spec, format));
  const size = sizeKey(doc.size);

  return (
    <Modal
      title={editing ? 'Правка графика по таблице' : 'График или диаграмма по таблице значений'}
      open={open}
      onCancel={onCancel}
      onOk={handleInsert}
      okText={editing ? 'Сохранить' : 'Вставить'}
      cancelText="Отмена"
      width={1180}
      style={{ maxWidth: '96vw', top: 24 }}
      destroyOnClose
    >
      {errors.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Строки, которые конструктор не понял, сохранятся как есть: ${errors.slice(0, 3).join(' · ')}`}
        />
      )}
      <div className="plot-modal-grid">
        <div className="plot-modal-preview">
          <span
            className="coordplot chartplot"
            style={{ display: 'inline-block' }}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>

        <div className="plot-modal-controls">
          <Segmented
            block
            value={doc.type}
            onChange={setType}
            options={[
              { value: 'line', label: 'Линия (график по точкам)' },
              { value: 'bar', label: 'Столбики (диаграмма)' },
            ]}
          />

          <section className="chart-modal-section">
            <Typography.Text strong>Данные</Typography.Text>
            {doc.type === 'bar' ? (
              <BarsEditor doc={doc} onChange={setDoc} />
            ) : (
              <>
                {doc.series.length > 1 && (
                  <Segmented
                    size="small"
                    value={doc.series.indexOf(series)}
                    onChange={setSeriesIdx}
                    options={doc.series.map((_, i) => ({ value: i, label: `Линия ${i + 1}` }))}
                  />
                )}
                {series ? (
                  <SeriesEditor
                    series={series}
                    step={doc.x.step}
                    onChange={updateSeries}
                    onRemove={doc.series.length > 1 ? () => {
                      setDoc({ ...doc, series: doc.series.filter((s) => s !== series) });
                      setSeriesIdx(0);
                    } : null}
                  />
                ) : (
                  <Button size="small" icon={<PlusOutlined />} onClick={addSeries}>Линия</Button>
                )}
                {series && doc.series.length < 4 && (
                  <div>
                    <Tooltip title="Вторая линия на том же чертеже (например, «день / ночь»)">
                      <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addSeries}>Ещё линия</Button>
                    </Tooltip>
                  </div>
                )}
              </>
            )}
            <details>
              <summary style={{ cursor: 'pointer', color: '#1677ff', fontSize: 13 }}>
                Вставить из Excel / Google Таблиц
              </summary>
              <PasteBox
                onApply={applyPaste}
                hint={doc.type === 'bar'
                  ? 'Два столбца: подпись и значение (янв 30) — или только значения'
                  : 'Два столбца: x и значение (8  4) — или только значения: 4  1,5  0,25 …'}
              />
            </details>
          </section>

          <section className="chart-modal-section">
            <Space style={{ justifyContent: 'space-between', width: '100%' }}>
              <Typography.Text strong>Оси</Typography.Text>
              <Tooltip title="Окно и шаг клетки по данным: x — от первой до последней точки, y — с нуля до «круглого» значения">
                <Button size="small" icon={<ColumnHeightOutlined />} onClick={() => setDoc(fitAxesToData(doc))}>
                  Подобрать по данным
                </Button>
              </Tooltip>
            </Space>
            {doc.type !== 'bar' && (
              <AxisRow title="По x:" axis={doc.x} onChange={(x) => setDoc({ ...doc, x })} />
            )}
            <AxisRow title="По y:" axis={doc.y} onChange={(y) => setDoc({ ...doc, y })} withDecimals />
            <Space wrap size={8}>
              <span style={labelStyle}>Подписи:</span>
              <Input
                size="small"
                style={{ width: 200 }}
                value={doc.xtitle}
                placeholder="под осью x: Число месяца"
                onChange={(e) => setDoc({ ...doc, xtitle: e.target.value })}
              />
              <Input
                size="small"
                style={{ width: 220 }}
                value={doc.ytitle}
                placeholder="у оси y: Количество осадков, мм"
                onChange={(e) => setDoc({ ...doc, ytitle: e.target.value })}
              />
            </Space>
            <Space wrap size={8}>
              <Tooltip title="Короткая единица у конца оси, как в задачах про температуру: «ч», «°C»">
                <span style={labelStyle}>Единицы:</span>
              </Tooltip>
              <Input size="small" style={{ width: 90 }} value={doc.xunit} placeholder="x: ч" onChange={(e) => setDoc({ ...doc, xunit: e.target.value })} />
              <Input size="small" style={{ width: 90 }} value={doc.yunit} placeholder="y: °C" onChange={(e) => setDoc({ ...doc, yunit: e.target.value })} />
            </Space>
          </section>

          <section className="chart-modal-section">
            <Space wrap size={10}>
              <span style={{ color: '#888' }}>Размер:</span>
              <Segmented
                size="small"
                value={size}
                onChange={(k) => setDoc({ ...doc, size: { w: CHART_SIZES[k][0], h: CHART_SIZES[k][1] } })}
                options={size === 'custom' ? [...SIZE_OPTIONS, { value: 'custom', label: `${doc.size.w}×${doc.size.h}`, disabled: true }] : SIZE_OPTIONS}
              />
              <span style={{ color: '#888' }}>Шрифт:</span>
              <Segmented
                size="small"
                value={FONT_OPTIONS.find((o) => Math.abs(o.value - doc.font) < 1e-9)?.value ?? doc.font}
                onChange={(v) => setDoc({ ...doc, font: v })}
                options={FONT_OPTIONS}
              />
            </Space>
            <Space wrap size={10}>
              <span style={{ color: '#888' }}>Куда вставляем:</span>
              <Segmented
                size="small"
                value={format}
                onChange={setFormat}
                options={[
                  { value: 'block', label: 'отдельным блоком' },
                  { value: 'inline', label: 'в ячейку таблицы' },
                ]}
              />
            </Space>
            <Button size="small" type="link" style={{ padding: 0, alignSelf: 'flex-start' }} onClick={() => setDoc(emptyChartDoc())}>
              Очистить всё
            </Button>
          </section>

          <div style={{ fontSize: 12, color: '#999' }}>
            Разметка:
            <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', background: '#fafafa', padding: 6, borderRadius: 4 }}>
              {buildChartSnippet(spec, format).trim()}
            </pre>
          </div>
        </div>
      </div>
    </Modal>
  );
}
