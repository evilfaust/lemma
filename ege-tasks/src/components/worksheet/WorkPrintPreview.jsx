import { useEffect, useMemo, useState } from 'react';
import { Button, Space, Tooltip, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined, TableOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { printPaged } from '../../utils/printPage';
import { rewriteImageUrls } from '../TaskStatementRenderer';
import PrintSheet from '../print-sheet/PrintSheet';
import AppearanceSection from './oral-generator/AppearanceSection';

const { Text } = Typography;

// Оформление учитель выбирает один раз — живёт в браузере. Тексты шапки
// (заголовок, подзаголовок, класс) — свои у каждой работы и сюда не пишутся.
const LS_KEY = 'workPrint.v2';
const PER_WORK_META = ['title', 'subtitle', 'classLabel'];

// Умолчания хранят лицо прежнего режима печати работы: компактная шапка с
// ФИО и датой, «N задач на лист» (остаток высоты листа делится между задачами
// под решение), чистое место без рамки и клетки, без строки «Ответ», ключ
// ответов учителю последней страницей.
export const WORK_PRINT_DEFAULTS = {
  headerMode: 'compact',
  columns: 1,
  margins: 'narrow',
  pageFormat: 'a4',
  figureSize: 'm',
  showFigures: true,
  figurePlacement: 'below',
  fontScale: 1,
  fontFamily: 'sans',
  italic: false,
  answerStyle: 'none',
  solutionSpace: 'fit',
  solutionFill: 'blank',
  solutionFrame: false,
  tasksPerPage: 4,
  showFooter: true,
  showTaskCode: false,
  hideTaskPrefixes: false,
  showStudentInfo: true,
  showAnswersInline: false,
  showAnswersPage: true,
  variantLabel: 'Вариант',
  showVariantLabel: null, // null — авто: «Вариант N» при нескольких вариантах
  meta: {
    eyebrow: '',
    duration: null,
    dateLabel: '',
    instruction: '',
    notesTitle: 'Дополнительная информация',
    notes: '',
    footerNote: '',
    showClassField: true,
    showTasksCount: true,
  },
};

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return WORK_PRINT_DEFAULTS;
    return {
      ...WORK_PRINT_DEFAULTS, ...raw, meta: { ...WORK_PRINT_DEFAULTS.meta, ...(raw.meta || {}) },
    };
  } catch {
    return WORK_PRINT_DEFAULTS;
  }
}

function saveSettings(cfg) {
  try {
    const meta = { ...cfg.meta };
    PER_WORK_META.forEach((k) => delete meta[k]);
    localStorage.setItem(LS_KEY, JSON.stringify({ ...cfg, meta }));
  } catch { /* приватное окно — оформление просто не запомнится */ }
}

