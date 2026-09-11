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

export function MathText({ text, className }) {
  const parts = useMemo(() => {
    const raw = String(text ?? '');
    if (!raw) return [];
    return raw.split(SPLIT_RE).filter(p => p !== '');
  }, [text]);

  if (!parts.length) return null;

  return (
    <span className={className}>
      {parts.map((part, i) => {
        const block = part.startsWith('$$') && part.endsWith('$$') && part.length > 4;
        const inline = !block && part.startsWith('$') && part.endsWith('$') && part.length > 2;
        if (!block && !inline) return <span key={i}>{part}</span>;

        // displayMode всегда false: `$$…$$` в подписи типа — почти всегда
        // привычка писать формулу, а не желание вынести её отдельной строкой
        // по центру ячейки. Строка должна остаться строкой.
        const html = render(part.slice(block ? 2 : 1, block ? -2 : -1), false);
        // Битую формулу показываем исходником, а не пустотой: учителю надо
        // видеть, что он написал, чтобы это исправить.
        if (html === null) return <span key={i}>{part}</span>;
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </span>
  );
}

export default MathText;
