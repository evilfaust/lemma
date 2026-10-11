import { CalculatorOutlined } from '@ant-design/icons';
import {
  useTrigByValue,
  CATEGORY_LABELS_BY_VALUE,
  CATEGORY_GROUPS_BY_VALUE,
  CATEGORY_EXAM_BY_VALUE,
  BY_VALUE_INSTRUCTION,
} from '../hooks/useTrigByValue';
import { TrigCategoryGenerator } from './trig/TrigCategoryGenerator';

/**
 * «По значению и четверти» — вычисления первой части профиля ЕГЭ:
 * k·cos α по sin α и четверти, cos 2α, формулы приведения, однородные
 * дроби по tg α, числовые выражения. Логика — `utils/trig/byValue.js`.
 */
export default function TrigByValueGenerator() {
  const hook = useTrigByValue();
  return (
    <TrigCategoryGenerator
      hook={hook}
      generator="trig_by_value"
      icon={<CalculatorOutlined style={{ fontSize: 14 }} />}
      labels={CATEGORY_LABELS_BY_VALUE}
      groups={CATEGORY_GROUPS_BY_VALUE}
      badges={CATEGORY_EXAM_BY_VALUE}
      instruction={BY_VALUE_INSTRUCTION}
      wideAnswers={false}
    />
  );
}
