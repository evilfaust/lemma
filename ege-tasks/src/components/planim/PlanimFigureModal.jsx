import { useEffect, useMemo, useState } from 'react';
import { Checkbox, InputNumber, Modal, Space } from 'antd';
import { FIGURE_KINDS, figurePoints, normalizeFigureSpec } from '../../utils/planim';

const W = 64;
const H = 44;

/** Миниатюра фигуры — её же координаты, вписанные в рамку. */
function FigureThumb({ kind }) {
  if (kind === 'empty') {
    return (
      <svg width={W} height={H} aria-hidden="true">
        <rect x="8" y="6" width={W - 16} height={H - 12} fill="none" stroke="#94a3b8" strokeDasharray="4 3" rx="3" />
      </svg>
    );
  }
  if (kind === 'circle') {
    return (
      <svg width={W} height={H} aria-hidden="true">
        <circle cx={W / 2} cy={H / 2} r={H / 2 - 5} fill="none" stroke="#1f2937" strokeWidth="1.5" />
        <circle cx={W / 2} cy={H / 2} r="1.8" fill="#1f2937" />
      </svg>
    );
  }
  const pts = figurePoints({ kind }) || [];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const bw = Math.max(...xs) - x0 || 1;
  const bh = Math.max(...ys) - y0 || 1;
  const k = Math.min((W - 12) / bw, (H - 10) / bh);
  const ox = (W - bw * k) / 2;
  const oy = (H - bh * k) / 2;
  const points = pts.map(([x, y]) => `${(ox + (x - x0) * k).toFixed(1)},${(H - oy - (y - y0) * k).toFixed(1)}`).join(' ');
  return (
    <svg width={W} height={H} aria-hidden="true">
      <polygon points={points} fill="none" stroke="#1f2937" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * «Новый чертёж» / «Фигура»: выбор готовой фигуры и её размеров.
 * @param canAdd  — на чертеже уже что-то есть: можно добавить фигуру к нему
 * @param onApply — ({ spec, add }) — add: не начинать заново, а дорисовать рядом
 */
export default function PlanimFigureModal({ open, onClose, onApply, canAdd = false }) {
  const [kind, setKind] = useState('triangle');
  const [params, setParams] = useState({});
  const [add, setAdd] = useState(false);
  useEffect(() => { if (open) { setAdd(false); } }, [open]);

  const spec = useMemo(() => normalizeFigureSpec({ kind, ...params }), [kind, params]);
  const defs = FIGURE_KINDS[kind].params;
  const impossible = kind !== 'empty' && !figurePoints(spec);

  return (
    <Modal
      title="Новый чертёж"
      open={open}
      onOk={() => onApply({ spec, add: canAdd && add && kind !== 'empty' })}
      onCancel={onClose}
      okText={canAdd && add ? 'Добавить фигуру' : 'Создать'}
      cancelText="Отмена"
      okButtonProps={{ disabled: impossible }}
      width={620}
      destroyOnHidden
    >
      <div className="planim-figure-grid" role="radiogroup" aria-label="Фигура">
        {Object.entries(FIGURE_KINDS).map(([key, def]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={kind === key}
            className={`planim-figure${kind === key ? ' is-active' : ''}`}
            onClick={() => { setKind(key); setParams({}); }}
          >
            <FigureThumb kind={key} />
            <span>{def.label}</span>
          </button>
        ))}
      </div>
      {defs.length > 0 && (
        <Space wrap size={12} style={{ marginBottom: 8 }}>
          {defs.map((p) => (
            <label key={p.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
              {p.label}
              <InputNumber
                min={p.int ? p.min : 0.5}
                max={p.int ? p.max : p.key === 'angle' ? 175 : 50}
                step={p.int ? 1 : p.key === 'angle' ? 5 : 0.5}
                value={spec[p.key]}
                onChange={(v) => setParams((prev) => ({ ...prev, [p.key]: v }))}
                aria-label={p.label}
              />
            </label>
          ))}
        </Space>
      )}
      {impossible && (
        <div className="stereo-cmd-error">Такого треугольника нет: сторона не меньше суммы двух других.</div>
      )}
      <div className="stereo-cmd-help">
        Вершины потом можно двигать мышью; буквы — от левого нижнего угла по часовой
        стрелке (у треугольника A слева, B наверху, C справа).
      </div>
      {canAdd && kind !== 'empty' && (
        <Checkbox checked={add} onChange={(e) => setAdd(e.target.checked)} style={{ marginTop: 10 }}>
          Добавить к текущему чертежу (иначе он начнётся заново)
        </Checkbox>
      )}
    </Modal>
  );
}
