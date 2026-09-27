// Инлайн-форма стереочертежа — одной строкой, для ячейки markdown-таблицы:
//   `stereo: куб 4; M на AA1 1:2; сечение MB1D1; вид 30 20`
// Команды — те же, что в блоке ```stereo, только через «;». Палка «|»
// (параллельная «(P||AB)») внутри ячейки таблицы экранируется «\|» — иначе GFM
// разрежет ячейку; при чтении экранирование снимается в любом контексте.
// Модуль без зависимостей: его подключают и поиск по курсору, и рендер.

export const STEREO_INLINE_WIDTH = 220;

/** `stereo: …` (без приставки) → текст блока ```stereo, строка на команду. */
export function stereoSpecFromInline(inline) {
  return String(inline || '')
    .replace(/\\\|/g, '|')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n');
}

/** Текст блока → инлайн (без приставки): без комментариев и подписей шагов. */
export function stereoInlineFromSpec(spec) {
  return String(spec || '')
    .split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l))
    .map((l) => l.split('//')[0].replace(/;/g, ',').trim())
    .filter(Boolean)
    .join('; ')
    .replace(/\|/g, '\\|');
}
