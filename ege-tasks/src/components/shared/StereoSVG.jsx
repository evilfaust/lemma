import { useContext, useMemo } from 'react';
import { stereoSvgFromSpec, stereoPrintSvgFromSpec } from '../../utils/stereo/dsl';
import { DrawingPrintContext } from './drawingPrintContext';

// Стереочертёж из блока ```stereo (статичный SVG — для задачи, теории, печати).
// Разметку строит общая stereoSvgFromSpec — та же, что в конвейере теории.
// inline — чертёж в строке / ячейке таблицы (`stereo: …`): компактный блок
// фиксированной ширины, выровненный по середине строки.
// На печатном листе (DrawingPrintContext) блочный чертёж строится под своё
// место в миллиметрах — буквы на нём того же размера, что в условии.
export default function StereoSVG({ spec, maxWidth, style, inline = false }) {
  const place = useContext(DrawingPrintContext);
  const print = !inline && place ? place : null;
  const { widthMm, heightMm, letterMm } = print || {};
  const html = useMemo(() => {
    try {
      return print
        ? stereoPrintSvgFromSpec(spec || '', { widthMm, heightMm, letterMm })
        : stereoSvgFromSpec(spec || '', { maxWidth });
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
      className={inline ? 'stereo-figure stereo-inline' : `stereo-figure${print ? ' drawing-print' : ''}`}
      style={{ ...box, ...style }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
