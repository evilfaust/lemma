import { useMemo } from 'react';
import { parseGridPaper, gridPaperSvg } from '../../utils/gridPaper';

// Поле «в клетку» для рукописного решения (см. utils/gridPaper.js). Принимает
// текстовый DSL (`spec`) или готовую модель (`model`). Рендер делегирован общей
// функции gridPaperSvg → разметка идентична той, что строит конвейер теории.
//
// Обёртка — блочная (в отличие от .numline/.coordplot): поле без явной ширины
// тянется на всю ширину ячейки таблицы или абзаца, а inline-block схлопнул бы
// его по min-content.
export default function GridPaperSVG({ spec, model, style }) {
  const html = useMemo(() => {
    const m = model || parseGridPaper(spec || '');
    return gridPaperSvg(m);
  }, [spec, model]);

  return (
    <span
      className="grid-paper"
      style={{ display: 'block', margin: '4px 0', ...style }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
