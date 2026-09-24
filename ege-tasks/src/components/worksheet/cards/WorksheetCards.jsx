import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Tooltip } from 'antd';
import { EditOutlined, SwapOutlined, HolderOutlined } from '@ant-design/icons';
import MathRenderer from '../../MathRenderer';
import { api } from '../../../services/pocketbase';
import { filterTaskText } from '../../../utils/filterTaskText';
import {
  CARD_PAD_MM, SHEET_PAD_MM, answerWidthMm, canSplitColumns, cardLayout, cardSizeMm,
  cardSlots, cardsSummary, cutLines, fontMmOf, layoutLabel, minFitPt, nextFitPt,
  paginateCards, sheetsWord, variantVisible,
} from '../../../utils/worksheetCards';
import './worksheetCards.css';

const EMPTY = {};

/** Размер чертежа на карточке: ширина от строки задачи и потолок высоты.
 *  Шкала мельче, чем на листе: карточка — четверть листа, а не лист. */
const FIGURE_VARS = {
  s: { '--wcd-fig-w': '32%', '--wcd-fig-h': '18mm' },
  m: { '--wcd-fig-w': '44%', '--wcd-fig-h': '26mm' },
  l: { '--wcd-fig-w': '62%', '--wcd-fig-h': '38mm' },
  xl: { '--wcd-fig-w': '90%', '--wcd-fig-h': '56mm' },
};

/* ── Задача ───────────────────────────────────────────────────────────────── */

function CardTask({ task, index, variantIndex, settings, editing }) {
  const raw = task.statement_md || '';
  const text = settings.hidePrefixes ? filterTaskText(raw) : raw;
  const imageUrl = task.has_image ? api.getTaskImageUrl(task) : null;
  const side = settings.answerStyle === 'line' || settings.answerStyle === 'box';
  const answer = settings.answersOnCards && task.answer
    ? <MathRenderer text={task.answer} />
    : null;

  const dnd = editing?.dragDropHandlers;
  const className = [
    'wcd-task',
    dnd?.isDragging(variantIndex, index) ? 'wcd-task--dragging' : '',
    dnd?.isDragOver(variantIndex, index) ? 'wcd-task--dragover' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={className}
      style={task.kimImageSize ? FIGURE_VARS[task.kimImageSize] : undefined}
      draggable={!!dnd}
      onDragStart={dnd ? (e => dnd.handleDragStart(e, variantIndex, index)) : undefined}
      onDragOver={dnd ? (e => dnd.handleDragOver(e, variantIndex, index)) : undefined}
      onDragLeave={dnd ? dnd.handleDragLeave : undefined}
      onDrop={dnd ? (e => dnd.handleDrop(e, variantIndex, index)) : undefined}
      onDragEnd={dnd ? dnd.handleDragEnd : undefined}
    >
      <div className="wcd-num"><span>{index + 1}</span></div>
      <div className="wcd-task-main">
        <div className="wcd-task-text"><MathRenderer text={text} /></div>
        {imageUrl && (
          <div className="wcd-task-image"><img src={imageUrl} alt="" /></div>
        )}
        {settings.showCode && task.code && <div className="wcd-task-code">{task.code}</div>}
        {settings.answerStyle === 'none' && answer && (
          <div className="wcd-task-answer">Ответ: {answer}</div>
        )}
      </div>
      {side && (
        <div className={`wcd-ans wcd-ans--${settings.answerStyle}`}>{answer}</div>
      )}

      {editing && (
        <div className="wcd-task-controls no-print">
          {dnd && <HolderOutlined className="wcd-task-grip" />}
          <Tooltip title="Редактировать задачу">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => editing.onEditTask?.(task)} />
          </Tooltip>
          <Tooltip title="Заменить задачу">
            <Button
              type="text"
              size="small"
              icon={<SwapOutlined />}
              onClick={() => editing.onReplaceTask?.(variantIndex, index, task)}
            />
          </Tooltip>
        </div>
      )}
    </div>
  );
}

/* ── Таблица ответов внизу карточки ───────────────────────────────────────── */