// Картинка «Решу» вшита в условие внешней ссылкой, а sdamgia за DDoS-guard
// браузеру её не отдаёт — подменяем на свои файлы task_images (как в составе
// работы). Запрашиваем только для задач, где такая ссылка есть.
const EXTERNAL_IMAGE = /!\[[^\]]*\]\(\s*https?:/i;

function useLocalStatementImages(variants) {
  const ids = useMemo(() => {
    const set = new Set();
    variants.forEach((v) => (v.tasks || []).forEach((t) => {
      if (t?.id && EXTERNAL_IMAGE.test(t.statement_md || '')) set.add(t.id);
    }));
    return [...set].sort();
  }, [variants]);
  const key = ids.join(',');
  const [byTask, setByTask] = useState(() => new Map());

  useEffect(() => {
    if (!ids.length) return undefined;
    let alive = true;
    api.getShownTaskImages(ids).then((list) => {
      if (!alive) return;
      const map = new Map();
      list.forEach((r) => map.set(r.task, [...(map.get(r.task) || []), r]));
      setByTask(map);
    }).catch(() => {});
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return byTask;
}

/**
 * Печать сохранённой работы из редактора — лист Генератора (движок
 * print-sheet) с той же панелью «Оформление»: пагинация по реальной высоте,
 * чертежи ```planim / ```stereo строятся под место на бумаге, ```plot,
 * ```numline, ```chart, поле в клетку, галереи — как в Генераторе.
 *
 * Своё у этого режима: «N задач на лист» с чистым местом для решения по
 * умолчанию, рамка решения и курсив — по выбору, переход в «Рабочий лист»
 * (клетка), правка и замена задачи прямо с листа. Размер и место чертежа,
 * выбранные на листе у отдельной задачи, уходят в работу (`variants.order`)
 * и сохраняются вместе с ней.
 *
 * @param {object} work — работа (нужен title)
 * @param {Array} variants — [{ number, tasks }]
 * @param {Function} onClose
 * @param {Function} [onOpenWorksheet] — «Рабочий лист» в клетку
 * @param {Function} [onEditTask] — (task) => void
 * @param {Function} [onReplaceTask] — (variantIndex, taskIndex, task) => void
 * @param {Function} [onSetTaskOption] — (variantIndex, taskIndex, key, value) => void
 */
export default function WorkPrintPreview({
  work, variants = [], onClose, onOpenWorksheet, onEditTask, onReplaceTask, onSetTaskOption,
}) {
  const workTitle = work?.title || 'Контрольная работа';
  const [cfg, setCfg] = useState(() => {
    const saved = loadSettings();
    return { ...saved, meta: { ...saved.meta, title: workTitle, subtitle: '', classLabel: '' } };
  });

  const patch = (p) => setCfg((prev) => {
    const next = { ...prev, ...(typeof p === 'function' ? p(prev) : p) };
    saveSettings(next);
    return next;
  });
  const setter = (key) => (value) => patch({ [key]: value });
  const patchMeta = (p) => patch((prev) => ({ meta: { ...prev.meta, ...p } }));

  // Те же связки, что в Генераторе: «N на лист» живёт только в одной колонке,
  // а половина листа — только с компактной шапкой.
  const setColumns = (value) => patch({
    columns: value,
    ...(value > 1 && cfg.solutionSpace === 'fit' ? { solutionSpace: 'none' } : {}),
  });
  const setPageFormat = (value) => patch({
    pageFormat: value,
    ...(value === 'half' && cfg.headerMode === 'full' ? { headerMode: 'compact' } : {}),
  });

  const imagesByTask = useLocalStatementImages(variants);
  const sheetVariants = useMemo(() => variants.map((v, vi) => ({
    number: v.number || vi + 1,
    tasks: (v.tasks || []).map((t) => {
      const images = imagesByTask.get(t.id);
      return images ? { ...t, statement_md: rewriteImageUrls(t.statement_md, images) } : t;
    }),
  })), [variants, imagesByTask]);

  const tasksCount = Math.max(0, ...variants.map((v) => v.tasks?.length || 0));
  const empty = !variants.some((v) => v.tasks?.length);

  return (
    <div className="work-print">
      <div className="no-print">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 }}>
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={onClose}>Назад к редактору</Button>
            {onOpenWorksheet && (
              <Tooltip title="Печать рабочего листа в клетку — поля для решения от руки">
                <Button icon={<TableOutlined />} onClick={onOpenWorksheet}>Рабочий лист</Button>
              </Tooltip>
            )}
            <Text type="secondary">
              {variants.length > 1 ? `Вариантов: ${variants.length} · ` : ''}задач в варианте: {tasksCount}
            </Text>
          </Space>
          <Space wrap>
            <Text type="secondary" style={{ fontSize: 12 }}>PDF — через «Печать» → «Сохранить как PDF»</Text>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              disabled={empty}
              // Поля задаёт сам лист (padding .ps-page), поэтому @page нулевой.
              onClick={() => printPaged({ size: 'A4 portrait', margin: '0' })}
            >
              Печать
            </Button>
          </Space>
        </div>

        <AppearanceSection
          outputMode="sheet"
          defaultOpen
          allowCryptogram={false}
          columns={cfg.columns}
          setColumns={setColumns}
          margins={cfg.margins}
          setMargins={setter('margins')}
          pageFormat={cfg.pageFormat}
          setPageFormat={setPageFormat}
          figureSize={cfg.figureSize}
          setFigureSize={setter('figureSize')}
          showFigures={cfg.showFigures}
          setShowFigures={setter('showFigures')}
          figurePlacement={cfg.figurePlacement}
          setFigurePlacement={setter('figurePlacement')}
          headerMode={cfg.headerMode}
          setHeaderMode={setter('headerMode')}
          sheetMeta={cfg.meta}
          patchSheetMeta={patchMeta}
          answerStyle={cfg.answerStyle}
          setAnswerStyle={setter('answerStyle')}
          solutionSpace={cfg.solutionSpace}
          setSolutionSpace={setter('solutionSpace')}
          solutionFill={cfg.solutionFill}
          setSolutionFill={setter('solutionFill')}
          solutionFrame={cfg.solutionFrame}
          setSolutionFrame={setter('solutionFrame')}
          tasksPerPage={cfg.tasksPerPage}
          setTasksPerPage={setter('tasksPerPage')}
          fontScale={cfg.fontScale}
          setFontScale={setter('fontScale')}
          fontFamily={cfg.fontFamily}
          setFontFamily={setter('fontFamily')}
          italic={cfg.italic}
          setItalic={setter('italic')}
          showFooter={cfg.showFooter}
          setShowFooter={setter('showFooter')}
          showTaskCode={cfg.showTaskCode}
          setShowTaskCode={setter('showTaskCode')}
          hideTaskPrefixes={cfg.hideTaskPrefixes}
          setHideTaskPrefixes={setter('hideTaskPrefixes')}
          showStudentInfo={cfg.showStudentInfo}
          setShowStudentInfo={setter('showStudentInfo')}
          showAnswersInline={cfg.showAnswersInline}
          setShowAnswersInline={setter('showAnswersInline')}
          showAnswersPage={cfg.showAnswersPage}
          setShowAnswersPage={setter('showAnswersPage')}
          variantLabel={cfg.variantLabel}
          setVariantLabel={setter('variantLabel')}
          showVariantLabel={cfg.showVariantLabel}
          setShowVariantLabel={setter('showVariantLabel')}
          variantsCount={variants.length}
          tasksCount={tasksCount}
        />
      </div>

      {empty ? (
        <Text type="secondary">В работе нет задач для печати.</Text>
      ) : (
        <PrintSheet
          variants={sheetVariants}
          variantLabel={cfg.variantLabel || 'Вариант'}
          headerMode={cfg.headerMode}
          layout="workbook"
          columns={cfg.columns}
          margins={cfg.margins}
          pageFormat={cfg.pageFormat}
          showAnswersPage={cfg.showAnswersPage}
          meta={{
            ...cfg.meta,
            title: cfg.meta.title || workTitle,
            showStudentFields: cfg.showStudentInfo,
            showVariant: cfg.showVariantLabel,
          }}
          options={{
            answerStyle: cfg.answerStyle,
            solutionSpace: cfg.solutionSpace,
            solutionFill: cfg.solutionFill,
            solutionFrame: cfg.solutionFrame,
            tasksPerPage: cfg.tasksPerPage,
            hideTaskPrefixes: cfg.hideTaskPrefixes,
            showTaskCode: cfg.showTaskCode,
            showAnswersInline: cfg.showAnswersInline,
            fontScale: cfg.fontScale,
            fontFamily: cfg.fontFamily,
            italic: cfg.italic,
            showFooter: cfg.showFooter,
            figureSize: cfg.figureSize,
            showFigures: cfg.showFigures,
            figurePlacement: cfg.figurePlacement,
          }}
          editing={{
            // Правят исходную задачу работы, а не копию с подменёнными картинками.
            onEditTask: onEditTask
              ? (t) => { const full = variants.flatMap((v) => v.tasks || []).find((x) => x.id === t.id); if (full) onEditTask(full); }
              : undefined,
            onReplaceTask: onReplaceTask
              ? (vi, ti) => { const full = variants[vi]?.tasks?.[ti]; if (full) onReplaceTask(vi, ti, full); }
              : undefined,
            onSetFigureSize: onSetTaskOption ? (vi, ti, v) => onSetTaskOption(vi, ti, 'kimImageSize', v) : undefined,
            onSetFigurePlacement: onSetTaskOption ? (vi, ti, v) => onSetTaskOption(vi, ti, 'figurePlacement', v) : undefined,
          }}
        />
      )}
    </div>
  );
}
