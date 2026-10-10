/**
 * Клетка / линейка в зоне решения.
 *
 * 🚨 Число линий считаем ТОЧНО под размер блока (запас максимум +1): лишние
 * абсолютные линии Chrome включает в расчёт печатной области и ужимает лист
 * (масштаб съезжал до ~65%).
 *
 * `notch` — угол зоны, занятый чертежом сбоку: { side: 'left'|'right', w, h } в
 * мм. Линии обходят его сами (горизонтальные короче, вертикальные начинаются
 * ниже) — без белых подложек под рисунком: фон при печати браузер может и
 * не напечатать.
 */
export default function SolutionFill({ fill, heightMm, widthMm, notch = null }) {
  if (fill === 'blank') return null;

  // Горизонталь на высоте y: в полосе угла — укорочена с его стороны.
  const hStyle = (y) => {
    const style = { top: `${y}mm` };
    if (notch && y < notch.h) style[notch.side] = `${notch.w}mm`;
    return style;
  };
  // Вертикаль на x: под углом — начинается от его низа.
  const inNotch = (x) => notch && (notch.side === 'right' ? x > widthMm - notch.w : x < notch.w);

  if (fill === 'lines') {
    const step = 8;
    const n = Math.max(0, Math.ceil(heightMm / step) - 1);
    return (
      <div className="ps-fill" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <div key={`l-${i}`} className="ps-fill-h" style={hStyle((i + 1) * step)} />
        ))}
      </div>
    );
  }

  const h = Math.max(0, Math.ceil(heightMm / 5) - 1);
  const v = Math.max(0, Math.ceil(widthMm / 5) - 1);
  return (
    <div className="ps-fill" aria-hidden="true">
      {Array.from({ length: h }, (_, i) => (
        <div key={`h-${i}`} className="ps-fill-h" style={hStyle((i + 1) * 5)} />
      ))}
      {Array.from({ length: v }, (_, i) => {
        const x = (i + 1) * 5;
        return (
          <div
            key={`v-${i}`}
            className="ps-fill-v"
            style={inNotch(x) ? { left: `${x}mm`, top: `${notch.h}mm` } : { left: `${x}mm` }}
          />
        );
      })}
    </div>
  );
}

/**
 * Рамка зоны решения с вырезанным углом под чертёж — ломаная «Г» из шести
 * отрезков (у такой зоны свой border прозрачный, высота та же). Координаты —
 * от внутреннего края border зоны, сама рамка лежит на его месте (сдвиг −T).
 * Правая и нижняя стороны привязаны к краям (`right`/`bottom`), а не к ширине
 * в мм: та на долю миллиметра расходится с настоящей.
 */
export function NotchFrame({ notch }) {
  const { side, w, h } = notch;
  const T = 0.25; // толщина рамки зоны, мм
  const mm = (v) => `${v}mm`;
  const out = mm(-T);
  const hor = (style) => ({ height: 0, borderTopWidth: mm(T), ...style });
  const ver = (style) => ({ width: 0, borderLeftWidth: mm(T), ...style });
  const segs = side === 'right' ? [
    hor({ top: out, left: out, right: mm(w) }),              // верх — до угла
    ver({ top: out, right: mm(w), height: mm(h + T) }),      // внутренняя сторона угла
    hor({ top: mm(h), right: out, width: mm(w + T) }),       // низ угла
    ver({ top: mm(h), right: out, bottom: out }),            // правая — от угла вниз
    ver({ top: out, left: out, bottom: out }),               // левая
  ] : [
    hor({ top: out, left: mm(w), right: out }),
    ver({ top: out, left: mm(w), height: mm(h + T) }),
    hor({ top: mm(h), left: out, width: mm(w + T) }),
    ver({ top: mm(h), left: out, bottom: out }),
    ver({ top: out, right: out, bottom: out }),
  ];
  segs.push(hor({ bottom: out, left: out, right: out }));    // низ
  return (
    <div className="ps-fill" aria-hidden="true">
      {segs.map((style, i) => <div key={i} className="ps-frame-seg" style={style} />)}
    </div>
  );
}
