import { InlineMath, BlockMath } from 'react-katex';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Универсальный компонент для рендеринга текста с Markdown и LaTeX формулами
 * Поддерживает:
 * - Markdown разметку (заголовки, списки, таблицы, жирный текст и т.д.)
 * - Inline формулы $...$
 * - Блочные формулы $$...$$
 */
const MathRenderer = ({ text, inline = true }) => {
  if (!text) return null;

  // Функция для обработки LaTeX в тексте
  const processLatex = (content) => {
    const parts = [];
    let lastIndex = 0;

    // Сначала ищем блочные формулы $$...$$
    const blockRegex = /\$\$([^$]+)\$\$/g;
    let blockMatch;
    const blockMatches = [];

    while ((blockMatch = blockRegex.exec(content)) !== null) {
      blockMatches.push({
        start: blockMatch.index,
        end: blockMatch.index + blockMatch[0].length,
        content: blockMatch[1],
        type: 'block'
      });
    }

    // Затем ищем inline формулы $...$, исключая блочные
    const inlineRegex = /\$([^$]+)\$/g;
    let inlineMatch;
    const inlineMatches = [];

    while ((inlineMatch = inlineRegex.exec(content)) !== null) {
      // Проверяем, не находится ли эта формула внутри блочной
      const isInsideBlock = blockMatches.some(
        block => inlineMatch.index >= block.start && inlineMatch.index < block.end
      );

      if (!isInsideBlock) {
        inlineMatches.push({
          start: inlineMatch.index,
          end: inlineMatch.index + inlineMatch[0].length,
          content: inlineMatch[1],
          type: 'inline'
        });
      }
    }

    // Объединяем и сортируем все совпадения
    const allMatches = [...blockMatches, ...inlineMatches].sort((a, b) => a.start - b.start);

    // Строим итоговый массив элементов
    allMatches.forEach((match, index) => {
      // Добавляем текст до формулы
      if (match.start > lastIndex) {
        parts.push(content.substring(lastIndex, match.start));
      }

      // Добавляем формулу
      if (match.type === 'block') {
        parts.push(
          <div key={`block-${index}`} style={{ margin: '10px 0' }}>
            <BlockMath math={match.content} />
          </div>
        );
      } else {
        parts.push(
          <InlineMath key={`inline-${index}`} math={match.content} />
        );
      }

      lastIndex = match.end;
    });

    // Добавляем оставшийся текст
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  // Кастомные компоненты для react-markdown
  const components = {
    // Обрабатываем текстовые узлы для LaTeX
    p: ({ children, ...props }) => {
      // Если children это строка, обрабатываем LaTeX
      if (typeof children === 'string') {
        return <p {...props}>{processLatex(children)}</p>;
      }
      // Если children это массив, обрабатываем каждый элемент
      if (Array.isArray(children)) {
        return (
          <p {...props}>
            {children.map((child, idx) =>
              typeof child === 'string' ? processLatex(child) : child
            )}
          </p>
        );
      }
      return <p {...props}>{children}</p>;
    },

    // Обрабатываем текст в ячейках таблицы
    td: ({ children, ...props }) => {
      if (typeof children === 'string') {
        return <td {...props}>{processLatex(children)}</td>;
      }
      if (Array.isArray(children)) {
        return (
          <td {...props}>
            {children.map((child, idx) =>
              typeof child === 'string' ? processLatex(child) : child
            )}
          </td>
        );
      }
      return <td {...props}>{children}</td>;
    },

    // Обрабатываем текст в заголовках таблицы
    th: ({ children, ...props }) => {
      if (typeof children === 'string') {
        return <th {...props}>{processLatex(children)}</th>;
      }
      if (Array.isArray(children)) {
        return (
          <th {...props}>
            {children.map((child, idx) =>
              typeof child === 'string' ? processLatex(child) : child
            )}
          </th>
        );
      }
      return <th {...props}>{children}</th>;
    },

    // Обрабатываем текст в элементах списка
    li: ({ children, ...props }) => {
      if (typeof children === 'string') {
        return <li {...props}>{processLatex(children)}</li>;
      }
      if (Array.isArray(children)) {
        return (
          <li {...props}>
            {children.map((child, idx) =>
              typeof child === 'string' ? processLatex(child) : child
            )}
          </li>
        );
      }
      return <li {...props}>{children}</li>;
    },

    // Обрабатываем заголовки
    h1: ({ children, ...props }) => {
      if (typeof children === 'string') {
        return <h1 {...props}>{processLatex(children)}</h1>;
      }
      return <h1 {...props}>{children}</h1>;
    },
    h2: ({ children, ...props }) => {
      if (typeof children === 'string') {
        return <h2 {...props}>{processLatex(children)}</h2>;
      }
      return <h2 {...props}>{children}</h2>;
    },
    h3: ({ children, ...props }) => {
      if (typeof children === 'string') {
        return <h3 {...props}>{processLatex(children)}</h3>;
      }
      return <h3 {...props}>{children}</h3>;
    },

    // Стили для таблиц
    table: ({ children, ...props }) => (
      <table {...props} style={{
        borderCollapse: 'collapse',
        width: '100%',
        marginBottom: '1em',
        border: '1px solid #ddd'
      }}>
        {children}
      </table>
    ),
    thead: ({ children, ...props }) => (
      <thead {...props} style={{ backgroundColor: '#f5f5f5' }}>
        {children}
      </thead>
    ),
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
    >
      {text}
    </ReactMarkdown>
  );
};

export default MathRenderer;
