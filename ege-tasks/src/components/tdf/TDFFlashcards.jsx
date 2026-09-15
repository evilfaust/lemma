import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Progress, Segmented, Space, Spin, Tag, Typography } from 'antd';
import {
  ArrowLeftOutlined, CheckOutlined, CloseOutlined, RedoOutlined, SettingOutlined,
} from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import MathRenderer from '../../shared/components/MathRenderer';
import { Chip, EmptyState } from '../workspace/ui';
import { TDF_TYPES, TDF_TYPE_VALUES, tdfTypeLabel, tdfTypeTone } from './tdfTypes';
import { shuffleArray } from '../../utils/shuffle';
import './TDFFlashcards.css';

/* ── Прогресс по набору живёт в браузере учителя ── */
function loadProgress(setId) {
  try {
    const raw = localStorage.getItem(`tdf-flashcards-${setId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function saveProgress(setId, data) {
  try {
    localStorage.setItem(`tdf-flashcards-${setId}`, JSON.stringify(data));
  } catch { /* приватное окно */ }
}

const QUESTION_MODES = [
  { value: 'name', label: 'По названию' },
  { value: 'drawing', label: 'По чертежу' },
  { value: 'notation', label: 'По краткой записи' },
];

const ASK_LABEL = {
  theorem: 'Сформулируйте теорему',
  definition: 'Дайте определение',
  formula: 'Запишите формулу',
  axiom: 'Сформулируйте аксиому',
  property: 'Сформулируйте свойство',
  criterion: 'Сформулируйте признак',
  corollary: 'Сформулируйте следствие',
  geometry_formula: 'Запишите формулу',
};

/**
 * Что показать на лицевой стороне.
 *
 * 🚨 Раньше лицо показывало `formulation_md` — то есть саму формулировку
 * теоремы, а оборот повторял её же. Карточка не спрашивала, а сразу отвечала.
 * Теперь лицо — вопрос: собственный текст пункта (`question_md`), либо чертёж,
 * либо краткая запись, либо название с подводкой по типу.
 */
export function questionFor(item, mode) {
  if ((item.question_md || '').trim()) return { kind: 'md', value: item.question_md };
  if (mode === 'drawing' && item.drawing_image) return { kind: 'drawing' };
  if (mode === 'notation' && (item.short_notation_md || '').trim()) {
    return { kind: 'notation', value: item.short_notation_md };
  }
  return { kind: 'name', value: item.name || '' };
}

/** Сколько пунктов колоды режим действительно может спросить своим способом. */
export function modeCoverage(items, mode) {
  if (mode === 'drawing') return items.filter(i => i.drawing_image).length;
  if (mode === 'notation') return items.filter(i => (i.short_notation_md || '').trim()).length;
  return items.length;
}

function FlashCard({ item, mode, isFlipped, onFlip }) {
  const drawingUrl = item.drawing_image ? api.getTdfItemDrawingUrl(item) : null;
  const question = questionFor(item, mode);

  return (
    <div
      className={`tdf-flashcard ${isFlipped ? 'tdf-flashcard--flipped' : ''}`}
      onClick={onFlip}
      role="button"
      aria-label="Перевернуть карточку"
    >
      <div className="tdf-flashcard-inner">
        {/* Лицо — вопрос */}
        <div className="tdf-flashcard-front">
          <div className="tdf-flashcard-head">
            <Chip tone={tdfTypeTone(item.type)}>{tdfTypeLabel(item.type)}</Chip>
            <span className="tdf-flashcard-ask">
              {question.kind === 'md' ? 'Вопрос' : (ASK_LABEL[item.type] || 'Ответьте')}
            </span>
          </div>

          <div className="tdf-flashcard-question">
            {question.kind === 'drawing' && (
              <img src={drawingUrl} alt="чертёж" className="tdf-flashcard-figure" />
            )}
            {question.kind === 'notation' && <MathRenderer content={question.value} />}
            {question.kind === 'md' && <MathRenderer content={question.value} />}
            {question.kind === 'name' && <span className="tdf-flashcard-title">{question.value || '—'}</span>}
          </div>

          <div className="tdf-flashcard-hint">нажмите, чтобы проверить себя</div>
        </div>

        {/* Оборот — ответ */}
        <div className="tdf-flashcard-back">
          <div className="tdf-flashcard-head">
            <Chip tone={tdfTypeTone(item.type)}>{tdfTypeLabel(item.type)}</Chip>
            {item.name && <span className="tdf-flashcard-title">{item.name}</span>}
          </div>

          <div className="tdf-flashcard-content">
            {item.formulation_md
              ? <MathRenderer content={item.formulation_md} />
              : <Typography.Text type="secondary">Формулировка не заполнена</Typography.Text>}
          </div>

          {item.short_notation_md && (
            <div className="tdf-flashcard-notation">
              <div className="tdf-flashcard-label">Краткая запись</div>
              <MathRenderer content={item.short_notation_md} />
            </div>
          )}

          {drawingUrl && question.kind !== 'drawing' && (
            <div className="tdf-flashcard-drawing">
              <img src={drawingUrl} alt="чертёж" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsScreen({ tdfSet, items, onStart, savedProgress }) {
  const [filterTypes, setFilterTypes] = useState(TDF_TYPE_VALUES);
  const [shuffled, setShuffled] = useState(true);
  const [onlyUnknown, setOnlyUnknown] = useState(false);
  const [mode, setMode] = useState('name');

  const real = useMemo(() => items.filter(i => !i.is_section_header), [items]);

  const available = useMemo(() => {
    let result = real.filter(it => filterTypes.includes(it.type));
    if (onlyUnknown) result = result.filter(it => savedProgress[it.id] !== 'know');
    return result;
  }, [real, filterTypes, onlyUnknown, savedProgress]);

  const knownCount = useMemo(
    () => real.filter(it => savedProgress[it.id] === 'know').length,
    [real, savedProgress]
  );
  const unknownCount = useMemo(
    () => real.filter(it => savedProgress[it.id] === 'dont-know').length,
    [real, savedProgress]
  );

  // Сколько карточек режим спросит своим способом — остальные уйдут по названию.
  const coverage = modeCoverage(available, mode);
  const presentTypes = useMemo(() => {
    const present = new Set(real.map(i => i.type));
    return TDF_TYPES.filter(t => present.has(t.value));
  }, [real]);

  if (real.length === 0) {
    return (
      <EmptyState
        title="В наборе нет пунктов"
        description="Сначала соберите конспект — карточки строятся из его пунктов."
      />
    );
  }

  return (
    <div className="tdf-flashcards-settings">
      <h2 className="tdf-flashcards-h">{tdfSet?.title || 'Карточки'}</h2>
      {tdfSet?.class_number && <Tag style={{ marginBottom: 14 }}>{tdfSet.class_number} класс</Tag>}

      <div className="tdf-flashcards-progress">
        <div className="tdf-flashcards-label">
          Знаю {knownCount} из {real.length}
          {unknownCount > 0 && ` · отмечено «не знаю»: ${unknownCount}`}
        </div>
        <Progress
          percent={Math.round((knownCount / real.length) * 100)}
          size="small"
          strokeColor="var(--c-teal)"
          style={{ margin: '4px 0 0' }}
        />
      </div>

      <div className="tdf-flashcards-block">
        <div className="tdf-flashcards-label">Как спрашивать</div>
        <Segmented value={mode} onChange={setMode} options={QUESTION_MODES} />
        <div className="tdf-flashcards-note">
          {mode === 'name' && 'На лицевой стороне — название пункта, на обороте — формулировка.'}
          {mode === 'drawing' && `Показываем чертёж, вспоминаем формулировку. Чертёж есть у ${coverage} из ${available.length} — остальные спросим по названию.`}
          {mode === 'notation' && `Показываем краткую запись, вспоминаем формулировку. Запись есть у ${coverage} из ${available.length} — остальные спросим по названию.`}
        </div>
      </div>

      <div className="tdf-flashcards-block">
        <div className="tdf-flashcards-label">Типы пунктов</div>
        <div className="tdf-flashcards-types">
          {presentTypes.map(t => (
            <Tag.CheckableTag
              key={t.value}
              checked={filterTypes.includes(t.value)}
              onChange={(checked) => setFilterTypes(prev => (
                checked ? [...prev, t.value] : prev.filter(x => x !== t.value)
              ))}
            >
              {t.label}
            </Tag.CheckableTag>
          ))}
        </div>
      </div>

      <Space direction="vertical" size={8} style={{ marginBottom: 18 }}>
        <Checkbox checked={shuffled} onChange={e => setShuffled(e.target.checked)}>
          Перемешать карточки
        </Checkbox>
        <Checkbox
          checked={onlyUnknown}
          onChange={e => setOnlyUnknown(e.target.checked)}
          disabled={knownCount === 0}
        >
          Только те, что ещё не выучены
        </Checkbox>
      </Space>

      <Button
        type="primary"
        size="large"
        disabled={available.length === 0}
        onClick={() => onStart({ filtered: available, shuffled, mode })}
        block
      >
        Начать ({available.length} карточек)
      </Button>
    </div>
  );
}

function ResultsScreen({ deck, results, onRestart, onRestartUnknown, onBack }) {
  const knownCount = Object.values(results).filter(v => v === 'know').length;
  const total = deck.length;
  const pct = total > 0 ? Math.round((knownCount / total) * 100) : 0;
  const unknown = deck.filter(item => results[item.id] !== 'know');

  return (
    <div className="tdf-flashcards-results">
      <h2 className="tdf-flashcards-h">Итог</h2>

      <Progress
        type="circle"
        percent={pct}
        strokeColor={pct >= 70 ? 'var(--c-teal)' : pct >= 40 ? 'var(--c-amber)' : 'var(--c-rose)'}
      />
      <div className="tdf-flashcards-label" style={{ marginTop: 12 }}>
        знаю {knownCount} из {total}
      </div>

      {unknown.length > 0 && (
        <div className="tdf-flashcards-unknown">
          <div className="tdf-flashcards-label">Осталось повторить</div>
          <ul>
            {unknown.slice(0, 8).map(i => <li key={i.id}>{i.name || '—'}</li>)}
            {unknown.length > 8 && <li>…и ещё {unknown.length - 8}</li>}
          </ul>
        </div>
      )}

      <Space direction="vertical" size={10} style={{ width: '100%', marginTop: 14 }}>
        {unknown.length > 0 && (
          <Button type="primary" icon={<RedoOutlined />} onClick={onRestartUnknown} block>
            Повторить непройденные ({unknown.length})
          </Button>
        )}
        <Button icon={<RedoOutlined />} onClick={onRestart} block>Начать заново</Button>
        <Button icon={<SettingOutlined />} onClick={onBack} block>Настройки</Button>
      </Space>
    </div>
  );
}

function SetSelectorScreen({ onSelect }) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTdfSets().then(setSets).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 64 }}><Spin size="large" /></div>;

  if (sets.length === 0) {
    return <EmptyState title="Наборов ТДФ нет" description="Создайте набор в разделе «ТДФ — Наборы»." />;
  }

  return (
    <div className="tdf-flashcards-settings">
      <h2 className="tdf-flashcards-h">Выберите набор</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sets.map(s => (
          <Button key={s.id} block onClick={() => onSelect(s)} style={{ height: 'auto', padding: '10px 16px', textAlign: 'left' }}>
            <span style={{ fontWeight: 500 }}>{s.title}</span>
            {s.class_number && <Tag style={{ marginLeft: 8 }}>{s.class_number} класс</Tag>}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function TDFFlashcards({ setId: initialSetId, onBack }) {
  const [activeSetId, setActiveSetId] = useState(initialSetId || null);
  const [tdfSet, setTdfSet] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(!!initialSetId);

  const [phase, setPhase] = useState('settings');  // settings | session | results
  const [deck, setDeck] = useState([]);
  const [mode, setMode] = useState('name');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [results, setResults] = useState({});
  const [progress, setProgress] = useState({});

  useEffect(() => {
    if (!activeSetId) return;
    setLoading(true);
    Promise.all([api.getTdfSet(activeSetId), api.getTdfItems(activeSetId)])
      .then(([set, its]) => {
        setTdfSet(set);
        setItems(its);
        setProgress(loadProgress(activeSetId));
      })
      .finally(() => setLoading(false));
  }, [activeSetId]);

  const handleStart = useCallback(({ filtered, shuffled, mode: askMode }) => {
    setDeck(shuffled ? shuffleArray([...filtered]) : [...filtered]);
    setMode(askMode);
    setCurrentIndex(0);
    setIsFlipped(false);
    setResults({});
    setPhase('session');
  }, []);

  const handleFlip = useCallback(() => setIsFlipped(prev => !prev), []);

  const handleAnswer = useCallback((answer) => {
    const item = deck[currentIndex];
    if (!item) return;
    setResults(prev => ({ ...prev, [item.id]: answer }));
    setProgress(prev => {
      const next = { ...prev, [item.id]: answer };
      saveProgress(activeSetId, next);
      return next;
    });

    if (currentIndex + 1 >= deck.length) {
      setPhase('results');
    } else {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  }, [deck, currentIndex, activeSetId]);

  // Клавиатура: карточки часто гоняют с проектора, мышь там мешает.
  useEffect(() => {
    if (phase !== 'session') return undefined;
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); handleFlip(); }
      else if (isFlipped && (e.key === '1' || e.key === 'ArrowRight')) handleAnswer('know');
      else if (isFlipped && (e.key === '0' || e.key === 'ArrowLeft')) handleAnswer('dont-know');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, isFlipped, handleFlip, handleAnswer]);

  const handleRestartUnknown = useCallback(() => {
    setDeck(deck.filter(item => results[item.id] !== 'know'));
    setCurrentIndex(0);
    setIsFlipped(false);
    setResults({});
    setPhase('session');
  }, [deck, results]);

  if (!activeSetId) {
    return (
      <div className="tdf-flashcards-container">
        <div className="tdf-flashcards-topbar">
          <Button icon={<ArrowLeftOutlined />} type="text" onClick={onBack}>Назад к ТДФ</Button>
        </div>
        <SetSelectorScreen onSelect={(s) => { setActiveSetId(s.id); setPhase('settings'); }} />
      </div>
    );
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 64 }}><Spin size="large" /></div>;

  return (
    <div className="tdf-flashcards-container">
      <div className="tdf-flashcards-topbar">
        <Button
          icon={<ArrowLeftOutlined />}
          type="text"
          onClick={initialSetId ? onBack : () => setActiveSetId(null)}
        >
          {initialSetId ? 'Назад к ТДФ' : 'Выбрать другой набор'}
        </Button>
      </div>

      {phase === 'settings' && (
        <SettingsScreen tdfSet={tdfSet} items={items} onStart={handleStart} savedProgress={progress} />
      )}

      {phase === 'session' && deck.length > 0 && (
        <div className="tdf-flashcards-session">
          <div>
            <Progress
              percent={Math.round((currentIndex / deck.length) * 100)}
              size="small"
              showInfo={false}
              strokeColor="var(--accent)"
            />
            <div className="tdf-flashcards-counter">{currentIndex + 1} / {deck.length}</div>
          </div>

          <FlashCard item={deck[currentIndex]} mode={mode} isFlipped={isFlipped} onFlip={handleFlip} />

          <div className="tdf-flashcards-actions">
            <Button
              size="large"
              icon={<CloseOutlined />}
              onClick={() => handleAnswer('dont-know')}
              disabled={!isFlipped}
              danger
              style={{ flex: 1 }}
            >
              Не знаю
            </Button>
            <Button
              size="large"
              icon={<CheckOutlined />}
              onClick={() => handleAnswer('know')}
              disabled={!isFlipped}
              className="tdf-flashcards-know"
              style={{ flex: 1 }}
            >
              Знаю
            </Button>
          </div>
          <div className="tdf-flashcards-keys">
            пробел — перевернуть · 1 или → — знаю · 0 или ← — не знаю
          </div>
        </div>
      )}

      {phase === 'results' && (
        <ResultsScreen
          deck={deck}
          results={results}
          onRestart={() => setPhase('settings')}
          onRestartUnknown={handleRestartUnknown}
          onBack={() => setPhase('settings')}
        />
      )}
    </div>
  );
}
