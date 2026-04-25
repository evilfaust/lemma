/**
 * Chip — категорийный тег с цветной точкой.
 * tint: 'blue' | 'teal' | 'violet' | 'amber' | 'rose'
 */
export function Chip({ tint = 'blue', children, interactive = false, onClick, style }) {
  return (
    <span
      className={[
        'lemma-chip',
        `lemma-chip-${tint}`,
        interactive ? 'lemma-chip-interactive' : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      style={{ cursor: interactive ? 'pointer' : 'default', ...style }}
    >
      {children}
    </span>
  );
}

/** Маппинг тематики задачи → tint */
export const TOPIC_TINT = {
  'алгебра':     'blue',
  'анализ':      'violet',
  'геометрия':   'teal',
  'устный счёт': 'amber',
  'егэ':         'rose',
};

export function topicTint(kindOrTopic = '') {
  const key = kindOrTopic.toLowerCase();
  for (const [k, v] of Object.entries(TOPIC_TINT)) {
    if (key.includes(k)) return v;
  }
  return 'blue';
}
