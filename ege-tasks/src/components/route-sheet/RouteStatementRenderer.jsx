import katex from 'katex';
import 'katex/dist/katex.min.css';

const PH_RE = /\[[①②③④⑤⑥⑦⑧⑨]\]/g;

// Внутри LaTeX: [①] → \textcolor{#c0c0c0}{\text{①}}
function injectIntoLatex(tex) {
  return tex.replace(PH_RE, m => `\\textcolor{#c0c0c0}{\\text{${m[1]}}}`);
}

function renderKatex(tex, display) {
  try {
    return katex.renderToString(injectIntoLatex(tex), {
      displayMode: display,
      throwOnError: false,
      output: 'html',
      trust: true,
    });
  } catch {
    return tex;
  }
}

// Разбивает на: блочный LaTeX, инлайн LaTeX, плейсхолдер, обычный текст
const SPLIT_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\[[①②③④⑤⑥⑦⑧⑨]\])/g;

export default function RouteStatementRenderer({ content }) {
  if (!content) return null;

  const parts = content.split(SPLIT_RE).filter(p => p !== '');

  return (
    <span className="rs-stmt-inline">
      {parts.map((part, i) => {
        if (part.startsWith('$$') && part.endsWith('$$') && part.length > 4) {
          return (
            <span
              key={i}
              className="rs-math-block"
              dangerouslySetInnerHTML={{ __html: renderKatex(part.slice(2, -2), true) }}
            />
          );
        }
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: renderKatex(part.slice(1, -1), false) }}
            />
          );
        }
        if (/^\[[①②③④⑤⑥⑦⑧⑨]\]$/.test(part)) {
          // Плейсхолдер вне LaTeX
          return <span key={i} className="rs-ph">{part[1]}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
