import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Space, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import MathRenderer from '../../shared/components/MathRenderer';
import MarathonCardsSettings from './MarathonCardsSettings';
import { printPaged } from '../../utils/printPage';
import { MM_PX, expandTasks, fillSummary, paginateBlocks } from '../../utils/marathonWorksheet';
import {
  CARD_GAP_MM, CARD_HEAD_MM, applyCardCount, cardContentMm, cardGrid, cardOverflows,
  cardSizeMm, fitFontPt, fontMmOf, normalizeMarathonCardSettings, readCardSettings,
  writeCardSettings,
} from '../../utils/marathonCards';
import './MarathonCardsPrint.css';

const { Text } = Typography;

const DIFFICULTY_LABEL = { 1: 'Лёгкая', 2: 'Средняя', 3: 'Сложная', 4: 'Высокая', 5: 'Олимпиадная' };

// Чертёж: ширина в % от карточки и потолок высоты долей от зоны условия —
// размер живёт при любой плотности листа (та же шкала, что у отрезного листа).
const DRAWING_CFG = {
  s: { w: '32%', share: 0.34 },
  m: { w: '46%', share: 0.48 },
  l: { w: '62%', share: 0.62 },
  xl: { w: '80%', share: 0.76 },
};

/* ── Карточка ─────────────────────────────────────────────────────────────── */

function TaskCard({ task, number, title, settings, size, content, fontPt }) {
  const { showTitle, showLogo, showCode, showDifficulty, showAnswer, drawingSize } = settings;
  const imageUrl = api.getTaskImageUrl(task);
  const dcfg = DRAWING_CFG[drawingSize] ?? DRAWING_CFG.m;

  return (
    <div className="mcp-card" style={{ width: `${size.wMm}mm`, height: `${size.hMm}mm` }}>
      <div className="mcp-head" style={{ height: `${CARD_HEAD_MM}mm` }}>
        <div className="mcp-num">{number}</div>
        {showTitle && title && <div className="mcp-head-title">{title}</div>}
        <div className="mcp-head-right">
          {showDifficulty && (
            <span className="mcp-diff">{DIFFICULTY_LABEL[task.difficulty] || DIFFICULTY_LABEL[1]}</span>
          )}
          {showLogo && <span className="mcp-mark">LEMMA</span>}
        </div>
      </div>

      <div className="mcp-body" style={{ height: `${content.hMm}mm` }}>
        <div className="mcp-text" style={{ fontSize: `${fontMmOf(fontPt)}mm` }}>
          <MathRenderer content={task.statement_md || ''} />
        </div>
        {imageUrl && (
          <div className="mcp-fig" style={{ maxWidth: dcfg.w, maxHeight: `${content.hMm * dcfg.share}mm` }}>
            <img
              src={imageUrl}
              alt=""
              crossOrigin="anonymous"
              style={{ maxHeight: `${content.hMm * dcfg.share}mm` }}
            />
          </div>
        )}
      </div>

      {(showAnswer || showCode) && (
        <div className="mcp-foot">
          {showAnswer && (
            <div className="mcp-answer">
              <span className="mcp-answer-label">Ответ</span>
              <span className="mcp-answer-line" />
            </div>
          )}
          {showCode && task.code && <div className="mcp-code">{task.code}</div>}
        </div>
      )}
    </div>
  );
}

/* ── Лист ─────────────────────────────────────────────────────────────────── */

