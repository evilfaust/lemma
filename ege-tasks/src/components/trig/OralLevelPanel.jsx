import { Segmented, Button, Tooltip } from 'antd';
import { TrigSettingsSection } from './TrigGeneratorLayout';
import {
  ORAL_LEVELS, DEFAULT_LEVEL, EXAM_FILTERS, hasExam, categoriesForExam,
} from '../../utils/oral/levels';

/**
 * Уровень листа и быстрый выбор типов «готовлю к экзамену» — общий блок
 * разделов устного счёта. Уровень меняет числа внутри типа, кнопки экзамена
 * отмечают типы с меткой этого экзамена (остальные снимаются).
 *
 * `keys` — все типы раздела, `examMap` — метки (`utils/oral/levels.js`).
 * Без меток (чистый устный счёт) кнопки экзаменов не показываются.
 */
export function OralLevelPanel({ settings, onChange, keys = [], examMap = null }) {
  const level = settings.level ?? DEFAULT_LEVEL;
  const exams = examMap ? EXAM_FILTERS.filter(e => hasExam(examMap, e.key)) : [];

  const pickExam = (exam) => onChange('categories', categoriesForExam(keys, examMap, exam, settings.categories));
  const pickAll = () => onChange('categories', Object.fromEntries(keys.map(k => [k, true])));

  return (
    <TrigSettingsSection label="Уровень">
      <Segmented
        block
        size="small"
        value={level}
        onChange={v => onChange('level', v)}
        options={ORAL_LEVELS.map(l => ({
          value: l.value,
          label: <Tooltip title={l.hint}><span>{l.label}</span></Tooltip>,
        }))}
      />
      {exams.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', marginRight: 2 }}>Готовлю к:</span>
          {exams.map(e => (
            <Button key={e.key} size="small" onClick={() => pickExam(e.key)}>{e.label}</Button>
          ))}
          <Button size="small" type="text" onClick={pickAll}>все типы</Button>
        </div>
      )}
    </TrigSettingsSection>
  );
}

export default OralLevelPanel;
