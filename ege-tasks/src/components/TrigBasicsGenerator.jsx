import { CompassOutlined } from '@ant-design/icons';
import {
  useTrigBasics,
  CATEGORY_LABELS_TRIG_BASICS,
  CATEGORY_GROUPS_TRIG_BASICS,
  BASICS_INSTRUCTION,
} from '../hooks/useTrigBasics';
import { TrigCategoryGenerator } from './trig/TrigCategoryGenerator';

/**
 * «Основы тригонометрии»: градусы ↔ радианы, знак функции и четверть угла,
 * период, область значений. Логика — `utils/trig/basics.js`.
 */
export default function TrigBasicsGenerator() {
  const hook = useTrigBasics();
  return (
    <TrigCategoryGenerator
      hook={hook}
      generator="trig_basics"
      icon={<CompassOutlined style={{ fontSize: 14 }} />}
      labels={CATEGORY_LABELS_TRIG_BASICS}
      groups={CATEGORY_GROUPS_TRIG_BASICS}
      instruction={BASICS_INSTRUCTION}
      wideAnswers={false}
      maxQuestions={30}
    />
  );
}
