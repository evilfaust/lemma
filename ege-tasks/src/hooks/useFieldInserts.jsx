import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { App, Segmented, Typography } from 'antd';
import NumberLineModal from '../components/shared/NumberLineModal';
import PlotModal from '../components/shared/PlotModal';
import GridPaperModal from '../components/shared/GridPaperModal';
import { TABLE_SNIPPETS } from '../utils/markdownTables';
import { findPlotAtCursor, findGridAtCursor, findStereoAtCursor } from '../utils/plotSnippet';
import { insertAtCaret } from '../utils/caretInsert';
import { fixLatexRoots } from '../utils/fixLatexRoots';
import { stereoBlockMarkdown } from '../utils/stereo/dsl';
import { imageSnippetAt } from '../utils/imageSnippet';
import { materialsApi } from '../shared/services/pb/filesClient';

// Стереоредактор тяжёлый — грузится, только когда учитель его открыл.
const StereoModal = lazy(() => import('../components/stereo/StereoModal'));
// Пикер Библиотеки — тоже только по кнопке «Картинка».
const MaterialPickerModal = lazy(() => import('../components/workspace/MaterialPickerModal'));

// Размер вставляемой картинки помнится между задачами (и для Ctrl+V).
const IMAGE_SIZE_KEY = 'taskEditor.imageSize';
const IMAGE_SIZE_OPTIONS = [
  { value: '', label: 'Авто' },
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
  { value: 'XL', label: 'XL' },
];
const readImageSize = () => {
  try { return localStorage.getItem(IMAGE_SIZE_KEY) || ''; } catch { return ''; }
};

/**
 * Вставка в markdown-поля формы (условие, решение): таблицы, числовая прямая,
 * графики и векторы, клетка, стереочертёж, картинки, починка корней. Один код для
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
  const [imageTarget, setImageTarget] = useState(null);
  const [imageSize, setImageSizeState] = useState(readImageSize);
  const imageSizeRef = useRef(imageSize);
  imageSizeRef.current = imageSize;
  const setImageSize = useCallback((v) => {
    setImageSizeState(v);
    try { localStorage.setItem(IMAGE_SIZE_KEY, v); } catch { /* no-op */ }
  }, []);

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

  // Картинка: файл — в «Библиотеке» (pb-files), в поле — ![подпись](ссылка).
  // Курсор в строке таблицы — картинка встаёт в ячейку (imageSnippetAt).
  const openImage = useCallback((field) => setImageTarget(field), []);

  const insertImage = useCallback((field, { url, title }) => {
    if (!field || !url) return;
    const cur = form.getFieldValue(field) || '';
    insertSnippet(field, imageSnippetAt(cur, fieldCaret(field)?.start, {
      url, alt: title, size: imageSizeRef.current,
    }));
  }, [form, fieldCaret, insertSnippet]);

  // Скриншот из буфера (Ctrl+V) или файл, брошенный на поле: грузим в
  // Библиотеку и вставляем ссылку. Хранилище не подключено — открываем пикер:
  // в нём форма входа, после входа картинку можно выбрать или загрузить там же.
  const uploadImages = useCallback(async (field, files) => {
    if (!field || !files?.length) return;
    if (!materialsApi.isConnected()) {
      message.info('Картинки хранятся в «Библиотеке» — войдите в неё и вставьте картинку ещё раз');
      setImageTarget(field);
      return;
    }
    const key = `image-upload-${field}`;
    message.loading({ content: 'Загружаю картинку в Библиотеку…', key, duration: 0 });
    try {
      for (const file of files) {
        const base = String(file.name || '').replace(/\.[^.]+$/, '');
        // У скриншота из буфера имя безликое («image») — подписываем датой.
        const title = !base || /^image$/i.test(base)
          ? `Картинка ${new Date().toLocaleString('ru-RU')}`
          : base;
        const rec = await materialsApi.uploadMaterial({ file, title, category: 'other' });
        insertImage(field, { url: materialsApi.fileUrl(rec), title });
      }
      message.success({ content: 'Картинка загружена в Библиотеку и вставлена', key });
    } catch (e) {
      if (e?.status === 401) {
        materialsApi.disconnect();
        setImageTarget(field);
      }
      message.error({ content: `Не удалось загрузить картинку: ${e?.message || ''}`, key });
    }
  }, [insertImage, message]);

  /** Для LatexField: onImageFiles={inserts.onImageFiles('statement_md')}. */
  const onImageFiles = useCallback((field) => (files) => uploadImages(field, files), [uploadImages]);

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
      {imageTarget && (
        <Suspense fallback={null}>
          <MaterialPickerModal
            open
            kind="image"
            multiple={false}
            title="Картинка из Библиотеки"
            okText="Вставить"
            onClose={() => setImageTarget(null)}
            onPick={(picked) => { if (picked[0]) insertImage(imageTarget, picked[0]); }}
            extra={(
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>Размер:</span>
                <Segmented size="small" value={imageSize} onChange={setImageSize} options={IMAGE_SIZE_OPTIONS} />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  доля ширины: S 30 % · M 50 % · L 70 % · XL 100 %; «Авто» — как решит лист.
                  Поменять потом — буква в {'{M}'} после картинки
                </Typography.Text>
              </div>
            )}
          />
        </Suspense>
      )}
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
    openNumline, openPlot, openGrid, openStereo, openImage, onImageFiles, tableMenu, fixRootsIn,
    modals,
  };
}
