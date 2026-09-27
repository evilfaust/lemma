import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { App } from 'antd';
import NumberLineModal from '../components/shared/NumberLineModal';
import PlotModal from '../components/shared/PlotModal';
import GridPaperModal from '../components/shared/GridPaperModal';
import { TABLE_SNIPPETS } from '../utils/markdownTables';
import { findPlotAtCursor, findGridAtCursor, findStereoAtCursor } from '../utils/plotSnippet';
import { insertAtCaret } from '../utils/caretInsert';
import { fixLatexRoots } from '../utils/fixLatexRoots';
import { stereoBlockMarkdown } from '../utils/stereo/dsl';

// Стереоредактор тяжёлый — грузится, только когда учитель его открыл.
const StereoModal = lazy(() => import('../components/stereo/StereoModal'));

/**
 * Вставка в markdown-поля формы (условие, решение): таблицы, числовая прямая,
 * графики и векторы, клетка, стереочертёж, починка корней. Один код для
 * редактора задач (TaskEditModal) и редактора геометрических задач — раньше
 * всё это жило только в TaskEditModal.
 *
 * @param form   — antd Form instance
 * @param fields — { [name]: { ref?, setPreview? } }: ref — LatexField (для
 *                 живой каретки), setPreview — обновить предпросмотр поля
 *
 * Вставка — на место курсора (позиция помнится и после клика по кнопке
 * тулбара); курсор внутри готового блока — конструктор открывается на правку.
 */
