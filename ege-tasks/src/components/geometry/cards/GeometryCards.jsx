import { useCallback, useMemo, useRef, useState } from 'react';
import { Button, Input, Segmented, Select, Space, Switch, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import GeometryCard from './GeometryCard';
import { printPaged } from '../../../utils/printPage';
import {
  CARD_LAYOUTS, DEFAULT_CARD_LAYOUT, TEXT_SIZES, cardLayoutById, cardSizeMm, cardTextMm,
  resolveCardPlace, SHEET_PAD_MM, HEADER_MM,
} from '../../../utils/geometryCards';
import './geometryCards.css';

const { Text } = Typography;

// Оформление выбирают один раз — живёт в браузере.
const LS_KEY = 'geometry.cards.v2';
const DEFAULTS = { layoutId: DEFAULT_CARD_LAYOUT, textSize: 'm', font: 'sans', showGrid: false, showCode: true };

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    return raw && typeof raw === 'object' ? { ...DEFAULTS, ...raw } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(s) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* приватное окно */ }
}

/**
 * Карточки A5/A4 из геометрической работы: лист режется на карточки, у каждой
 * — номер, условие и чертёж. Раскладку «текст ↔ чертёж» карточка выбирает сама
 * (utils/geometryCards.js), учитель может поправить её кнопками на карточке —
 * выбор сохраняется в работу (`structure.layouts[taskId] = { place }`).
 *
 * @param {Array<{label: string, tasks: object[]}>} sections — варианты работы
 * @param {object} [layoutSnapshot] — structure.layouts работы
 * @param {function} [onLayoutsSave] — (patch: { taskId: { place } }) => Promise
 */
