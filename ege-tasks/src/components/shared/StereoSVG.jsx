import { useMemo } from 'react';
import { stereoSvgFromSpec } from '../../utils/stereo/dsl';

// Стереочертёж из блока ```stereo (статичный SVG — для задачи, теории, печати).
// Разметку строит общая stereoSvgFromSpec — та же, что в конвейере теории.
export default function StereoSVG({ spec, maxWidth, style }) {
  const html = useMemo(() => {
    try {
      return stereoSvgFromSpec(spec || '', { maxWidth });
    } catch {
      return '<span style="color:#b91c1c;font-size:12px">Чертёж не построился</span>';
    }
  }, [spec, maxWidth]);
  return (
    <span
      className="stereo-figure"
      style={{ display: 'block', ...style }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
