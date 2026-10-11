import { FunctionOutlined } from '@ant-design/icons';
import {
  useTrigEquationsAdvanced,
  trigAdvInstruction,
  CATEGORY_LABELS_TRIG_ADV,
  CATEGORY_GROUPS_TRIG_ADV,
} from '../hooks/useTrigEquationsAdvanced';
import { TrigCategoryGenerator } from './trig/TrigCategoryGenerator';

/**
 * Уравнения f(kx + b) = a. Задания и ответы строит ядро
 * `utils/trig/equations.js` (серии корней точно, с проверкой подстановкой).
 */
export default function TrigEquationsAdvancedGenerator() {
  const hook = useTrigEquationsAdvanced();
  return (
    <TrigCategoryGenerator
      hook={hook}
      generator="trig_equations_advanced"
      icon={<FunctionOutlined style={{ fontSize: 14 }} />}
      labels={CATEGORY_LABELS_TRIG_ADV}
      groups={CATEGORY_GROUPS_TRIG_ADV}
      instruction={trigAdvInstruction(hook.settings.categories)}
    />
  );
}
