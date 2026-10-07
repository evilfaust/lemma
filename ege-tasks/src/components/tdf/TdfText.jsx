import { useMemo } from 'react';
import MathRenderer from '../../shared/components/MathRenderer';
import { tdfMarkdown } from '../../utils/tdfMarkup';

/**
 * Текст пункта ТДФ (формулировка, краткая запись, вопрос) — через разметку
 * `utils/tdfMarkup.js`: пропуски `[[…]]`, ```свойства, ```соответствие,
 * ```plot пропуск. Эталон показывает всё, бланк (`mode="gaps"`) — линии на
 * месте пропусков и пустые оси.
 *
 * 🚨 Текст пункта всегда рисовать этим компонентом, а не голым MathRenderer:
 * иначе на экран попадут скобки пропусков и блок соответствия кодом.
 */
export default function TdfText({ md, mode = 'etalon', seed = '' }) {
  const text = useMemo(() => tdfMarkdown(md, mode, { seed }), [md, mode, seed]);
  if (!text) return null;
  return <MathRenderer content={text} />;
}
