import './printFill.css';

/**
 * Разлиновка зоны для письма: клетка 5 мм, линейка или пусто.
 *
 * 🚨 Число линий считается ТОЧНО под размер блока (запас максимум +1). Лишние
 * абсолютные линии Chrome включает в расчёт печатной области и ужимает весь
 * лист — масштаб съезжал до ~65%, при том что на экране всё выглядело верно.
 * `overflow: hidden` спасает только показ, но не печать.
 *
 * Родитель обязан быть `position: relative` с `overflow: hidden` и знать свои
 * размеры в миллиметрах — они же передаются сюда.
 *
 * Та же математика лежит в `print-sheet/SolutionFill.jsx` (движок печатных
 * листов); здесь она вынесена отдельно, чтобы её могли брать печатные вёрстки
 * вне того движка.
 */
/**
 * Сколько линий рисовать. Вынесено чистой функцией: именно счётчики — то
 * место, где ошибка ломает масштаб печати, и именно они покрыты тестами.
 */
export function fillLineCounts({ fill = 'grid', heightMm = 0, widthMm = 0, cellMm = 5, lineMm = 8 }) {
  if (fill === 'blank' || !heightMm) return { h: 0, v: 0 };
  if (fill === 'lines') return { h: Math.max(0, Math.ceil(heightMm / lineMm) - 1), v: 0 };
  return {
    h: Math.max(0, Math.ceil(heightMm / cellMm) - 1),
    v: Math.max(0, Math.ceil(widthMm / cellMm) - 1),
  };
}

export function PrintFill({ fill = 'grid', heightMm, widthMm, cellMm = 5, lineMm = 8 }) {
  if (fill === 'blank' || !heightMm) return null;

  if (fill === 'lines') {
    const { h: n } = fillLineCounts({ fill, heightMm, lineMm });
    return (
      <div className="pfill" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <div key={`l${i}`} className="pfill-h" style={{ top: `${(i + 1) * lineMm}mm` }} />
        ))}
      </div>
    );
  }

  const { h, v } = fillLineCounts({ fill, heightMm, widthMm: widthMm || 0, cellMm });
  return (
    <div className="pfill" aria-hidden="true">
      {Array.from({ length: h }, (_, i) => (
        <div key={`h${i}`} className="pfill-h" style={{ top: `${(i + 1) * cellMm}mm` }} />
      ))}
      {Array.from({ length: v }, (_, i) => (
        <div key={`v${i}`} className="pfill-v" style={{ left: `${(i + 1) * cellMm}mm` }} />
      ))}
    </div>
  );
}

export default PrintFill;