function AnswerStrip({ tasks, showAnswers }) {
  // Больше десяти клеток в строку карточка A6 не держит: клетка уже 8 мм.
  const perRow = Math.min(10, Math.max(1, tasks.length));
  return (
    <div className="wcd-strip" style={{ gridTemplateColumns: `auto repeat(${perRow}, minmax(0, 1fr))` }}>
      {Array.from({ length: Math.ceil(tasks.length / perRow) }, (_, r) => {
        const row = tasks.slice(r * perRow, (r + 1) * perRow);
        return [
          <div key={`h${r}`} className="wcd-strip-label">№</div>,
          ...Array.from({ length: perRow }, (_, i) => (
            <div key={`n${r}-${i}`} className="wcd-strip-num">{row[i] ? r * perRow + i + 1 : ''}</div>
          )),
          <div key={`a${r}`} className="wcd-strip-label">Ответ</div>,
          ...Array.from({ length: perRow }, (_, i) => (
            <div key={`v${r}-${i}`} className="wcd-strip-cell">
              {showAnswers && row[i]?.answer ? <MathRenderer text={row[i].answer} /> : null}
            </div>
          )),
        ];
      })}
    </div>
  );
}

/* ── Карточка ─────────────────────────────────────────────────────────────── */

function Card({ variant, variantIndex, settings, size, title, variantLabel, showVariant, fontPt, bodyRef, editing }) {
  const tasks = variant.tasks || [];
  const fields = settings.showStudentInfo && (
    <span className="wcd-fields">
      <span className="wcd-field wcd-field--wide">
        <span className="wcd-field-label">ФИ</span>
        <span className="wcd-field-rule" />
      </span>
      {settings.showClassField && (
        <span className="wcd-field">
          <span className="wcd-field-label">Класс</span>
          <span className="wcd-field-rule" />
        </span>
      )}
    </span>
  );
  const variantBox = showVariant && (
    <span className="wcd-variant">{variantLabel} {variant.number ?? variantIndex + 1}</span>
  );
  // Шапка — одна строка «название · ФИ · вариант»: на восьми карточках каждая
  // лишняя строка шапки стоит задачи.
  const hasRow = settings.showTitle || showVariant || settings.showStudentInfo;
  const cols = settings.innerColumns > 1 && canSplitColumns(settings.layout) ? 2 : 1;

  return (
    <div
      className="wcd-card"
      style={{ width: `${size.wMm}mm`, height: `${size.hMm}mm`, padding: `${CARD_PAD_MM}mm` }}
    >
      {(hasRow || settings.note) && (
        <div className="wcd-head">
          {hasRow && (
            <div className="wcd-head-row">
              {settings.showTitle && <span className="wcd-title">{title}</span>}
              {fields}
              {variantBox}
            </div>
          )}
          {settings.note && <div className="wcd-note">{settings.note}</div>}
        </div>
      )}

      <div
        ref={bodyRef}
        className={`wcd-body${cols > 1 ? ' wcd-body--cols' : ''}`}
        style={{ fontSize: `${fontMmOf(fontPt)}mm` }}
      >
        {tasks.map((task, i) => (
          <CardTask
            key={`${task.id}-${i}`}
            task={task}
            index={i}
            variantIndex={variantIndex}
            settings={settings}
            editing={editing}
          />
        ))}
      </div>

      {settings.answerStyle === 'strip' && tasks.length > 0 && (
        <AnswerStrip tasks={tasks} showAnswers={settings.answersOnCards} />
      )}
    </div>
  );
}

/* ── Лист ответов ─────────────────────────────────────────────────────────── */

