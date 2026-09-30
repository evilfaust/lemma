import { useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import { linter, lintGutter } from '@codemirror/lint';
import { katexDiagnostics } from '../../utils/katexLint';
import { imageFilesFrom } from '../../utils/imageSnippet';

// Линтер: на каждое изменение (с задержкой) ищет битые $…$ формулы через KaTeX.
const katexLinter = linter(
  (view) => katexDiagnostics(view.state.doc.toString()),
  { delay: 400 },
);

/**
 * Внутренний редактор кода для LaTeX/markdown-полей.
 * Грузится ЛЕНИВО (через LatexField → React.lazy), поэтому весь CodeMirror
 * попадает в отдельный чанк и не утяжеляет основной бандл.
 *
 * Наружу выглядит как контролируемое поле: props value / onChange(value).
 * basicSetup у @uiw/react-codemirror включает searchKeymap → Ctrl+F (поиск)
 * и Ctrl+H (замена) работают из коробки.
 */
export default function LatexCodeMirror({
  value = '', onChange, onCaret, onImageFiles, placeholder = '', minRows = 4, maxRows = 24,
}) {
  const lineHeightPx = 21; // примерная высота строки CM при дефолтном шрифте
  // Расширения собираются один раз — свежий колбэк берём из ref.
  const imageFilesRef = useRef(onImageFiles);
  imageFilesRef.current = onImageFiles;
  const extensions = useMemo(() => {
    // Скриншот (Ctrl+V) или брошенная картинка — наружу, в Библиотеку.
    const takeImages = (dataTransfer, e) => {
      const files = imageFilesRef.current ? imageFilesFrom(dataTransfer) : [];
      if (!files.length) return false;
      e.preventDefault();
      imageFilesRef.current(files);
      return true;
    };
    return [
      markdown(), EditorView.lineWrapping, katexLinter, lintGutter(),
      EditorView.domEventHandlers({
        paste: (e) => takeImages(e.clipboardData, e),
        drop: (e) => takeImages(e.dataTransfer, e),
      }),
    ];
  }, []);

  return (
    <CodeMirror
      value={value}
      onChange={(val) => onChange?.(val)}
      onUpdate={(vu) => {
        // Позиция каретки нужна снаружи: вставка сниппета по курсору и поиск
        // чертежа под курсором для правки.
        if (onCaret && (vu.selectionSet || vu.docChanged)) {
          const sel = vu.state.selection.main;
          onCaret({ start: sel.from, end: sel.to });
        }
      }}
      placeholder={placeholder}
      extensions={extensions}
      minHeight={`${minRows * lineHeightPx}px`}
      maxHeight={`${maxRows * lineHeightPx}px`}
      basicSetup={{
        lineNumbers: false,
        foldGutter: false,
        highlightActiveLine: false,
        highlightActiveLineGutter: false,
        searchKeymap: true,
      }}
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: 6,
        fontSize: 14,
        overflow: 'hidden',
      }}
    />
  );
}
