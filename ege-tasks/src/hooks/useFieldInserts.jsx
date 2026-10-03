import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import { App, Segmented, Select, Typography } from 'antd';
import NumberLineModal from '../components/shared/NumberLineModal';
import PlotModal from '../components/shared/PlotModal';
import GridPaperModal from '../components/shared/GridPaperModal';
import { TABLE_SNIPPETS } from '../utils/markdownTables';
import { findPlotAtCursor, findGridAtCursor, findStereoAtCursor, findPlanimAtCursor } from '../utils/plotSnippet';
import { insertAtCaret } from '../utils/caretInsert';
import { fixLatexRoots } from '../utils/fixLatexRoots';
import { stereoBlockMarkdown } from '../utils/stereo/dsl';
import { planimBlockMarkdown } from '../utils/planim/dsl';
import { imagesSnippetAt, normalizeBatch, BATCH_PER_ROW } from '../utils/imageSnippet';
import { materialsApi } from '../shared/services/pb/filesClient';

// Стереоредактор тяжёлый — грузится, только когда учитель его открыл.
const StereoModal = lazy(() => import('../components/stereo/StereoModal'));
const PlanimModal = lazy(() => import('../components/planim/PlanimModal'));
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

// Раскладка пакета (несколько картинок сразу) — тоже помнится.
const IMAGE_BATCH_KEY = 'taskEditor.imageBatch';
const BATCH_LAYOUT_OPTIONS = [
  { value: 'column', label: 'Друг под другом' },
  { value: 'row', label: 'В ряд (галерея)' },
];
const BATCH_LABEL_OPTIONS = [
  { value: '', label: 'без подписей' },
  { value: 'num', label: '1) 2) 3)' },
  { value: 'ru', label: 'А) Б) В)' },
];
const BATCH_PER_ROW_OPTIONS = BATCH_PER_ROW.map((n) => ({ value: n, label: `по ${n}` }));
const readImageBatch = () => {
  try { return normalizeBatch(JSON.parse(localStorage.getItem(IMAGE_BATCH_KEY) || 'null')); }
  catch { return normalizeBatch(null); }
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
  const [planimTarget, setPlanimTarget] = useState(null);
  const [imageTarget, setImageTarget] = useState(null);
  const [imageSize, setImageSizeState] = useState(readImageSize);
  const imageSizeRef = useRef(imageSize);
  imageSizeRef.current = imageSize;
  const setImageSize = useCallback((v) => {
    setImageSizeState(v);
    try { localStorage.setItem(IMAGE_SIZE_KEY, v); } catch { /* no-op */ }
  }, []);
  const [imageBatch, setImageBatchState] = useState(readImageBatch);
  const imageBatchRef = useRef(imageBatch);
  imageBatchRef.current = imageBatch;
  const patchImageBatch = useCallback((patch) => {
    const next = normalizeBatch({ ...imageBatchRef.current, ...patch });
    setImageBatchState(next);
    try { localStorage.setItem(IMAGE_BATCH_KEY, JSON.stringify(next)); } catch { /* no-op */ }
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

  const openPlanim = useCallback((field) => {
    const found = findAt(field, findPlanimAtCursor);
    setPlanimTarget(found
      ? { field, spec: found.spec, format: found.format, range: [found.start, found.end] }
      : { field });
  }, [findAt]);

  // Картинка: файл — в «Библиотеке» (pb-files), в поле — ![подпись](ссылка).
  // Курсор в строке таблицы — картинки встают в ячейку; несколько сразу —
  // друг под другом или галереей в ряд (imagesSnippetAt).
  const openImage = useCallback((field) => setImageTarget(field), []);

  /** images: [{ url, title }] в порядке вставки. */
  const insertImages = useCallback((field, images) => {
    if (!field || !images?.length) return;
    const cur = form.getFieldValue(field) || '';
    insertSnippet(field, imagesSnippetAt(cur, fieldCaret(field)?.start, images, {
      size: imageSizeRef.current, ...imageBatchRef.current,
    }));
  }, [form, fieldCaret, insertSnippet]);

  // Скриншот из буфера (Ctrl+V) или файлы, брошенные на поле: грузим в
  // Библиотеку и вставляем ссылки одним блоком. Хранилище не подключено —
  // открываем пикер: в нём форма входа, после входа картинки можно выбрать
  // или загрузить там же.
  const uploadImages = useCallback(async (field, files) => {
    if (!field || !files?.length) return;
    if (!materialsApi.isConnected()) {
      message.info('Картинки хранятся в «Библиотеке» — войдите в неё и вставьте картинку ещё раз');
      setImageTarget(field);
      return;
    }
    const many = files.length > 1;
    const key = `image-upload-${field}`;
    const progress = (n) => message.loading({
      content: many ? `Загружаю картинки в Библиотеку… ${n} из ${files.length}` : 'Загружаю картинку в Библиотеку…',
      key, duration: 0,
    });
    const done = [];
    let failure = null;
    progress(0);
    for (const file of files) {
      const base = String(file.name || '').replace(/\.[^.]+$/, '');
      // У скриншота из буфера имя безликое («image») — подписываем датой.
      const title = !base || /^image$/i.test(base)
        ? `Картинка ${new Date().toLocaleString('ru-RU')}`
        : base;
      try {
        const rec = await materialsApi.uploadMaterial({ file, title, category: 'other' });
        done.push({ url: materialsApi.fileUrl(rec), title });
        progress(done.length);
      } catch (e) {
        failure = e;
        break;
      }
    }
    // Успевшие загрузиться вставляем и при сбое: они уже лежат в Библиотеке.
    insertImages(field, done);
    if (!failure) {
      message.success({
        content: many ? `Картинки загружены в Библиотеку и вставлены: ${done.length}` : 'Картинка загружена в Библиотеку и вставлена',
        key,
      });
      return;
    }
    if (failure?.status === 401) {
      materialsApi.disconnect();
      setImageTarget(field);
    }
    message.error({
      content: `Не удалось загрузить картинку${many ? ` (вставлено ${done.length} из ${files.length})` : ''}: ${failure?.message || ''}`,
      key,
    });
  }, [insertImages, message]);

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
            title="Картинки из Библиотеки"
            okText="Вставить"
            onClose={() => setImageTarget(null)}
            onPick={(picked) => insertImages(imageTarget, picked)}
            extra={(records) => (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span>Размер:</span>
                  <Segmented size="small" value={imageSize} onChange={setImageSize} options={IMAGE_SIZE_OPTIONS} />
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    доля ширины: S 30 % · M 50 % · L 70 % · XL 100 %; «Авто» — как решит лист.
                    Поменять потом — буква в {'{M}'} после картинки
                  </Typography.Text>
                </div>
                {records.length > 1 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span>Несколько картинок:</span>
                    <Segmented
                      size="small"
                      value={imageBatch.layout}
                      onChange={(layout) => patchImageBatch({ layout })}
                      options={BATCH_LAYOUT_OPTIONS}
                    />
                    {imageBatch.layout === 'row' && (
                      <Select
                        size="small"
                        value={imageBatch.perRow}
                        onChange={(perRow) => patchImageBatch({ perRow })}
                        options={BATCH_PER_ROW_OPTIONS}
                        style={{ width: 78 }}
                      />
                    )}
                    <Select
                      size="small"
                      value={imageBatch.labels}
                      onChange={(labels) => patchImageBatch({ labels })}
                      options={BATCH_LABEL_OPTIONS}
                      style={{ width: 130 }}
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      порядок — как отмечали (№ в списке)
                      {imageBatch.layout === 'row' ? '; в ряду размер задаёт ячейка' : ''}
                    </Typography.Text>
                  </div>
                ) : (
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Можно отметить несколько картинок — вставятся разом: друг под другом или в ряд
                  </Typography.Text>
                )}
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
            onApply={({
              scene, camera, color, size, format, still,
            }) => {
              applyTarget(stereoTarget, stereoBlockMarkdown(scene, camera, {
                color, size, format, still,
              }));
              setStereoTarget(null);
            }}
          />
        </Suspense>
      )}
      {planimTarget && (
        <Suspense fallback={null}>
          <PlanimModal
            open
            initialSpec={planimTarget.spec || null}
            defaultFormat={planimTarget.format || 'block'}
            onClose={() => setPlanimTarget(null)}
            onApply={({ scene, color, grid, size, format }) => {
              applyTarget(planimTarget, planimBlockMarkdown(scene, { color, grid, size, format }));
              setPlanimTarget(null);
            }}
          />
        </Suspense>
      )}
    </>
  );

  return {
    onCaret, fieldCaret, insertSnippet, replaceRange,
    openNumline, openPlot, openGrid, openStereo, openPlanim, openImage, onImageFiles, tableMenu, fixRootsIn,
    modals,
  };
}