function AnswerKey({ variants, variantLabel, title, withSolutions }) {
  return (
    <section className="wcd-key">
      <div className="wcd-key-runhead">
        <span>{title}</span>
        <span>Для учителя</span>
      </div>
      <h2 className="wcd-key-title">Ответы</h2>
      {variants.map((v, vi) => (
        <div className="wcd-key-block" key={v.number ?? vi}>
          {variants.length > 1 && <div className="wcd-key-variant">{variantLabel} {v.number ?? vi + 1}</div>}
          <div className="wcd-key-grid">
            {(v.tasks || []).map((t, i) => (
              <div className="wcd-key-cell" key={`${t.id}-${i}`}>
                <span className="wcd-key-num">{i + 1}</span>
                <span className="wcd-key-answer">
                  {t.answer ? <MathRenderer text={t.answer} /> : '—'}
                </span>
              </div>
            ))}
          </div>
          {withSolutions && (v.tasks || []).some(t => t.solution_md) && (
            <div className="wcd-key-solutions">
              {(v.tasks || []).map((t, i) => (t.solution_md ? (
                <div className="wcd-key-solution" key={`${t.id}-s${i}`}>
                  <span className="wcd-key-num">{i + 1}</span>
                  <div className="wcd-key-solution-text"><MathRenderer text={t.solution_md} /></div>
                </div>
              ) : null))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

/* ── Экран ────────────────────────────────────────────────────────────────── */

/**
 * Карточки Генератора: A4 режется на равные карточки, на каждой — вся работа.
 *
 * 🚨 Размер карточки считает `utils/worksheetCards.js` и передаёт inline: она
 * обязана знать высоту заранее. Если работа не влезает, кегль ужимается
 * (подгонка по РЕАЛЬНОЙ вёрстке первой карточки варианта — копии одинаковы),
 * а что не влезло и при минимальном кегле — честно показывается над листом.
 */
export default function WorksheetCards({
  variants = [],
  settings,
  title,
  variantLabel = 'Вариант',
  editing,
}) {
  const layout = cardLayout(settings.layout);
  const size = useMemo(() => cardSizeMm(settings.layout), [settings.layout]);
  const cuts = useMemo(() => cutLines(settings.layout), [settings.layout]);
  const slots = useMemo(() => cardSlots({
    variantsCount: variants.length,
    perSheet: layout.count,
    fill: settings.fill,
    copies: settings.copies,
  }), [variants.length, layout.count, settings.fill, settings.copies]);
  const sheets = useMemo(() => paginateCards(slots, layout.count), [slots, layout.count]);
  const summary = cardsSummary({
    variantsCount: variants.length, layout: settings.layout, fill: settings.fill, copies: settings.copies,
  });
  const showVariant = variantVisible(settings, variants.length);
  const answerW = answerWidthMm(settings.layout, settings.innerColumns);

  // ── Подгонка кегля ───────────────────────────────────────────────────────
  // Кегль у варианта свой: у короткой работы он остаётся как задан, длинная
  // ужимается до влезающей. Меряется сама карточка (тот же DOM, что уйдёт в
  // печать), поэтому экран и бумага не расходятся.
  const bodyRefs = useRef({});
  const rootRef = useRef(null);
  const [tick, setTick] = useState(0);
  const fitKey = useMemo(() => JSON.stringify([
    settings, title, variantLabel, showVariant, tick,
    variants.map(v => (v.tasks || []).map(t => `${t.id}|${t.statement_md || ''}|${t.kimImageSize || ''}`)),
  ]), [settings, title, variantLabel, showVariant, tick, variants]);
  const [fit, setFit] = useState({ key: '', pts: EMPTY });
  const pts = fit.key === fitKey ? fit.pts : EMPTY;
  const [overflow, setOverflow] = useState('');
  const minPt = minFitPt(settings.fontPt);

  useLayoutEffect(() => {
    const next = { ...pts };
    let changed = false;
    const over = [];
    variants.forEach((_, vi) => {
      const el = bodyRefs.current[vi];
      if (!el || !el.clientHeight) return;
      const ratio = Math.max(
        el.scrollHeight / el.clientHeight,
        el.clientWidth ? el.scrollWidth / el.clientWidth : 1,
      );
      if (ratio <= 1.005) return;
      const cur = pts[vi] ?? settings.fontPt;
      if (settings.autoFit && cur > minPt) {
        next[vi] = nextFitPt(cur, ratio, minPt);
        changed = true;
      } else {
        over.push(vi);
      }
    });
    if (changed) setFit({ key: fitKey, pts: next });
    const sig = changed ? overflow : over.join(',');
    if (sig !== overflow) setOverflow(sig);
  });

  // Шрифты KaTeX и картинки догружаются после первого замера — меряем заново.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts?.ready) return undefined;
    let alive = true;
    document.fonts.ready.then(() => { if (alive) setTick(v => v + 1); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const bump = (e) => { if (e.target?.tagName === 'IMG') setTick(v => v + 1); };
    // load/error не всплывают — ловим на фазе погружения.
    root.addEventListener('load', bump, true);
    root.addEventListener('error', bump, true);
    return () => {
      root.removeEventListener('load', bump, true);
      root.removeEventListener('error', bump, true);
    };
  }, []);

  if (!variants.length) return null;

  const shrunk = Object.entries(pts).filter(([, pt]) => pt < settings.fontPt);
  const overList = overflow ? overflow.split(',').map(Number) : [];
  const vName = (vi) => (variants.length > 1
    ? `${variantLabel} ${variants[vi]?.number ?? vi + 1}`
    : 'работа');

  const rootClass = [
    'wcd-root',
    settings.fontFamily === 'serif' ? 'wcd-root--serif' : '',
    settings.dividers ? '' : 'wcd-root--nodiv',
    settings.showFigures ? '' : 'wcd-root--nofig',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={rootRef}
      className={rootClass}
      style={{
        '--wcd-ans-w': `${answerW}mm`,
        ...FIGURE_VARS[settings.figureSize],
      }}
    >
      <div className="wcd-status no-print">
        <span>
          {layoutLabel(settings.layout)} · {summary.perSheet} на лист ·{' '}
          <b>{summary.cards} {summary.cards === 1 ? 'карточка' : 'карточек'}</b>
          {variants.length > 1 && ` (${variants.length} вар. × ${summary.perVariantMin === summary.perVariantMax
            ? summary.perVariantMax : `${summary.perVariantMin}–${summary.perVariantMax}`})`}
          {' '}· <b>{summary.sheets} {sheetsWord(summary.sheets)}</b>
          {settings.showKey && ' + лист ответов'}
          {summary.spare > 0 && ` · запасных: ${summary.spare}`}
          {summary.emptySlots > 0 && ` · пустых мест: ${summary.emptySlots}`}
        </span>
        {shrunk.length > 0 && (
          <span className="wcd-status-note">
            Кегль уменьшен, чтобы работа влезла: {shrunk
              .map(([vi, pt]) => `${vName(Number(vi))} — ${String(pt).replace('.', ',')} pt`)
              .join('; ')}
          </span>
        )}
      </div>

      {overList.length > 0 && (
        <Alert
          className="no-print"
          type="warning"
          showIcon
          style={{ marginBottom: 12, maxWidth: '210mm' }}
          message={`Не помещается на карточку: ${overList.map(vName).join(', ')}`}
          description={settings.autoFit
            ? 'Даже с уменьшенным кеглем. Выберите раскладку крупнее, уберите чертежи или сократите работу.'
            : 'Включите «Подгонять кегль» или выберите раскладку крупнее.'}
        />
      )}

      <div className="wcd-pages">
        {sheets.map((sheet, si) => (
          <div className="wcd-sheet" key={si} style={{ padding: `${SHEET_PAD_MM}mm` }}>
            <div
              className="wcd-grid"
              style={{ gridTemplateColumns: `repeat(${layout.cols}, ${size.wMm}mm)` }}
            >
              {sheet.map((slot) => (
                <Card
                  key={slot.key}
                  variant={variants[slot.variantIndex]}
                  variantIndex={slot.variantIndex}
                  settings={settings}
                  size={size}
                  title={title}
                  variantLabel={variantLabel}
                  showVariant={showVariant}
                  fontPt={pts[slot.variantIndex] ?? settings.fontPt}
                  bodyRef={slot.first ? (el) => { bodyRefs.current[slot.variantIndex] = el; } : undefined}
                  editing={editing}
                />
              ))}
            </div>
            {cuts.vertical.map(x => (
              <div key={`v${x}`} className="wcd-cut wcd-cut--v" style={{ left: `${x}mm` }} />
            ))}
            {cuts.horizontal.map(y => (
              <div key={`h${y}`} className="wcd-cut wcd-cut--h" style={{ top: `${y}mm` }} />
            ))}
          </div>
        ))}

        {settings.showKey && (
          <AnswerKey
            variants={variants}
            variantLabel={variantLabel}
            title={title}
            withSolutions={settings.keySolutions}
          />
        )}
      </div>
    </div>
  );
}
