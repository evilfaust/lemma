import { useMemo, useState } from 'react';
import {
  Button, Segmented, Checkbox, InputNumber, Switch, Alert, Modal, Collapse, Tooltip, message,
} from 'antd';
import {
  PrinterOutlined, AppstoreOutlined, EditOutlined, StarOutlined, ReloadOutlined,
  BorderOutlined, ThunderboltOutlined, BulbOutlined,
} from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { useNonogram } from '../../hooks/useNonogram';
import { useSheetStorage } from '../../hooks/useSheetStorage';
import { printPaged } from '../../utils/printPage';
import { resolveOrientation } from '../../utils/nonogram/layout';
import { SIZE_PRESETS, MIN_SIZE, MAX_SIZE } from '../../utils/nonogram/sheet';
import { DIFFICULTY_LABELS } from '../../utils/nonogram/solver';
import { CLUE_SECTIONS, catKey, sectionCategories } from '../../utils/nonogram/clueTasks';
import { ORAL_LEVELS } from '../../utils/oral/levels';
import {
  TrigGeneratorLayout, TrigSettingsSection, TrigActions, TrigStatBadge,
} from '../trig/TrigGeneratorLayout';
import { SheetStorageActions } from '../trig/SheetStorageActions';
import TeamImageUploader from '../pixel-art-team/TeamImageUploader';
import MatrixEditor from '../pixel-art/MatrixEditor';
import PixelArtImageLibraryModal from '../pixel-art/PixelArtImageLibraryModal';
import NonogramPicture from './NonogramPicture';
import NonogramPrintLayout, { nonogramOverflow } from './NonogramPrintLayout';

const GENERATOR = 'nonogram';

const STATUS_TEXT = {
  unique: 'Решается логикой однозначно',
  stuck: 'Логикой не решается до конца',
  contradiction: 'Подсказки противоречат друг другу',
};

/** Пункт Collapse раздела примеров: общий чекбокс + типы. */
function sectionItem({ section, categories, onChange }) {
  const keys = Object.keys(section.labels).map(c => catKey(section.key, c));
  const on = keys.filter(k => categories[k]).length;
  const setAll = (value) => onChange({ ...categories, ...sectionCategories(section.key, value) });
  return {
    key: section.key,
    label: (
      <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <Checkbox
          checked={on === keys.length}
          indeterminate={on > 0 && on < keys.length}
          onChange={e => setAll(e.target.checked)}
        />
        <span style={{ fontSize: 13 }}>{section.label}</span>
        {on > 0 && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{on}/{keys.length}</span>}
      </span>
    ),
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {Object.entries(section.labels).map(([cat, label]) => {
          const k = catKey(section.key, cat);
          return (
            <Checkbox
              key={k}
              checked={Boolean(categories[k])}
              onChange={e => onChange({ ...categories, [k]: e.target.checked })}
            >
              <span style={{ fontSize: 12 }}>{label}</span>
            </Checkbox>
          );
        })}
      </div>
    ),
  };
}

/**
 * Японский кроссворд (нонограмма): подсказки у строк и столбцов — примеры
 * устного счёта, ответ примера — число подсказки. План и решения —
 * `NONOGRAM_PLAN.md`; логика — `utils/nonogram/`.
 */
