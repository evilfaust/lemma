import { useMemo } from 'react';
import { chartSvgFromSpec } from '../../utils/chartSpec';

// Блок ```chart / `chart: …` — график или диаграмма по таблице значений.
// Класс `coordplot` — намеренно: печатные листы масштабируют чертежи по нему
// (размер S/M/L/XL, ячейка таблицы, режим «без чертежей»).
export default function ChartBlockSVG({ spec, inline = false, style }) {
  const html = useMemo(() => chartSvgFromSpec(spec || '', { inline }), [spec, inline]);
  return (
    <span
      className="coordplot chartplot"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
