import { useMemo } from 'react';
import { chartSvg } from '../../utils/chartSvg';

// График или диаграмма «из жизни» (база №3/№7). Рендер — общей функцией
// chartSvg, как CoordPlotSVG делегирует coordPlotSvg.
export default function ChartSVG({ chart, width, height, style }) {
  const html = useMemo(() => chartSvg(chart, { width, height }), [chart, width, height]);
  return (
    <span
      className="chartsvg"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
