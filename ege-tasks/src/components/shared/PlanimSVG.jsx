import { useContext, useMemo } from 'react';
import { planimSvgFromSpec, planimPrintSvgFromSpec } from '../../utils/planim/dsl';
import { DrawingPrintContext } from './drawingPrintContext';

// Планиметрический чертёж из блока ```planim (статичный SVG — для задачи,
// теории, печати). Разметку строит общая planimSvgFromSpec — та же, что в
// конвейере теории. Классы — как у стереочертежа (`stereo-figure`): печатные
// листы масштабируют и прячут чертежи по ним.
// inline — чертёж в строке / ячейке таблицы (`planim: …`).
// На печатном листе (DrawingPrintContext) блочный чертёж строится под своё
// место в миллиметрах — буквы на нём того же размера, что в условии.
export default function PlanimSVG({ spec, maxWidth, style, inline = false }) {
  const place = useContext(DrawingPrintContext);
  const print = !inline && place ? place : null;
  const { widthMm, heightMm, letterMm } = print || {};
  const html = useMemo(() => {
    try {
      return print
        ? planimPrintSvgFromSpec(spec || '', { widthMm, heightMm, letterMm })
        : planimSvgFromSpec(spec || '', { maxWidth });
    } catch {
      return '<span style="color:#b91c1c;font-size:12px">Чертёж не построился</span>';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, maxWidth, !!print, widthMm, heightMm, letterMm]);
  const box = inline
    ? { display: 'inline-block', verticalAlign: 'middle', width: maxWidth, maxWidth: '100%' }
    : { display: 'block' };
  return (
    <span
      className={inline
        ? 'stereo-figure stereo-inline planim-figure-svg'
        : `stereo-figure planim-figure-svg${print ? ' drawing-print' : ''}`}
      style={{ ...box, ...style }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
