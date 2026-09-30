// Инлайн-форма планиметрического чертежа — одной строкой, для ячейки
// markdown-таблицы:
//   `planim: треугольник ABC 5 6 7; H = высота B AC; угол ABH 30`
// Команды — те же, что в блоке ```planim, только через «;». Точка с запятой
// внутри скобок — часть команды («A = (0; 0)», «окр(O;3)»), по ней строка не
// режется. Палка «|» («(P||AB)») в ячейке таблицы экранируется «\|» — иначе GFM
// разрежет ячейку; при чтении экранирование снимается в любом контексте.
// Модуль без зависимостей: его подключают и поиск по курсору, и рендер.

export const PLANIM_INLINE_WIDTH = 200;

/** Разрезать строку по «;» вне скобок. */
function splitTopLevel(text) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of String(text || '')) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ';' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** `planim: …` (без приставки) → текст блока ```planim, строка на команду. */
export function planimSpecFromInline(inline) {
  return splitTopLevel(String(inline || '').replace(/\\\|/g, '|'))
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n');
}

/** Текст блока → инлайн (без приставки): без комментариев и подписей шагов. */
export function planimInlineFromSpec(spec) {
  return String(spec || '')
    .split(/\r?\n/)
    .filter((l) => !/^\s*#/.test(l))
    .map((l) => splitTopLevel(l.split('//')[0]).join(',').trim())
    .filter(Boolean)
    .join('; ')
    .replace(/\|/g, '\\|');
}
