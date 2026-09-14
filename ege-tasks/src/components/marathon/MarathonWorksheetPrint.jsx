import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Space, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import MathRenderer from '../../shared/components/MathRenderer';
import MarathonWorksheetSettings from './MarathonWorksheetSettings';
import { printPaged } from '../../utils/printPage';
import {
  DEFAULT_MARATHON_WORKSHEET_SETTINGS, MM_PX, fontMmOf,
  applyMarathonWorksheetMode, contentWidthMm, expandTasks, fillSummary, fitBlock,
  gridLines, layoutBlock, normalizeMarathonWorksheetSettings, paginateBlocks,
  statementWidthMm,
} from '../../utils/marathonWorksheet';
import './MarathonWorksheetPrint.css';

const { Text } = Typography;

const STORAGE_KEY = 'marathon.worksheetSettings';

// Чертёж: ширина блока в % и потолок высоты долей от своей зоны (клетка или
// карточка) — так размер живёт при любой плотности листа.
const DRAWING_CFG = {
  s: { w: '28%', share: 0.38 },
  m: { w: '42%', share: 0.55 },
  l: { w: '58%', share: 0.72 },
  xl: { w: '74%', share: 0.9 },
};

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? normalizeMarathonWorksheetSettings(JSON.parse(raw))
      : { ...DEFAULT_MARATHON_WORKSHEET_SETTINGS };
  } catch {
    return { ...DEFAULT_MARATHON_WORKSHEET_SETTINGS };
  }
}

/* ── Линия разреза ────────────────────────────────────────────────────────── */

function CutLine() {
  return (
    <div className="mwsp-cut-line">
      <div className="mwsp-cut-dash" />
      <span className="mwsp-cut-icon">✂</span>
      <div className="mwsp-cut-dash" />
    </div>
  );
}

/* ── Один блок ────────────────────────────────────────────────────────────── */

