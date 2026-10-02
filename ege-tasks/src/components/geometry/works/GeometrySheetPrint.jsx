import { useMemo, useState } from 'react';
import { Button, Space, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { api } from '../../../shared/services/pocketbase';
import { geometrySheetTask } from '../../../utils/geometrySheet';
import { printPaged } from '../../../utils/printPage';
import PrintSheet from '../../print-sheet/PrintSheet';
import AppearanceSection from '../../worksheet/oral-generator/AppearanceSection';

const { Text } = Typography;

// Задача листа по записи задачи: запись из byId редактора стабильна до
// перечитывания, а SVG без кэша санитайзился бы на каждый ре-рендер.
const sheetTaskCache = new WeakMap();
const toSheetTask = (t) => {
  let r = sheetTaskCache.get(t);
  if (!r) {
    r = geometrySheetTask(t, (x) => api.getGeometryImageUrl(x));
    sheetTaskCache.set(t, r);
  }
  return r;
};

// Оформление учитель выбирает один раз — живёт в браузере. Тексты шапки
// (заголовок, подзаголовок, класс) — свои у каждой работы и сюда не пишутся.
const LS_KEY = 'geometry.sheetPrint.v1';
const PER_WORK_META = ['title', 'subtitle', 'classLabel'];

// Умолчания — под геометрию: чертёж справа от условия, под задачей клетка,
// на A4 по две задачи (остаток высоты делится между ними).
const DEFAULTS = {
  headerMode: 'compact',
  columns: 1,
  margins: 'narrow',
  pageFormat: 'a4',
  figureSize: 'm',
  showFigures: true,
  figurePlacement: 'right',
  fontScale: 1,
  fontFamily: 'sans',
  answerStyle: 'line',
  solutionSpace: 'fit',
  solutionFill: 'grid',
  tasksPerPage: 2,
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
    if (!raw || typeof raw !== 'object') return DEFAULTS;
    return { ...DEFAULTS, ...raw, meta: { ...DEFAULTS.meta, ...(raw.meta || {}) } };
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(cfg) {
  try {
    const meta = { ...cfg.meta };
    PER_WORK_META.forEach((k) => delete meta[k]);
    localStorage.setItem(LS_KEY, JSON.stringify({ ...cfg, meta }));
  } catch { /* приватное окно — оформление просто не запомнится */ }
}

/**
 * Печать геометрической работы листом Генератора (движок print-sheet):
 * та же панель «Оформление» — формат A4 / два на листе, поля, колонки,
 * шапка, поле ответа, место для решения с клеткой или линейкой, чертёж
 * сбоку с обтеканием, ключ ответов.
 *
 * @param {Array} variants — [{ number, tasks: [geometry_tasks] }]
 * @param {Function} onEditTask — (geometry task) => void, правка с листа
 */
export default function GeometrySheetPrint({
  variants, title = '', classLabel = '', onBack, onEditTask,
}) {
  const [cfg, setCfg] = useState(() => {
    const saved = loadSettings();
    return { ...saved, meta: { ...saved.meta, title, subtitle: '', classLabel } };
  });
  // Размер и место чертежа у отдельной задачи — по id задачи, на этот показ.
  const [perTask, setPerTask] = useState({});

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

  const sheetVariants = useMemo(() => variants.map((v) => ({
    number: v.number,
    tasks: v.tasks.map((t) => ({
      ...toSheetTask(t),
      ...(perTask[t.id] || {}),
    })),
  })), [variants, perTask]);

  const byId = useMemo(() => {
    const m = new Map();
    variants.forEach((v) => v.tasks.forEach((t) => m.set(t.id, t)));
    return m;
  }, [variants]);

  const setTaskOpt = (key) => (vi, ti, value) => {
    const id = sheetVariants[vi]?.tasks[ti]?.id;
    if (id) setPerTask((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [key]: value } }));
  };

  const tasksCount = Math.max(0, ...variants.map((v) => v.tasks.length));
  const empty = !variants.some((v) => v.tasks.length);

  return (
    <div>
      <div className="no-print">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 12 }}>
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
            <Text type="secondary">
              Лист задач · {variants.length > 1 ? `вариантов: ${variants.length} · ` : ''}задач в варианте: {tasksCount}
            </Text>
          </Space>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            disabled={empty}
            // Поля задаёт сам лист (padding .ps-page), поэтому @page нулевой.
            onClick={() => printPaged({ size: 'A4 portrait', margin: '0' })}
          >
            Печать
          </Button>
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
          tasksPerPage={cfg.tasksPerPage}
          setTasksPerPage={setter('tasksPerPage')}
          fontScale={cfg.fontScale}
          setFontScale={setter('fontScale')}
          fontFamily={cfg.fontFamily}
          setFontFamily={setter('fontFamily')}
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

      {!empty && (
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
            title: cfg.meta.title || title || 'Геометрия',
            showStudentFields: cfg.showStudentInfo,
            showVariant: cfg.showVariantLabel,
          }}
          options={{
            answerStyle: cfg.answerStyle,
            solutionSpace: cfg.solutionSpace,
            solutionFill: cfg.solutionFill,
            tasksPerPage: cfg.tasksPerPage,
            hideTaskPrefixes: cfg.hideTaskPrefixes,
            showTaskCode: cfg.showTaskCode,
            showAnswersInline: cfg.showAnswersInline,
            fontScale: cfg.fontScale,
            fontFamily: cfg.fontFamily,
            showFooter: cfg.showFooter,
            figureSize: cfg.figureSize,
            showFigures: cfg.showFigures,
            figurePlacement: cfg.figurePlacement,
          }}
          editing={{
            onEditTask: onEditTask ? (t) => { const full = byId.get(t.id); if (full) onEditTask(full); } : undefined,
            onSetFigureSize: setTaskOpt('kimImageSize'),
            onSetFigurePlacement: setTaskOpt('figurePlacement'),
          }}
        />
      )}
    </div>
  );
}
