import { Select, Typography } from 'antd';
import { rowCount, variantLabel } from '../../../utils/geometryWork';
import {
  LEVELS, LEVEL_LABELS, LEVEL_HINTS, KIND_LABELS,
  drawingKind, taskLevel, chosenLevel, normalizeDrawings, rowChoice,
} from '../../../utils/geometryDrawings';

const { Text } = Typography;

const DEFAULT_KEY = '__work';

const levelOptions = LEVELS.map((lv) => ({
  value: lv,
  label: (
    <span title={LEVEL_HINTS[lv]}>{LEVEL_LABELS[lv]}</span>
  ),
}));

/**
 * Что увидит ученик в позиции: по задачам всех вариантов. Уровень задачи
 * упирается в её чертёж (у GeoGebra — только картинка), поэтому подпись
 * считается по каждой задаче, а не по выбору учителя.
 */
export function rowPreview(structure, row, drawings, tasksById) {
  const cells = structure.variants
    .map((v, vi) => ({ vi, id: v.items[row]?.task }))
    .filter((c) => c.id);
  if (!cells.length) return null;
  const parts = cells.map(({ vi, id }) => {
    const task = tasksById?.get?.(id);
    const kind = drawingKind(task);
    const level = taskLevel(drawings, id, kind);
    const limited = level !== chosenLevel(drawings, id);
    return { vi, kind, level, limited };
  });
  const describe = (p) => {
    if (!p.kind) return 'только условие (чертежа нет)';
    const base = LEVEL_LABELS[p.level].toLowerCase();
    return p.limited ? `${base} — у задачи ${KIND_LABELS[p.kind]}` : base;
  };
  const texts = parts.map(describe);
  if (new Set(texts).size === 1) return texts[0];
  return parts.map((p, i) => `${variantLabel(p.vi)}: ${texts[i]}`).join(' · ');
}

/**
 * «Чертежи ученикам» (v3.9.377): уровень показа для всей работы и для
 * отдельных заданий. Задание = позиция работы: выбор применяется к её задачам
 * во всех вариантах (хранится по id задачи — переживает перестановку позиций).
 */
export default function GeometryWorkDrawings({
  structure, tasksById, drawings, onChange, disabled = false,
}) {
  const d = normalizeDrawings(drawings);
  const rows = rowCount(structure);

  const rowIds = (r) => structure.variants.map((v) => v.items[r]?.task).filter(Boolean);
  const firstTask = (r) => tasksById?.get?.(rowIds(r)[0]);

  return (
    <div className="gwd">
      <div className="gwd-default">
        <Text strong>Чертежи ученикам</Text>
        <Select
          aria-label="Чертежи по умолчанию"
          value={d.default}
          options={levelOptions}
          onChange={(v) => onChange({ type: 'default', level: v })}
          disabled={disabled}
          style={{ minWidth: 240 }}
        />
      </div>
      <Text type="secondary" className="gwd-hint">
        {LEVEL_HINTS[d.default]}. Для отдельных заданий можно выбрать своё — например, к первой
        задаче показать построение по шагам, к остальным только условие. Менять можно в любой момент.
      </Text>

      {rows > 0 && (
        <div className="gwd-rows">
          {Array.from({ length: rows }, (_, r) => {
            const ids = rowIds(r);
            if (!ids.length) return null;
            const choice = rowChoice(d, ids);
            const t = firstTask(r);
            return (
              <div className="gwd-row" key={r}>
                <div className="gwd-row__no">{r + 1}</div>
                <div className="gwd-row__main">
                  <div className="gwd-row__code">{t?.code || ''}</div>
                  <div className="gwd-row__preview">
                    Ученик увидит: {rowPreview(structure, r, d, tasksById)}
                  </div>
                </div>
                <Select
                  aria-label={`Задание ${r + 1}`}
                  size="small"
                  value={choice === 'mixed' ? undefined : (choice || DEFAULT_KEY)}
                  placeholder="разное"
                  options={[
                    { value: DEFAULT_KEY, label: `Как у работы` },
                    ...levelOptions,
                  ]}
                  onChange={(v) => onChange({ type: 'tasks', ids, level: v === DEFAULT_KEY ? null : v })}
                  disabled={disabled}
                  style={{ width: 220 }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