export default function GeometryCards({
  sections, layoutSnapshot = null, onLayoutsSave = null, initialHeader = '', onBack,
}) {
  const [settings, setSettings] = useState(loadSettings);
  const patch = (p) => setSettings((prev) => { const next = { ...prev, ...p }; saveSettings(next); return next; });
  const [showAnswers, setShowAnswers] = useState(false);
  const [topic, setTopic] = useState(initialHeader || '');
  const [subtopic, setSubtopic] = useState('');
  const [places, setPlaces] = useState({});
  const [saveState, setSaveState] = useState(null);
  const [tight, setTight] = useState({});

  const layout = cardLayoutById(settings.layoutId);
  const perPage = layout.cols * layout.rows;
  const hasHeader = !!(topic || subtopic || sections.some((s) => s.label));
  const size = useMemo(
    () => cardSizeMm(layout, { header: hasHeader, code: settings.showCode }),
    [layout, hasHeader, settings.showCode],
  );
  const textMm = cardTextMm(layout, settings.textSize);

  // Листы: каждый вариант — с нового листа, нумерация в варианте с 1.
  const pages = useMemo(() => {
    const out = [];
    for (const sec of sections) {
      const tasks = sec.tasks || [];
      for (let i = 0; i < Math.max(1, tasks.length); i += perPage) {
        out.push({
          label: sec.label,
          start: i,
          tasks: Array.from({ length: perPage }, (_, k) => tasks[i + k] || null),
        });
      }
    }
    return out;
  }, [sections, perPage]);

  const placeOf = (task) => places[task.id] || resolveCardPlace(layoutSnapshot?.[task.id], task.preview_layout);

  const saveRef = useRef(onLayoutsSave);
  saveRef.current = onLayoutsSave;
  const setPlace = useCallback(async (taskId, place) => {
    setPlaces((prev) => ({ ...prev, [taskId]: place }));
    if (!saveRef.current) return;
    setSaveState('saving');
    try {
      await saveRef.current({ [taskId]: { place } });
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? null : s)), 2500);
    } catch {
      setSaveState('error');
    }
  }, []);

  const overflowHandlers = useRef(new Map());
  const overflowOf = (key) => {
    if (!overflowHandlers.current.has(key)) {
      overflowHandlers.current.set(key, (v) => setTight((prev) => (!!prev[key] === v ? prev : { ...prev, [key]: v })));
    }
    return overflowHandlers.current.get(key);
  };
  const tightCount = Object.values(tight).filter(Boolean).length;

  const handlePrint = () => printPaged({ size: `${layout.page} portrait`, margin: '0' });

  return (
    <div className={`gc-root gc-root--${layout.page}`}>
      <div className="gc-toolbar no-print">
        <Space wrap size={[12, 8]}>
          {onBack && <Button icon={<ArrowLeftOutlined />} onClick={onBack}>К работе</Button>}
          <Select
            value={layout.id}
            onChange={(v) => patch({ layoutId: v })}
            options={CARD_LAYOUTS.map((l) => ({ value: l.id, label: l.label }))}
            style={{ width: 150 }}
          />
          <Space size={6}>
            <Text>Текст</Text>
            <Segmented size="small" value={settings.textSize} onChange={(v) => patch({ textSize: v })} options={TEXT_SIZES.map(({ value, label }) => ({ value, label }))} />
          </Space>
          <Segmented
            size="small"
            value={settings.font}
            onChange={(v) => patch({ font: v })}
            options={[{ value: 'sans', label: 'Гротеск' }, { value: 'serif', label: 'Антиква' }]}
          />
          <Space size={6}><Switch size="small" checked={settings.showGrid} onChange={(v) => patch({ showGrid: v })} /><Text>Клетка</Text></Space>
          <Space size={6}><Switch size="small" checked={settings.showCode} onChange={(v) => patch({ showCode: v })} /><Text>Код задачи</Text></Space>
          <Space size={6}><Switch size="small" checked={showAnswers} onChange={setShowAnswers} /><Text>Ответы</Text></Space>
          <Tag>Листов: {pages.length}</Tag>
          {tightCount > 0 && <Tag color="warning">Мелкий кегль: {tightCount}</Tag>}
          {saveState === 'saving' && <Tag color="processing">Сохранение…</Tag>}
          {saveState === 'saved' && <Tag color="success">Сохранено в работу</Tag>}
          {saveState === 'error' && <Tag color="error">Не сохранилось</Tag>}
        </Space>
        <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>
      </div>

      <div className="gc-head-inputs no-print">
        <Input placeholder="Тема (заголовок листа)" value={topic} onChange={(e) => setTopic(e.target.value)} allowClear style={{ maxWidth: 320 }} />
        <Input placeholder="Подзаголовок" value={subtopic} onChange={(e) => setSubtopic(e.target.value)} allowClear style={{ maxWidth: 320 }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Раскладку карточка выбирает сама; поправить — кнопками на карточке (наведите мышь).
        </Text>
      </div>

      <div className={`gc-pages gc-font-${settings.font}`}>
        {pages.map((page, pi) => (
          <section
            key={pi}
            className="gc-sheet"
            // Высота на миллиметр меньше листа: округления печати иначе выдавливают
            // пустую страницу (низ — поле листа, его и съедаем).
            style={{ width: `${size.page.w}mm`, height: `${size.page.h - 1}mm`, padding: `${SHEET_PAD_MM}mm` }}
          >
            {hasHeader && (
              <header className="gc-sheet-head" style={{ height: `${HEADER_MM}mm` }}>
                <span className="gc-sheet-title">{topic}</span>
                <span className="gc-sheet-sub">{[subtopic, page.label].filter(Boolean).join(' · ')}</span>
              </header>
            )}
            <div
              className="gc-grid-sheet"
              style={{
                gridTemplateColumns: `repeat(${layout.cols}, ${size.cell.w}mm)`,
                gridTemplateRows: `repeat(${layout.rows}, ${size.cell.h}mm)`,
              }}
            >
              {page.tasks.map((task, ti) => {
                const key = task ? `${pi}-${ti}-${task.id}` : `${pi}-${ti}-empty`;
                return (
                  <GeometryCard
                    key={key}
                    task={task}
                    placeholder={!task}
                    number={page.start + ti + 1}
                    size={size}
                    textMm={textMm}
                    place={task ? placeOf(task) : 'auto'}
                    showAnswer={showAnswers}
                    showCode={settings.showCode}
                    showGrid={settings.showGrid}
                    onPlaceChange={task && onLayoutsSave ? (p) => setPlace(task.id, p) : undefined}
                    onOverflow={task ? overflowOf(key) : undefined}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
