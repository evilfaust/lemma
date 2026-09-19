// Подписи вида и размера точки на координатной плоскости. Живут отдельным
// модулем, потому что одни и те же списки нужны двум панелям конструктора:
// строке точки в PlotModal и разметке «точка на графике» в CurvePanel.
export const POINT_STYLE_OPTIONS = [
  { value: 'fill', label: '● закрашенная' },
  { value: 'open', label: '○ выколотая' },
  { value: 'cross', label: '✕ крестик' },
  { value: 'plus', label: '＋ плюсик' },
];

export const POINT_SIZE_OPTIONS = [
  { value: 'small', label: 'мелкая' },
  { value: 'normal', label: 'обычная' },
  { value: 'big', label: 'крупная' },
];
