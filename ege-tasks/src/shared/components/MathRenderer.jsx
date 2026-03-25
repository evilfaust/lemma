import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

/**
 * Универсальный компонент для рендеринга текста с Markdown и LaTeX формулами
 * Поддерживает:
 * - Markdown разметку (заголовки, списки, таблицы, жирный текст и т.д.)
 * - Inline формулы $...$
 * - Блочные формулы $$...$$
 */
const MathRenderer = ({ text, content, inline = true }) => {
  const sourceText = text ?? content;
  if (!sourceText) return null;

  // Кастомные компоненты для react-markdown
  const components = {
    p: ({ children, ...props }) => (
      <p {...props} style={{ margin: 0 }}>
        {children}
      </p>
    ),
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
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {sourceText}
    </ReactMarkdown>
  );
};

export default MathRenderer;