function WorksheetBlock({ task, number, settings, geom }) {
  const { mode, attempts, showName, textSize, drawingSize, solutionFill, showTaskCode } = settings;
  const { blockMm, headMm, condMm, solutionMm } = geom;

  const imageUrl = api.getTaskImageUrl(task);
  const dcfg = DRAWING_CFG[drawingSize] ?? DRAWING_CFG.m;
  const fontMm = fontMmOf(textSize);

  const lines = gridLines({
    heightMm: solutionMm,
    widthMm: contentWidthMm(),
    fill: solutionFill,
  });

  const head = headMm > 0 && (
    <div className="mwsp-header" style={{ height: `${headMm}mm` }}>
      {showName ? (
        <div className="mwsp-name-area">
          <span className="mwsp-name-label">ФИ</span>
          <div className="mwsp-name-line" />
        </div>
      ) : <div style={{ flex: 1 }} />}
      {attempts > 0 && (
        <div className="mwsp-attempts">
          {Array.from({ length: attempts }, (_, i) => (
            <div key={i} className="mwsp-attempt-unit">
              <span className="mwsp-attempt-n">{i + 1}</span>
              <div className="mwsp-attempt-box" />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="mwsp-block" style={{ height: `${blockMm}mm` }}>
      {head}

      <div className="mwsp-content" style={{ height: `${condMm}mm` }}>
        <div className="mwsp-task-num">{number}</div>
        <div className="mwsp-task-body">
          <div className="mwsp-task-text" style={{ fontSize: `${fontMm}mm` }}>
            <MathRenderer content={task.statement_md || ''} />
          </div>
          {/* В режиме карточки чертёж живёт в самом условии — клетки нет. */}
          {mode === 'card' && imageUrl && (
            <div
              className="mwsp-card-drawing"
              style={{ maxWidth: dcfg.w, maxHeight: `${condMm * dcfg.share}mm` }}
            >
              <img
                src={imageUrl}
                alt=""
                crossOrigin="anonymous"
                style={{ maxHeight: `${condMm * dcfg.share}mm` }}
              />
            </div>
          )}
          {showTaskCode && task.code && <div className="mwsp-task-code">{task.code}</div>}
        </div>
      </div>

      {/* Место для решения. Линии — div'ы с физическими mm/pt (вектор в PDF), и
          их число посчитано ТОЧНО под высоту: запас ужимает печать. */}
      {solutionMm > 0 && (
        <div className="mwsp-grid" style={{ height: `${solutionMm}mm` }}>
          {solutionFill === 'blank' && <span className="mwsp-grid-label">Решение</span>}
          {imageUrl && (
            <div className="mwsp-grid-drawing" style={{ maxWidth: dcfg.w }}>
              <img
                src={imageUrl}
                alt=""
                crossOrigin="anonymous"
                className="mwsp-grid-drawing-img"
                style={{ maxHeight: `${solutionMm * dcfg.share}mm` }}
              />
            </div>
          )}
          {Array.from({ length: lines.h }, (_, i) => (
            <div key={`h-${i}`} className="mwsp-h-line" style={{ top: `${(i + 1) * lines.step}mm` }} />
          ))}
          {Array.from({ length: lines.v }, (_, i) => (
            <div key={`v-${i}`} className="mwsp-v-line" style={{ left: `${(i + 1) * lines.step}mm` }} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Лист ─────────────────────────────────────────────────────────────────── */

function WorksheetSheet({ slots, settings, geomOf, baseGeom }) {
  const empty = Math.max(0, settings.count - slots.length);
  const cells = [
    ...slots,
    ...Array.from({ length: empty }, (_, i) => ({ task: null, no: 0, key: `empty-${i}` })),
  ];

  return (
    <div className="mwsp-sheet">
      {cells.map((slot, pos) => (
        <div key={slot.key} className="mwsp-slot">
          {pos > 0 && <CutLine />}
          {slot.task ? (
            <WorksheetBlock
              task={slot.task}
              number={slot.no}
              settings={settings}
              geom={geomOf(slot.task.id)}
            />
          ) : (
            <div className="mwsp-block mwsp-block--empty" style={{ height: `${baseGeom.blockMm}mm` }} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Экран ────────────────────────────────────────────────────────────────── */

/**
 * Отрезной лист марафона: лист A4 делится на равные блоки, между блоками —
 * линия разреза, каждый блок достаётся ученику.
 *
 * Оформление — общее с движком `print-sheet` (входная контрольная): монохром,
 * миллиметры, номер задачи квадратом, линии четырёх толщин. Раскладка своя:
 * блоки одинаковой высоты во всю ширину листа, а не поток задач по страницам.
 *
 * Два режима (`settings.mode`):
 *  — `work` — с местом для решения (клетка / линейка / пусто), чертёж поверх
 *    зоны решения; 2–5 блоков на лист;
 *  — `card` — только условие (ученик решает в тетради), чертёж внутри карточки;
 *    3–8 блоков на лист.
 *
 * 🚨 Высоты блока, условия и зоны решения приходят из
 * `utils/marathonWorksheet.js` и ставятся inline: число линий разлиновки должно
 * точно совпадать с высотой зоны, иначе Chrome ужимает печать (~65%).
 */
export default function MarathonWorksheetPrint({ tasks = [], title, onBack, initialMode = null }) {
  // Режим приходит из вкладки («с местом для решения» / «только карточка») —
  // выбор сделан до открытия листа, и пресет применяется сразу, а не после
  // того, как учитель увидит лист в прошлом режиме.
  const [settings, setSettings] = useState(() => {
    const stored = readStored();
    return initialMode && stored.mode !== initialMode
      ? applyMarathonWorksheetMode(stored, initialMode)
      : stored;
  });

  const save = useCallback((next) => {
    setSettings(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* приватный режим */ }
  }, []);

  const patch = useCallback((delta) => {
    save(normalizeMarathonWorksheetSettings({ ...settings, ...delta }));
  }, [settings, save]);

  const onMode = useCallback((mode) => {
    save(applyMarathonWorksheetMode(settings, mode));
  }, [settings, save]);

  const showHeader = settings.showName || settings.attempts > 0;

  const baseGeom = useMemo(() => layoutBlock({
    count: settings.count,
    mode: settings.mode,
    showHeader,
  }), [settings.count, settings.mode, showHeader]);

  // Слоты листа: с добивкой это те же задачи, повторённые подряд, пока пачка
  // не закончится ровно на краю листа.
  const slots = useMemo(
    () => expandTasks(tasks, { fill: settings.fill, copies: settings.copies, count: settings.count }),
    [tasks, settings.fill, settings.copies, settings.count],
  );

  const sheets = useMemo(
    () => paginateBlocks(slots, settings.count),
    [slots, settings.count],
  );

  const summary = useMemo(
    () => fillSummary({
      taskCount: tasks.length,
      count: settings.count,
      fill: settings.fill,
      copies: settings.copies,
    }),
    [tasks.length, settings.count, settings.fill, settings.copies],
  );

  // ── Замер условий ────────────────────────────────────────────────────────
  // Высоту зоны решения (а значит и число линий) нельзя взять «на глаз»:
  // короткому условию досталась бы та же доля блока, и под клетку оставалась
  // бы дыра. Меряем каждое условие в скрытой зоне ТОЙ ЖЕ ширины, что в блоке.
  const [condMm, setCondMm] = useState({});
  const [tick, setTick] = useState(0);
  const measureRefs = useRef({});

  const fontMm = fontMmOf(settings.textSize);
  const measureKey = useMemo(
    () => [settings.mode, settings.count, fontMm, settings.fontFamily,
      tasks.map(t => `${t.id}|${t.statement_md || ''}`).join('§')].join('¦'),
    [settings.mode, settings.count, fontMm, settings.fontFamily, tasks],
  );

  useLayoutEffect(() => {
    const next = {};
    tasks.forEach((t) => {
      const el = measureRefs.current[t.id];
      if (el) next[t.id] = el.offsetHeight / MM_PX;
    });
    setCondMm(next);
  }, [measureKey, tick]);

  // Шрифты KaTeX догружаются асинхронно — после готовности меряем заново.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts?.ready) return undefined;
    let alive = true;
    document.fonts.ready.then(() => { if (alive) setTick(v => v + 1); });
    return () => { alive = false; };
  }, []);

  // 🚨 Незагруженный <img> имеет высоту 0 — условие с чертежом меряется
  // короче, чем печатается. Ждём каждую картинку и меряем заново.
  useEffect(() => {
    const pending = Object.values(measureRefs.current)
      .filter(Boolean)
      .flatMap(el => [...el.querySelectorAll('img')])
      .filter(img => !img.complete);
    if (!pending.length) return undefined;

    const bump = () => setTick(v => v + 1);
    pending.forEach((img) => {
      img.addEventListener('load', bump);
      img.addEventListener('error', bump);
    });
    return () => pending.forEach((img) => {
      img.removeEventListener('load', bump);
      img.removeEventListener('error', bump);
    });
  }, [measureKey, tick]);

  const geomOf = useCallback((taskId) => fitBlock({
    count: settings.count,
    mode: settings.mode,
    showHeader,
    condContentMm: condMm[taskId] ?? null,
  }), [settings.count, settings.mode, showHeader, condMm]);

  const sheetsWord = sheets.length === 1 ? 'лист' : sheets.length < 5 ? 'листа' : 'листов';
  const rootClass = `mwsp-root${settings.fontFamily === 'serif' ? ' mwsp-root--serif' : ''}`;

  return (
    <div className={rootClass}>
      <div className="no-print">
        <div className="mwsp-toolbar">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
            <Text type="secondary">
              {settings.mode === 'work' ? 'Рабочий лист' : 'Карточки'} · {title || 'Марафон'} ·{' '}
              {tasks.length} задач
              {settings.fill !== 'none' && ` × ${summary.copiesEach} копий`} ·{' '}
              {sheets.length} {sheetsWord}
            </Text>
          </Space>
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => printPaged()}
            disabled={!tasks.length}
          >
            Печать
          </Button>
        </div>

        <Card size="small" style={{ marginBottom: 12 }}>
          <MarathonWorksheetSettings
            settings={settings}
            patch={patch}
            onMode={onMode}
            taskCount={tasks.length}
            summary={summary}
          />
        </Card>
      </div>

      {/* Зона измерения — вне экрана, ширина = ширине условия в блоке. */}
      <div className="mwsp-measure" aria-hidden="true" style={{ width: `${statementWidthMm()}mm` }}>
        {tasks.map(t => (
          <div key={t.id} ref={(el) => { measureRefs.current[t.id] = el; }}>
            <div className="mwsp-task-text" style={{ fontSize: `${fontMm}mm` }}>
              <MathRenderer content={t.statement_md || ''} />
            </div>
            {settings.showTaskCode && t.code && <div className="mwsp-task-code">{t.code}</div>}
          </div>
        ))}
      </div>

      <div className="mwsp-pages">
        {sheets.map((sheet, i) => (
          <WorksheetSheet
            key={i}
            slots={sheet.tasks}
            settings={settings}
            geomOf={geomOf}
            baseGeom={baseGeom}
          />
        ))}
      </div>
    </div>
  );
}
