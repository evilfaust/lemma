import { useMemo } from 'react';
import { stereoSvgFromSpec } from '../../utils/stereo/dsl';

// Стереочертёж из блока ```stereo (статичный SVG — для задачи, теории, печати).
// Разметку строит общая stereoSvgFromSpec — та же, что в конвейере теории.
// inline — чертёж в строке / ячейке таблицы (`stereo: …`): компактный блок
// фиксированной ширины, выровненный по середине строки.
export default function StereoSVG({ spec, maxWidth, style, inline = false }) {
  const html = useMemo(() => {
    try {
      return stereoSvgFromSpec(spec || '', { maxWidth });
    } catch {
      return '<span style="color:#b91c1c;font-size:12px">Чертёж не построился</span>';
    }
  }, [spec, maxWidth]);
  const box = inline
    ? { display: 'inline-block', verticalAlign: 'middle', width: maxWidth, maxWidth: '100%' }
    : { display: 'block' };
  return (
    <span
      className={inline ? 'stereo-figure stereo-inline' : 'stereo-figure'}
      style={{ ...box, ...style }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