function CardSheet({ slots, settings, size, content, fontOf, title }) {
  const { cols, count } = cardGrid(settings.count);
  const empty = Math.max(0, count - slots.length);

  return (
    <div className="mcp-sheet">
      <div
        className="mcp-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${size.wMm}mm)`,
          gap: `${CARD_GAP_MM}mm`,
        }}
      >
        {slots.map(slot => (
          <TaskCard
            key={slot.key}
            task={slot.task}
            number={slot.no}
            title={title}
            settings={settings}
            size={size}
            content={content}
            fontPt={fontOf(slot.task.id)}
          />
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <div
            key={`empty-${i}`}
            className="mcp-card mcp-card--empty"
            style={{ width: `${size.wMm}mm`, height: `${size.hMm}mm` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Экран ────────────────────────────────────────────────────────────────── */

/**
 * Лист карточек марафона: A4 режется на равные карточки, карточка достаётся
 * ученику. Плотность — от 1 до 12 карточек на лист (`settings.count`).
 *
 * Оформление — общее с движком `print-sheet` (входная контрольная, отрезной
 * лист): монохром, миллиметры, номер задачи квадратом, волосяные линейки.
 * Никаких цветных шапок: карточка печатается пачкой на ч/б принтере.
 *
 * 🚨 Размеры карточки и зоны условия приходят из `utils/marathonCards.js` и
 * ставятся inline — карточка обязана знать высоту заранее, иначе длинное
 * условие растянет ячейку и сетка листа поедет. Условия меряются в скрытой зоне
 * ровно той ширины, что в карточке, и по замеру кегль ужимается до влезающего.
 */
export default function MarathonCardsPrint({ tasks = [], title, onBack }) {
  const [settings, setSettings] = useState(readCardSettings);

  const save = useCallback((next) => {
    setSettings(next);
    writeCardSettings(next);
  }, []);

  const patch = useCallback((delta) => {
    save(normalizeMarathonCardSettings({ ...settings, ...delta }));
  }, [settings, save]);

  const onCount = useCallback((count) => {
    save(applyCardCount(settings, count));
  }, [settings, save]);

  const size = useMemo(() => cardSizeMm(settings.count), [settings.count]);
  const content = useMemo(() => cardContentMm(settings.count, {
    showHead: true,
    showAnswer: settings.showAnswer,
    showCode: settings.showCode,
  }), [settings.count, settings.showAnswer, settings.showCode]);

  const slots = useMemo(
    () => expandTasks(tasks, { fill: settings.fill, copies: settings.copies, count: settings.count }),
    [tasks, settings.fill, settings.copies, settings.count],
  );

  const sheets = useMemo(() => paginateBlocks(slots, settings.count), [slots, settings.count]);

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
  // Карточка фиксированной высоты: без замера длинное условие просто обрезалось
  // бы рамкой. Меряем каждое условие в скрытой зоне ТОЙ ЖЕ ширины, что в
  // карточке, и по замеру подбираем кегль.
  const [condMm, setCondMm] = useState({});
  const [tick, setTick] = useState(0);
  const measureRefs = useRef({});

  const fontMm = fontMmOf(settings.textSize);
  const measureKey = useMemo(
    () => [settings.count, fontMm, settings.fontFamily,
      tasks.map(t => `${t.id}|${t.statement_md || ''}`).join('§')].join('¦'),
    [settings.count, fontMm, settings.fontFamily, tasks],
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

  // 🚨 Незагруженный <img> имеет высоту 0 — условие с чертежом меряется короче,
  // чем печатается. Ждём каждую картинку и меряем заново.
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

  // Чертёж занимает часть зоны условия — текст меряется против остатка.
  const dcfg = DRAWING_CFG[settings.drawingSize] ?? DRAWING_CFG.m;
  const availMmOf = useCallback((task) => {
    const hasFigure = !!api.getTaskImageUrl(task);
    return hasFigure ? content.hMm * (1 - dcfg.share) : content.hMm;
  }, [content.hMm, dcfg.share]);

  const fontOf = useCallback((taskId) => {
    if (!settings.autoFit) return settings.textSize;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return settings.textSize;
    return fitFontPt(settings.textSize, {
      measuredMm: condMm[taskId] ?? null,
      availMm: availMmOf(task),
    });
  }, [settings.autoFit, settings.textSize, tasks, condMm, availMmOf]);

  const tooLong = useMemo(() => tasks.filter(t => cardOverflows({
    measuredMm: condMm[t.id] ?? null,
    availMm: availMmOf(t),
    basePt: settings.textSize,
  })).length, [tasks, condMm, availMmOf, settings.textSize]);

  const sheetsWord = sheets.length === 1 ? 'лист' : sheets.length < 5 ? 'листа' : 'листов';
  const rootClass = `mcp-root${settings.fontFamily === 'serif' ? ' mcp-root--serif' : ''}`;

  return (
    <div className={rootClass}>
      <div className="no-print">
        <div className="mcp-toolbar">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
            <Text type="secondary">
              Карточки · {title || 'Марафон'} · {tasks.length} задач
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
          <MarathonCardsSettings
            settings={settings}
            patch={patch}
            onCount={onCount}
            taskCount={tasks.length}
            summary={summary}
            tooLong={tooLong}
          />
        </Card>
      </div>

      {/* Зона измерения — вне экрана, ширина = ширине условия в карточке. */}
      <div className="mcp-measure" aria-hidden="true" style={{ width: `${content.wMm}mm` }}>
        {tasks.map(t => (
          <div key={t.id} ref={(el) => { measureRefs.current[t.id] = el; }}>
            <div className="mcp-text" style={{ fontSize: `${fontMm}mm` }}>
              <MathRenderer content={t.statement_md || ''} />
            </div>
          </div>
        ))}
      </div>

      <div className="mcp-pages">
        {sheets.map((sheet, i) => (
          <CardSheet
            key={i}
            slots={sheet.tasks}
            settings={settings}
            size={size}
            content={content}
            fontOf={fontOf}
            title={title}
          />
        ))}
      </div>
    </div>
  );
}
