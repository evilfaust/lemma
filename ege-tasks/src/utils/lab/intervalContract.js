export const INTERVAL_SKILLS = [
  { key: 'product', label: 'Произведения скобок' },
  { key: 'fraction', label: 'Дробно-рациональные' },
  { key: 'multiplicity', label: 'Чётные кратности' },
];
export const INTERVAL_STEPS = [
  { key: 'roots', label: 'Найди корни', hint: 'Приравняй к нулю каждый множитель числителя и знаменателя.' },
  { key: 'order', label: 'Расставь корни', hint: 'На прямой меньшее число находится левее. У отрицательных чисел меньше то, которое дальше от нуля.' },
  { key: 'changes', label: 'Отметь чётные корни', hint: 'Если кратность чётная, при переходе через точку знак сохраняется. Отметь такую точку знаком !.' },
  { key: 'points', label: 'Закрась или выколи точки', hint: 'Нуль знаменателя всегда выколот. Нуль числителя закрашивают при нестрогом знаке.' },
  { key: 'signs', label: 'Поставь знаки', hint: 'Подставь число из одного промежутка. Через нечётную кратность знак меняется, через чётную сохраняется.' },
  { key: 'answer', label: 'Заштрихуй ответ', hint: 'Для > и ≥ выбирай положительные промежутки. Для < и ≤ выбирай отрицательные. Закрашенные точки уже входят в ответ.' },
  { key: 'notation', label: 'Запиши ответ', hint: 'Круглая скобка соответствует выколотой точке, квадратная — закрашенной. Промежутки объединяй знаком ∪.' },
];
export const intervalExperimentPath = (id) => `/student/lab-interval/${encodeURIComponent(id)}`;
export function intervalGapLabels(roots) {
  return Array.from({ length: roots.length + 1 }, (_, i) => `(${i ? roots[i - 1] : '−∞'}; ${i < roots.length ? roots[i] : '+∞'})`);
}

export function emptyIntervalInput(step, n, points) {
  if (step === 'roots' || step === 'notation') return '';
  if (step === 'order') return [];
  if (step === 'changes') return Array(n).fill(true);
  if (step === 'answer') return { gaps: Array(n + 1).fill(false), points: points ?? Array(n).fill(false) };
  return Array(n + (step === 'signs' ? 1 : 0)).fill(null);
}

export function intervalSelectionText(roots, value) {
  const gaps = intervalGapLabels(roots);
  const selected = [];
  for (let i = 0; i <= roots.length; i++) {
    if (value?.gaps?.[i]) selected.push(gaps[i]);
    if (i < roots.length && value?.points?.[i]) selected.push(`{${roots[i]}}`);
  }
  return selected.join(' ∪ ') || '∅';
}

export function intervalStepAnswerText(task, step, value) {
  if (step === 'roots' || step === 'notation') return String(value ?? '');
  if (step === 'order') return value.join(' → ');
  if (step === 'answer') return intervalSelectionText(task.roots, value);
  if (step === 'signs') return intervalGapLabels(task.roots).map((label, i) => `${label}: ${value?.[i] === 1 ? '+' : value?.[i] === -1 ? '−' : 'не задан'}`).join('; ');
  return task.roots.map((root, i) => `${root}: ${value?.[i] == null ? 'не задано' : step === 'changes' ? value[i] ? 'знак меняется' : 'знак сохраняется' : value[i] ? 'точка входит' : 'точка исключена'}`).join('; ');
}