export default function useFieldInserts({ form, fields = {} }) {
  const { message } = App.useApp();
  const caretRef = useRef({});
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;
  const [numlineTarget, setNumlineTarget] = useState(null);
  const [plotTarget, setPlotTarget] = useState(null);
  const [gridTarget, setGridTarget] = useState(null);
  const [stereoTarget, setStereoTarget] = useState(null);

  const textAreaOf = (field) => fieldsRef.current[field]?.ref?.current?.resizableTextArea?.textArea || null;

  /** Для LatexField: onCaret={inserts.onCaret('statement_md')}. */
  const onCaret = useCallback((field) => (sel) => { caretRef.current[field] = sel; }, []);

  const fieldCaret = useCallback((field) => {
    const el = textAreaOf(field);
    if (el && document.activeElement === el) return { start: el.selectionStart, end: el.selectionEnd };
    return caretRef.current[field] || null;
  }, []);

  const setField = useCallback((field, text) => {
    form.setFieldValue(field, text);
    fieldsRef.current[field]?.setPreview?.(text);
  }, [form]);

  const insertSnippet = useCallback((field, snippet) => {
    if (!field) return;
    const cur = form.getFieldValue(field) || '';
    const { text, caret } = insertAtCaret(cur, fieldCaret(field), snippet);
    setField(field, text);
    // Курсор — за вставленным куском: следующий чертёж не ляжет поверх этого.
    caretRef.current[field] = { start: caret, end: caret };
    const el = textAreaOf(field);
    if (el) setTimeout(() => { el.focus(); el.setSelectionRange(caret, caret); }, 0);
  }, [form, fieldCaret, setField]);

  // Замена куска поля (правка уже вставленного чертежа). Обрамляющие переводы
  // строки у блочного сниппета срезаем — они уже есть вокруг найденного блока.
  const replaceRange = useCallback((field, [from, to], snippet) => {
    const cur = form.getFieldValue(field) || '';
    const body = snippet.replace(/^\n+/, '').replace(/\n+$/, '');
    setField(field, cur.slice(0, from) + body + cur.slice(to));
    caretRef.current[field] = { start: from + body.length, end: from + body.length };
  }, [form, setField]);

  const findAt = useCallback((field, finder) => {
    const pos = fieldCaret(field)?.start;
    return pos == null ? null : finder(form.getFieldValue(field) || '', pos);
  }, [form, fieldCaret]);

  const openNumline = useCallback((field) => setNumlineTarget(field), []);

  const openPlot = useCallback((field, kind) => {
    const found = findAt(field, findPlotAtCursor);
    setPlotTarget(found
      ? { field, kind: found.kind, spec: found.spec, format: found.format, range: [found.start, found.end] }
      : { field, kind });
  }, [findAt]);

  const openGrid = useCallback((field) => {
    const found = findAt(field, findGridAtCursor);
    setGridTarget(found
      ? { field, spec: found.spec, format: found.format, range: [found.start, found.end] }
      : { field });
  }, [findAt]);

  const openStereo = useCallback((field) => {
    const found = findAt(field, findStereoAtCursor);
    setStereoTarget(found
      ? { field, spec: found.spec, format: found.format, range: [found.start, found.end] }
      : { field });
  }, [findAt]);

  const applyTarget = (target, snippet) => {
    if (target?.range) replaceRange(target.field, target.range, snippet);
    else insertSnippet(target?.field, snippet);
  };

  const tableMenu = useCallback((field) => ({
    items: TABLE_SNIPPETS.map((s) => ({
      key: s.key,
      label: (
        <div style={{ lineHeight: 1.3 }}>
          <div>{s.label}</div>
          <div style={{ fontSize: 11, color: '#888' }}>{s.hint}</div>
        </div>
      ),
    })),
    onClick: ({ key }) => {
      const snippet = TABLE_SNIPPETS.find((s) => s.key === key);
      if (snippet) insertSnippet(field, snippet.md);
    },
  }), [insertSnippet]);

  // Битые корни после разбора sdamgia (\sqrt: начало аргумента: X конец
  // аргумента → \sqrt{X}): мгновенно, без сети.
  const fixRootsIn = useCallback((fieldKeys, label) => {
    let changed = 0;
    let hadContent = false;
    fieldKeys.forEach((key) => {
      const current = form.getFieldValue(key) || '';
      if (!current.trim()) return;
      hadContent = true;
      const fixed = fixLatexRoots(current);
      if (fixed !== current) {
        setField(key, fixed);
        changed++;
      }
    });
    if (!hadContent) message.info(`Нечего чинить (${label} пусто)`);
    else if (changed === 0) message.info('Битых корней не найдено');
    else message.success(`Корни починены (${label}). Не забудьте «Сохранить».`);
  }, [form, message, setField]);

  // Конструкторы — снаружи основного Modal (focus-trap, z-index).
  const modals = (
    <>
      <NumberLineModal
        open={!!numlineTarget}
        onCancel={() => setNumlineTarget(null)}
        onInsert={(snippet) => { insertSnippet(numlineTarget, snippet); setNumlineTarget(null); }}
        defaultFormat="inline"
      />
      <GridPaperModal
        open={!!gridTarget}
        initialSpec={gridTarget?.spec || null}
        defaultFormat={gridTarget?.format || 'inline'}
        onCancel={() => setGridTarget(null)}
        onInsert={(snippet) => { applyTarget(gridTarget, snippet); setGridTarget(null); }}
      />
      <PlotModal
        open={!!plotTarget}
        kind={plotTarget?.kind || 'function'}
        initialSpec={plotTarget?.spec || null}
        onCancel={() => setPlotTarget(null)}
        onInsert={(snippet) => { applyTarget(plotTarget, snippet); setPlotTarget(null); }}
        defaultFormat={plotTarget?.format || 'block'}
      />
      {stereoTarget && (
        <Suspense fallback={null}>
          <StereoModal
            open
            initialSpec={stereoTarget.spec || null}
            defaultFormat={stereoTarget.format || 'block'}
            onClose={() => setStereoTarget(null)}
            onApply={({ scene, camera, color, size, format }) => {
              applyTarget(stereoTarget, stereoBlockMarkdown(scene, camera, { color, size, format }));
              setStereoTarget(null);
            }}
          />
        </Suspense>
      )}
    </>
  );

  return {
    onCaret, fieldCaret, insertSnippet, replaceRange,
    openNumline, openPlot, openGrid, openStereo, tableMenu, fixRootsIn,
    modals,
  };
}
