import { Switch } from 'antd';
import { FunctionOutlined } from '@ant-design/icons';
import {
  useTrigEquationsEge,
  trigEgeInstruction,
  CATEGORY_LABELS_TRIG_EGE,
  CATEGORY_GROUPS_TRIG_EGE,
} from '../hooks/useTrigEquationsEge';
import { TrigCategoryGenerator } from './trig/TrigCategoryGenerator';

/**
 * Уравнения части 2 профиля ЕГЭ: а) решите уравнение, б) найдите корни на
 * отрезке. Модель — `utils/trig/part2.js`.
 */
export default function TrigEquationsEgeGenerator() {
  const hook = useTrigEquationsEge();
  return (
    <TrigCategoryGenerator
      hook={hook}
      generator="trig_equations_ege"
      icon={<FunctionOutlined style={{ fontSize: 14 }} />}
      labels={CATEGORY_LABELS_TRIG_EGE}
      groups={CATEGORY_GROUPS_TRIG_EGE}
      instruction={trigEgeInstruction(hook.settings.withSegment)}
      maxQuestions={10}
      extraSettings={(settings, update) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Switch size="small" checked={settings.withSegment !== false}
            onChange={v => update('withSegment', v)} />
          <span style={{ fontSize: 13 }}>Пункт б): корни на отрезке</span>
        </div>
      )}
    />
  );
}
