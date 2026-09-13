import { useMemo, useState } from 'react';
import { Modal, Space, Segmented, InputNumber, Switch, Tooltip } from 'antd';
import GridPaperSVG from './GridPaperSVG';
import { GRID_DEFAULTS, parseGridPaper, gridToSpec, buildGridSnippet } from '../../utils/gridPaper';

// Конструктор поля «в клетку» — места, куда ученик пишет решение прямо в
// задании (чаще всего в ячейке таблицы «условие | решение»).
// Состояние конструктора = модель gridPaper, поэтому сериализация в DSL —
// это ровно gridToSpec, а разбор обратно — parseGridPaper.
//
// `initialSpec` включает режим ПРАВКИ: курсор стоял внутри готового поля,
// редактор заменит найденный диапазон, а не вставит рядом второе поле.

export { buildGridSnippet };

// Подпись поля «шаг»: у чистого поля клетки нет, но высота всё равно считается
// шагами — так поле остаётся кратным клетке соседних заданий.
const STEP_LABEL = { grid: 'Клетка', lines: 'Шаг строк', blank: 'Шаг высоты' };

const PRESETS = [
  { label: 'Короткий ответ', rows: 3 },
  { label: 'Решение', rows: 6 },
  { label: 'Полстраницы', rows: 12 },
];

export default function GridPaperModal({
  open, onCancel, onInsert, defaultFormat = 'inline', initialSpec = null,
}) {
  const [kind, setKind] = useState(GRID_DEFAULTS.kind);
  const [rows, setRows] = useState(GRID_DEFAULTS.rows);
  const [cols, setCols] = useState(null);          // null = на всю ширину места
  const [stepMm, setStepMm] = useState(GRID_DEFAULTS.stepMm);
  const [frame, setFrame] = useState(true);
  const [format, setFormat] = useState(defaultFormat);
  const [editing, setEditing] = useState(false);

  // Состояние поднимается заново при каждом открытии (тот же приём, что в
  // PlotModal): под правку — из готового DSL, под вставку — из дефолтов.
  const [session, setSession] = useState(null);
  const token = open ? `${initialSpec ?? ''}|${defaultFormat}` : null;
  if (token !== session) {
    setSession(token);
    if (open) {
      const m = initialSpec ? parseGridPaper(initialSpec) : { ...GRID_DEFAULTS };
      setEditing(!!initialSpec);
      setKind(m.kind);
      setRows(m.rows);
      setCols(m.cols);
      setStepMm(m.stepMm);
      setFrame(m.frame);
      setFormat(defaultFormat);
    }
  }

  const model = useMemo(() => ({ kind, rows, cols, stepMm, frame }), [kind, rows, cols, stepMm, frame]);
  const spec = useMemo(() => gridToSpec(model), [model]);

  // Шаг разлиновки зависит от вида: клетка 5 мм, линейка 8 мм. У чистого поля
  // рамка обязательна — без неё на листе не видно вообще ничего.
  const changeKind = (next) => {
    setKind(next);
    setStepMm(next === 'lines' ? 8 : 5);
    if (next === 'blank') setFrame(true);
  };

  const handleInsert = () => onInsert(buildGridSnippet(spec, format));

  const heightMm = Math.round(rows * stepMm);
  const widthMm = cols ? Math.round(cols * stepMm) : null;

  return (
    <Modal
      title={editing ? 'Правка места для записи' : 'Место для записи решения'}
      open={open}
      onCancel={onCancel}
      onOk={handleInsert}
      okText={editing ? 'Сохранить' : 'Вставить'}
      cancelText="Отмена"
      width={560}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Segmented
          block
          value={kind}
          onChange={changeKind}
          options={[
            { value: 'grid', label: 'В клетку' },
            { value: 'lines', label: 'В линейку' },
            { value: 'blank', label: 'Чистое поле' },
          ]}
        />

        {/* Превью в натуральную величину: миллиметры на экране те же, что на бумаге */}
        <div style={{ padding: 10, background: '#fafafa', border: '1px solid #eee', borderRadius: 6 }}>
          <GridPaperSVG model={model} style={{ margin: 0 }} />
        </div>

        <Space wrap size={10}>
          <span style={{ color: '#888' }}>Высота:</span>
          <InputNumber
            size="small"
            min={1}
            max={60}
            value={rows}
            onChange={(v) => setRows(v || 1)}
            style={{ width: 72 }}
            addonAfter={kind === 'lines' ? 'строк' : 'кл.'}
          />
          {PRESETS.map((p) => (
            <a key={p.label} onClick={() => setRows(p.rows)} style={{ fontSize: 12 }}>{p.label}</a>
          ))}
          <span style={{ color: '#bbb', fontSize: 12 }}>≈ {heightMm} мм</span>
        </Space>

        <Space wrap size={10}>
          <span style={{ color: '#888' }}>Ширина:</span>
          <Segmented
            size="small"
            value={cols ? 'fixed' : 'fit'}
            onChange={(v) => setCols(v === 'fit' ? null : 10)}
            options={[
              { value: 'fit', label: 'по месту' },
              { value: 'fixed', label: 'задать' },
            ]}
          />
          {cols ? (
            <>
              <InputNumber
                size="small"
                min={1}
                max={60}
                value={cols}
                onChange={(v) => setCols(v || 1)}
                style={{ width: 72 }}
                addonAfter="кл."
              />
              <span style={{ color: '#bbb', fontSize: 12 }}>≈ {widthMm} мм</span>
            </>
          ) : (
            <span style={{ color: '#bbb', fontSize: 12 }}>во всю ширину ячейки таблицы или абзаца</span>
          )}
        </Space>

        <Space wrap size={10}>
          <Tooltip title="Настоящая тетрадная клетка — 5 мм. Для младших классов бывает крупнее">
            <span style={{ color: '#888' }}>{STEP_LABEL[kind]}:</span>
          </Tooltip>
          <InputNumber
            size="small"
            min={3}
            max={20}
            step={1}
            value={stepMm}
            onChange={(v) => setStepMm(v || 5)}
            style={{ width: 80 }}
            addonAfter="мм"
          />
          <span style={{ color: '#888', marginLeft: 8 }}>Рамка:</span>
          <Switch size="small" checked={frame} onChange={setFrame} disabled={kind === 'blank'} />
        </Space>

        <Space wrap size={10}>
          <span style={{ color: '#888' }}>Куда вставляем:</span>
          <Segmented
            size="small"
            value={format}
            onChange={setFormat}
            options={[
              { value: 'inline', label: 'в ячейку таблицы' },
              { value: 'block', label: 'отдельным блоком' },
            ]}
          />
        </Space>

        <div style={{ fontSize: 12, color: '#999' }}>
          Разметка: <code>{buildGridSnippet(spec, format)}</code>
        </div>
      </div>
    </Modal>
  );
}
