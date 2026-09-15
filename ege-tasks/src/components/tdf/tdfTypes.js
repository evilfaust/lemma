/**
 * ТДФ — единый словарь типов пунктов и статистика набора.
 *
 * До этого словарь `TYPE_LABELS` / `TYPE_COLORS` жил копиями в пяти файлах и
 * успел разойтись: в карточках-флипах в нём не было `geometry_formula`, из-за
 * чего девять гео-формул вообще не попадали в колоду. Один источник правды.
 *
 * tone — оттенок чипа `.lemma-chip` из theme/tokens.css (пятицветная палитра
 * раздела). Цветных Ant-тегов в разделе больше нет.
 */

export const TDF_TYPES = [
  { value: 'theorem',          label: 'Теорема',       short: 'Теор.',  tone: 'blue'    },
  { value: 'definition',       label: 'Определение',   short: 'Опр.',   tone: 'teal'    },
  { value: 'formula',          label: 'Формула',       short: 'Форм.',  tone: 'violet'  },
  { value: 'axiom',            label: 'Аксиома',       short: 'Акс.',   tone: 'amber'   },
  { value: 'property',         label: 'Свойство',      short: 'Св-во',  tone: 'rose'    },
  { value: 'criterion',        label: 'Признак',       short: 'Призн.', tone: 'blue'    },
  { value: 'corollary',        label: 'Следствие',     short: 'Следс.', tone: 'neutral' },
  { value: 'geometry_formula', label: 'Геом. формула', short: 'Геом.',  tone: 'violet'  },
];

/** Все значения типа — порядок тот же, что в TDF_TYPES (он же порядок легенды). */
export const TDF_TYPE_VALUES = TDF_TYPES.map(t => t.value);

const BY_VALUE = Object.fromEntries(TDF_TYPES.map(t => [t.value, t]));

export function tdfType(value) {
  return BY_VALUE[value] || null;
}

export function tdfTypeLabel(value) {
  return BY_VALUE[value]?.label || value || '';
}

export function tdfTypeShort(value) {
  return BY_VALUE[value]?.short || value || '';
}

export function tdfTypeTone(value) {
  return BY_VALUE[value]?.tone || 'neutral';
}

/** Опции для Select/Segmented — форма, которую ждут контролы Ant. */
export const TDF_TYPE_OPTIONS = TDF_TYPES.map(({ value, label }) => ({ value, label }));

/**
 * Сводка по пунктам набора — то, что учитель хочет видеть, не открывая конспект:
 * сколько пунктов, из чего состоит набор и чего в нём недоделано.
 *
 * Заголовки разделов (`is_section_header`) в счёт пунктов не идут: это верстка
 * конспекта, а не материал для опроса.
 */
export function tdfStats(items = []) {
  const real = items.filter(i => !i.is_section_header);
  const byType = {};
  let withDrawing = 0;
  let withNotation = 0;
  let withFormulation = 0;

  for (const item of real) {
    const key = item.type || 'unknown';
    byType[key] = (byType[key] || 0) + 1;
    if (item.drawing_image) withDrawing++;
    if ((item.short_notation_md || '').trim()) withNotation++;
    if ((item.formulation_md || '').trim()) withFormulation++;
  }

  return {
    total: real.length,
    sections: items.length - real.length,
    byType,
    withDrawing,
    withNotation,
    withFormulation,
    noDrawing: real.length - withDrawing,
    noNotation: real.length - withNotation,
    noFormulation: real.length - withFormulation,
  };
}

/** Состав набора чипами: [{ value, label, short, tone, count }] в порядке TDF_TYPES. */
export function tdfComposition(stats) {
  if (!stats) return [];
  return TDF_TYPES
    .map(t => ({ ...t, count: stats.byType[t.value] || 0 }))
    .filter(t => t.count > 0);
}
