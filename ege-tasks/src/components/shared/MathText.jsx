import { useMemo } from 'react';
import katex from 'katex';

/**
 * Строка, в которой формулы перемешаны со словами: «Неполное: $ax^2 + bx = 0$».
 *
 * Отличие от соседей:
 *   `MathInline`  — вся строка целиком формула (`x^2-5x=0`);
 *   `MathRenderer` — полноценный markdown (абзацы, таблицы, чертежи, картинки);
 *   `MathText`    — одна строка, из разметки только `$…$`.
 *
 * Зачем отдельный компонент: подписи типов, признаки, инструкции и заголовки
 * живут ВНУТРИ строк вёрстки — в ячейке таблицы, в flex-строке с выключкой по
 * базовой линии, внутри `<span>`. MathRenderer туда не годится: он отдаёт
 * блочный `<p>`, а `<p>` внутри `<span>` браузер закрывает досрочно и ломает
 * строку. Здесь наружу идут только инлайновые узлы.
 *
 * Текст без долларов проходит насквозь — подписи, написанные юникодом
 * («ax² + bx = 0»), продолжают печататься как были.
 */

// Порядок важен: сначала блочные $$…$$, иначе они разберутся как два инлайна.
// Инлайн не пересекает перевод строки — одинокий «$» в тексте («цена $5»)
// так и остаётся текстом.
const SPLIT_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;

function render(tex, displayMode) {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false, output: 'html' });
  } catch {
    return null;
  }
}

// Знак препинания сразу за формулой («$y = f(x)$, определённой…») браузер
// охотно переносит на новую строку — строка начинается с запятой. Такой хвост
// приклеиваем к формуле. Тире отделено пробелом, его склеиваем неразрывным.
const TAIL_RE = /^(?:[,.;:!?)»…]+|\s+[—–](?=\s))/;

function splitParts(text) {
  const raw = String(text ?? '');
  if (!raw) return [];
  const parts = raw.split(SPLIT_RE).filter(p => p !== '');
  const out = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const next = parts[i + 1];
    const isFormula = part.startsWith('$') && part.endsWith('$') && part.length > 2;
    const tail = isFormula && next && !next.startsWith('$') ? next.match(TAIL_RE)?.[0] : null;
    if (tail) {
      out.push({ part, tail: tail.replace(/^\s+/, '\u00A0') });
      const rest = next.slice(tail.length);
      if (rest) out.push({ part: rest });
      i += 1;
    } else {
      out.push({ part });
    }
  }
  return out;
}

function renderPart(part, key) {
  const block = part.startsWith('$$') && part.endsWith('$$') && part.length > 4;
  const inline = !block && part.startsWith('$') && part.endsWith('$') && part.length > 2;
  if (!block && !inline) return <span key={key}>{part}</span>;

  // displayMode всегда false: `$$…$$` в подписи типа — почти всегда
  // привычка писать формулу, а не желание вынести её отдельной строкой
  // по центру ячейки. Строка должна остаться строкой.
  const html = render(part.slice(block ? 2 : 1, block ? -2 : -1), false);
  // Битую формулу показываем исходником, а не пустотой: учителю надо
  // видеть, что он написал, чтобы это исправить.
  if (html === null) return <span key={key}>{part}</span>;
  return <span key={key} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function MathText({ text, className }) {
  const parts = useMemo(() => splitParts(text), [text]);

  if (!parts.length) return null;

  return (
    <span className={className}>
      {parts.map(({ part, tail }, i) => (tail
        ? (
          <span key={i} style={{ whiteSpace: 'nowrap' }}>
            {renderPart(part, 'f')}{tail}
          </span>
        )
        : renderPart(part, i)))}
    </span>
  );
}

export default MathText;
