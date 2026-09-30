import { useMemo } from 'react';
import { planimSvgFromSpec } from '../../utils/planim/dsl';

// Планиметрический чертёж из блока ```planim (статичный SVG — для задачи,
// теории, печати). Разметку строит общая planimSvgFromSpec — та же, что в
// конвейере теории. Классы — как у стереочертежа (`stereo-figure`): печатные
// листы масштабируют и прячут чертежи по ним.
// inline — чертёж в строке / ячейке таблицы (`planim: …`).
export default function PlanimSVG({ spec, maxWidth, style, inline = false }) {
  const html = useMemo(() => {
    try {
      return planimSvgFromSpec(spec || '', { maxWidth });
    } catch {
      return '<span style="color:#b91c1c;font-size:12px">Чертёж не построился</span>';
    }
  }, [spec, maxWidth]);
  const box = inline
    ? { display: 'inline-block', verticalAlign: 'middle', width: maxWidth, maxWidth: '100%' }
    : { display: 'block' };
  return (
    <span
      className={inline ? 'stereo-figure stereo-inline planim-figure-svg' : 'stereo-figure planim-figure-svg'}
      style={{ ...box, ...style }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
