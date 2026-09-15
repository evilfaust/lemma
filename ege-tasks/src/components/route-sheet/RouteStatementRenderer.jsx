import katex from 'katex';
import 'katex/dist/katex.min.css';
import { CIRCLE_CLASS } from '../../utils/routeSheet';

// Класс кружковых цифр — общий с разбором цепочки (utils/routeSheet.js): маршрут
// бывает длиннее девяти задач, и плейсхолдер [⑫] должен рисоваться так же.
const PH_RE = new RegExp(`\\[${CIRCLE_CLASS}\\]`, 'g');

// Внутри LaTeX: [①] → \text{①}. Рамкой (\fcolorbox), как вне формулы, не
// обводим: у кружковой цифры нет метрик в шрифтах KaTeX, и рамка съезжает под
// базовую линию — на печати читается как посторонний значок.
// 🚨 Цвета нет намеренно (v3.9.202): серым плейсхолдер на ч/б принтере
// выцветал до дырки в условии. Роль «сюда ответ» держит сам глиф кружка.
function injectIntoLatex(tex) {
  return tex.replace(PH_RE, m => `\\text{${m[1]}}`);
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
const PH_ONE_RE = new RegExp(`^\\[${CIRCLE_CLASS}\\]$`);

const SPLIT_RE = new RegExp(`(\\$\\$[\\s\\S]+?\\$\\$|\\$[^$\\n]+?\\$|\\[${CIRCLE_CLASS}\\])`, 'g');

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
        if (PH_ONE_RE.test(part)) {
          // Плейсхолдер вне LaTeX
          return <span key={i} className="rs-ph">{part[1]}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
