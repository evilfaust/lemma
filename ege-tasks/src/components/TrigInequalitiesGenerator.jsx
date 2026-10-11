import { Segmented } from 'antd';
import { FunctionOutlined } from '@ant-design/icons';
import {
  useTrigInequalities,
  CATEGORY_LABELS_TRIG_INEQ,
  CATEGORY_GROUPS_TRIG_INEQ,
} from '../hooks/useTrigInequalities';
import { TrigCategoryGenerator } from './trig/TrigCategoryGenerator';

const ANSWER_FORMS = [
  { value: 'inequality', label: 'π/6 + 2πn < x < …' },
  { value: 'interval', label: 'x ∈ (…; …)' },
];

/** Тригонометрические неравенства. Модель — `utils/trig/inequalities.js`. */
export default function TrigInequalitiesGenerator() {
  const hook = useTrigInequalities();
  return (
    <TrigCategoryGenerator
      hook={hook}
      generator="trig_inequalities"
      icon={<FunctionOutlined style={{ fontSize: 14 }} />}
      labels={CATEGORY_LABELS_TRIG_INEQ}
      groups={CATEGORY_GROUPS_TRIG_INEQ}
      instruction="Решите неравенство:"
      extraSettings={(settings, update) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13 }}>Ответ:</span>
          <Segmented size="small" options={ANSWER_FORMS}
            value={settings.answerForm || 'inequality'}
            onChange={v => update('answerForm', v)} />
        </div>
      )}
    />
  );
}
