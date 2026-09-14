/**
 * Схема листа — миниатюра A4 с раскладкой, чтобы выбор печати читался глазом,
 * а не только по подписи: учитель видит, что «карточки 2×3» — это шесть клеток,
 * а «рабочий лист» — отрезные полосы с местом для решения.
 *
 * Рисуется дивами: настоящий предпросмотр живёт на экране печати.
 */
export default function SheetThumb({ variant = 'cards', count = 6, cols = 2, solution = true }) {
  if (variant === 'work') {
    return (
      <div className="mg-thumb">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="mg-thumb-strip">
            <span className="mg-thumb-num" />
            <span className="mg-thumb-line" />
            {solution
              ? <span className="mg-thumb-grid" />
              : <span className="mg-thumb-line mg-thumb-line--short" />}
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="mg-thumb mg-thumb--table">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`mg-thumb-row${i === 0 ? ' is-head' : ''}`}>
            <span className="mg-thumb-cell mg-thumb-cell--name" />
            {Array.from({ length: 5 }, (_, j) => <span key={j} className="mg-thumb-cell" />)}
          </div>
        ))}
      </div>
    );
  }

  const rows = Math.max(1, Math.ceil(count / cols));
  return (
    <div
      className={`mg-thumb mg-thumb--grid${variant === 'answers' ? ' mg-thumb--answers' : ''}`}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
    >
      {Array.from({ length: rows * cols }, (_, i) => (
        <div key={i} className={`mg-thumb-cardlet${i >= count ? ' is-empty' : ''}`}>
          <span className="mg-thumb-num" />
          {variant !== 'answers' && <span className="mg-thumb-line" />}
        </div>
      ))}
    </div>
  );
}