export default function NonogramGenerator() {
  const ng = useNonogram();
  const {
    title, setTitle, settings, updateSetting,
    matrix, setPicture, toggleCell, clearMatrix, fillMatrix, invertMatrix, blankPicture,
    givens, toggleGiven, autoGivens, completeGivens, fixPicture, flipped,
    analysis, variants, stats, stale, regenerate, tasksData, applySheet, reset,
  } = ng;

  const [imageFile, setImageFile] = useState(null);
  const [view, setView] = useState('picture');
  const [editorOpen, setEditorOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryImages, setLibraryImages] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);

  const storage = useSheetStorage({
    generator: GENERATOR,
    title,
    settings,
    tasksData,
    layout: [],
    onLoad: (payload) => { setImageFile(null); applySheet(payload); },
  });

  const R = matrix?.length ?? 0;
  const C = matrix?.[0]?.length ?? 0;
  const orientation = resolveOrientation(settings.orientation, C || settings.cols);
  const overflow = useMemo(
    () => nonogramOverflow(matrix, variants, settings),
    [matrix, variants, settings],
  );
  const ready = Boolean(matrix && variants.length && !stale);

  // ── Картинка ────────────────────────────────────────────────────────────────
  const setSize = (cols, rows) => {
    updateSetting('cols', cols);
    updateSetting('rows', rows);
    // Картинка без файла (библиотека, рисунок) сама не пересчитается
    if (!imageFile && matrix) {
      message.info('Размер применится к новой картинке: загрузите изображение или начните рисунок заново');
    }
  };

  const openLibrary = async () => {
    setLibraryOpen(true);
    setLibraryLoading(true);
    try {
      setLibraryImages(await api.getPixelArtImages());
    } catch {
      message.error('Ошибка загрузки библиотеки');
    } finally {
      setLibraryLoading(false);
    }
  };

  const pickFromLibrary = (record) => {
    setImageFile(null);
    setPicture(record.matrix);
    updateSetting('cols', record.matrix?.[0]?.length || settings.cols);
    updateSetting('rows', record.matrix?.length || settings.rows);
    setLibraryOpen(false);
    message.success(`Картинка «${record.title || 'Без названия'}» применена`);
  };

  const deleteFromLibrary = async (id) => {
    try {
      await api.deletePixelArtImage(id);
      setLibraryImages(prev => prev.filter(img => img.id !== id));
    } catch {
      message.error('Ошибка удаления');
    }
  };

  const renameInLibrary = async (id, newTitle) => {
    try {
      const updated = await api.updatePixelArtImage(id, { title: newTitle });
      setLibraryImages(prev => prev.map(img => (img.id === id ? { ...img, title: updated.title } : img)));
    } catch {
      message.error('Ошибка переименования');
    }
  };

  const saveToLibrary = async () => {
    if (!matrix) return;
    setSavingToLibrary(true);
    try {
      await api.createPixelArtImage({
        title: title || 'Японский кроссворд',
        matrix,
        grid_cols: C,
        grid_rows: R,
        threshold: settings.threshold,
      });
      message.success('Картинка сохранена в библиотеку (общая с пиксель-артом)');
    } catch (e) {
      message.error('Ошибка сохранения: ' + (e.message || e));
    } finally {
      setSavingToLibrary(false);
    }
  };

  const openEditor = () => {
    if (!matrix) blankPicture();
    setEditorOpen(true);
  };

  const handleFix = () => {
    const res = fixPicture();
    if (!res) return;
    if (res.result.status === 'unique') {
      message.success(`Картинка подправлена: изменено клеток — ${res.flips.length}`);
    } else {
      message.warning('Подправить не вышло — остаются готовые клетки');
    }
  };

  const handlePrint = () => {
    if (!ready) {
      message.warning('Сначала загрузите картинку');
      return;
    }
    if (overflow || document.querySelector('.nng-print-root [data-overflow="true"]')) {
      message.warning('Лист не помещается: выберите один кроссворд на странице, другую ориентацию или меньшую сетку');
      return;
    }
    printPaged({ size: `A4 ${orientation}` });
  };

  // ── Сводка решателя ─────────────────────────────────────────────────────────
  const result = analysis?.result;
  const givensBlack = givens.filter(g => g.v === 1).length;
  const givensDot = givens.length - givensBlack;

  return (
    <>
      <div className="no-print">
        <TrigGeneratorLayout
          icon={<BorderOutlined style={{ fontSize: 14 }} />}
          title={title}
          onTitleChange={setTitle}
          titlePlaceholder="Название листа"
          leftWidth={380}
          left={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <TrigSettingsSection label="Картинка">
                <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                  <Button size="small" icon={<AppstoreOutlined />} onClick={openLibrary}>Библиотека</Button>
                  <Button size="small" icon={<EditOutlined />} onClick={openEditor}>
                    {matrix ? 'Редактор пикселей' : 'Нарисовать'}
                  </Button>
                  {matrix && (
                    <Button size="small" icon={<StarOutlined />} loading={savingToLibrary} onClick={saveToLibrary}>
                      В библиотеку
                    </Button>
                  )}
                </div>
                <TeamImageUploader
                  imageFile={imageFile}
                  gridCols={settings.cols}
                  gridRows={settings.rows}
                  threshold={settings.threshold}
                  onImageChange={setImageFile}
                  onMatrixChange={setPicture}
                  onThresholdChange={v => updateSetting('threshold', v)}
                />
              </TrigSettingsSection>

              <TrigSettingsSection label="Размер сетки">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Segmented
                    size="small"
                    value={settings.cols === settings.rows && SIZE_PRESETS.includes(settings.cols) ? settings.cols : 'custom'}
                    onChange={v => { if (v !== 'custom') setSize(v, v); }}
                    options={[
                      ...SIZE_PRESETS.map(n => ({ value: n, label: `${n}×${n}` })),
                      { value: 'custom', label: 'Свой', disabled: true },
                    ]}
                  />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <InputNumber
                      size="small" min={MIN_SIZE} max={MAX_SIZE} value={settings.cols}
                      onChange={v => v && setSize(v, settings.rows)} style={{ width: 56 }}
                      aria-label="Столбцов"
                    />
                    ×
                    <InputNumber
                      size="small" min={MIN_SIZE} max={MAX_SIZE} value={settings.rows}
                      onChange={v => v && setSize(settings.cols, v)} style={{ width: 56 }}
                      aria-label="Строк"
                    />
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
                  5×5 — знакомство, 10×10 — на урок, 15×15 — домашнее задание.
                </div>
              </TrigSettingsSection>

              <TrigSettingsSection label="Примеры">
                <Segmented
                  block
                  size="small"
                  value={settings.level}
                  onChange={v => updateSetting('level', v)}
                  options={ORAL_LEVELS.map(l => ({
                    value: l.value,
                    label: <Tooltip title={l.hint}><span>{l.label}</span></Tooltip>,
                  }))}
                />
                <Collapse
                  size="small"
                  ghost
                  style={{ marginTop: 8 }}
                  defaultActiveKey={['int']}
                  items={CLUE_SECTIONS.map(section => sectionItem({
                    section,
                    categories: settings.categories,
                    onChange: v => updateSetting('categories', v),
                  }))}
                />
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                  Ответ примера — число подсказки (1–15). Чего не нашлось в выбранных
                  разделах, добирается «Целыми числами».
                </div>
              </TrigSettingsSection>

              <TrigSettingsSection label="Лист">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    Примеры — {orientation === 'landscape' ? 'справа от сетки' : 'под сеткой'}.
                    {' '}Строки — по номерам, столбцы — по буквам. Ответы вписываются у поля.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, flex: 1 }}>Вариантов</span>
                    <InputNumber
                      size="small" min={1} max={6} value={settings.variantsCount}
                      onChange={v => v && updateSetting('variantsCount', v)} style={{ width: 56 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, flex: 1 }}>Лист</span>
                    <Segmented
                      size="small"
                      value={settings.orientation}
                      onChange={v => updateSetting('orientation', v)}
                      options={[
                        { value: 'auto', label: 'Авто' },
                        { value: 'portrait', label: 'Книжный' },
                        { value: 'landscape', label: 'Альбомный' },
                      ]}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tooltip title="Два одинаковых кроссворда на листе с линией отреза — для маленьких сеток">
                      <span style={{ fontSize: 12, flex: 1 }}>На листе</span>
                    </Tooltip>
                    <Segmented
                      size="small"
                      value={settings.perPage}
                      onChange={v => updateSetting('perPage', v)}
                      options={[{ value: 1, label: 'Один' }, { value: 2, label: 'Два' }]}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <Switch size="small" checked={settings.showInstruction} onChange={v => updateSetting('showInstruction', v)} />
                    Инструкция «как решать»
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <Switch size="small" checked={settings.showChecksum} onChange={v => updateSetting('showChecksum', v)} />
                    Строка «Проверьте себя» (сумма ответов)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <Switch size="small" checked={settings.showKey} onChange={v => updateSetting('showKey', v)} />
                    Ключ учителя последней страницей
                  </label>
                </div>
              </TrigSettingsSection>

              <TrigActions>
                <Button type="primary" block icon={<PrinterOutlined />} onClick={handlePrint} disabled={!ready}>
                  Печать
                </Button>
                <Button block icon={<ReloadOutlined />} onClick={regenerate} disabled={!matrix}>
                  Другие примеры
                </Button>
                <SheetStorageActions
                  storage={storage}
                  hasData={Boolean(tasksData)}
                  generator={GENERATOR}
                  exportMd={false}
                />
                <Button block onClick={() => { setImageFile(null); reset(); }}>Сбросить</Button>
              </TrigActions>
            </div>
          }
          right={
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, marginBottom: 12, flexWrap: 'wrap',
              }}>
                <Segmented
                  options={[
                    { value: 'picture', label: 'Картинка' },
                    { value: 'sheet', label: 'Лист' },
                  ]}
                  value={view}
                  onChange={setView}
                />
                {analysis && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <TrigStatBadge tone="accent">{C}×{R}</TrigStatBadge>
                    <TrigStatBadge>{analysis.clueCount} прим.</TrigStatBadge>
                    {analysis.difficulty && (
                      <TrigStatBadge tone="success">{DIFFICULTY_LABELS[analysis.difficulty]}</TrigStatBadge>
                    )}
                    {givens.length > 0 && <TrigStatBadge>готовых: {givens.length}</TrigStatBadge>}
                    {variants.length > 0 && <TrigStatBadge>{variants.length} вар.</TrigStatBadge>}
                  </div>
                )}
              </div>

              {!matrix && (
                <Alert
                  type="info"
                  showIcon
                  icon={<BulbOutlined />}
                  message="Загрузите картинку, выберите из библиотеки или нарисуйте"
                  description={
                    'Подсказки строк и столбцов станут примерами устного счёта: ответ примера — '
                    + 'сколько клеток подряд закрасить. Простые силуэты (животное, предмет, буква) '
                    + 'решаются лучше всего.'
                  }
                />
              )}

              {matrix && view === 'picture' && (
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  <Alert
                    type={result?.status === 'unique' ? 'success' : result?.status === 'stuck' ? 'warning' : 'error'}
                    showIcon
                    style={{ marginBottom: 10 }}
                    message={STATUS_TEXT[result?.status] || '—'}
                    description={
                      <div style={{ fontSize: 12 }}>
                        {result?.status === 'unique' && (givens.length > 0
                          ? `С готовыми клетками: ${givensBlack} закрашенных${givensDot ? `, ${givensDot} с точкой` : ''}. Клик по клетке — поставить или снять.`
                          : 'Готовые клетки не нужны. Клик по клетке — поставить готовую клетку.')}
                        {result?.status === 'stuck' && 'Подсвеченные клетки логикой не выводятся — добавьте готовые клетки или подправьте картинку.'}
                        {flipped > 0 && ` Картинка подправлена: изменено клеток — ${flipped}.`}
                      </div>
                    }
                  />
                  <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                    <Button size="small" icon={<ThunderboltOutlined />} onClick={autoGivens}>
                      Подобрать готовые клетки
                    </Button>
                    {result?.status === 'stuck' && (
                      <Button size="small" onClick={completeGivens}>Дополнить мои</Button>
                    )}
                    {(result?.status === 'stuck' || givens.length > 0) && (
                      <Tooltip title="Переключить несколько пикселей, чтобы рисунок решался без готовых клеток">
                        <Button size="small" onClick={handleFix}>Подправить картинку</Button>
                      </Tooltip>
                    )}
                  </div>
                  <NonogramPicture
                    matrix={matrix}
                    givens={givens}
                    result={result}
                    onToggleGiven={toggleGiven}
                  />
                </div>
              )}

              {matrix && view === 'sheet' && (
                <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                  {overflow && (
                    <Alert
                      type="warning" showIcon style={{ marginBottom: 10 }}
                      message="Поле не помещается на лист"
                      description="Выберите один кроссворд на странице, другую ориентацию или меньшую сетку."
                    />
                  )}
                  {stats?.fallback > 0 && (
                    <Alert
                      type="info" showIcon style={{ marginBottom: 10 }}
                      message={`Добрано «Целыми числами»: ${stats.fallback} из ${stats.total}`}
                      description="В выбранных разделах не нашлось примеров с таким ответом или подходящей длины."
                    />
                  )}
                  {ready ? (
                    <NonogramPrintLayout
                      title={title}
                      settings={settings}
                      matrix={matrix}
                      givens={givens}
                      variants={variants}
                      screenMode
                    />
                  ) : (
                    <div style={{ padding: 24, color: 'var(--ink-3)' }}>Собираю примеры…</div>
                  )}
                </div>
              )}
            </div>
          }
        />
      </div>

      {ready && (
        <NonogramPrintLayout
          title={title}
          settings={settings}
          matrix={matrix}
          givens={givens}
          variants={variants}
        />
      )}

      <Modal
        title="Редактор пикселей"
        open={editorOpen}
        onCancel={() => setEditorOpen(false)}
        footer={<Button type="primary" onClick={() => setEditorOpen(false)}>Готово</Button>}
        width="min(96vw, 1100px)"
        destroyOnClose
      >
        {matrix && (
          <MatrixEditor
            matrix={matrix}
            onToggleCell={toggleCell}
            onClear={clearMatrix}
            onFill={fillMatrix}
            onInvert={invertMatrix}
            availWidth={typeof window !== 'undefined' ? Math.min(window.innerWidth - 48, 1050) : 800}
            availHeight={typeof window !== 'undefined' ? window.innerHeight - 240 : 600}
          />
        )}
      </Modal>

      <PixelArtImageLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        images={libraryImages}
        loading={libraryLoading}
        onSelect={pickFromLibrary}
        onDelete={deleteFromLibrary}
        onRename={renameInLibrary}
      />
    </>
  );
}
