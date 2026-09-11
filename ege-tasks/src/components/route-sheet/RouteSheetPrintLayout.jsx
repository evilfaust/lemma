import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import MathRenderer from '../../shared/components/MathRenderer';
import PrintFill from '../shared/PrintFill';
import RouteStatementRenderer from './RouteStatementRenderer';
import { MM, paginateByHeight } from '../print-sheet/geometry';
import {
  circleNum, resolveStatement, normalizeRouteSettings, instructionText,
  solveHeightMm, solveWidthMm, pagePaddingCss, bodyFirstMm, bodyRestMm,
  contentWidthMm, CELL_MM, TASK_GAP_MM, SOLVE_GAP_MM,
} from '../../utils/routeSheet';
import './RouteSheetPrintLayout.css';

/**
 * Печать маршрутного листа.
 *
 * Лист — цепочка: ответ задачи подставляется в условие следующей, место
 * подстановки помечено кружковым номером. Поэтому у каждой задачи ответ стоит
 * в рамке и подписан своим номером — ученику видно, что именно этот ответ
 * поедет дальше, а не просто «ответ».
 *
 * Пагинация честная, как в движке `components/print-sheet/`: задачи меряются в
 * скрытой зоне той же ширины, что и полоса набора, и раскладываются по
 * страницам по реальным высотам (`paginateByHeight` оттуда же). Свободный
 * поток с `break-inside: avoid` выглядел проще, но браузер оставлял пустые
 * страницы и не давал полей на второй и дальше.
 *
 * 🚨 Поля рисует сам лист (padding страницы), @page уходит в `margin: 0`:
 * в диалоге печати Chrome есть «Поля: Нет», и он перебивает поля из @page —
 * лист печатался впритык к краю бумаги.
 *
 * Стилистика — общая с печатным движком (входная контрольная). Тот же
 * компонент рисует экранный предпросмотр (`screenMode`).
 */

function Header({ title, settings }) {
  return (
    <header className="rs-head">
      <div className="rs-eyebrow">Маршрутный лист</div>
      <h1 className="rs-title">{title || 'Маршрутный лист'}</h1>
      <div className="rs-fields">
        <div className="rs-field rs-field--wide">
          <span className="rs-field-label">Фамилия, имя</span>
          <span className="rs-field-rule" />
        </div>
        {settings.showClassField !== false && (
          <div className="rs-field">
            <span className="rs-field-label">Класс</span>
            <span className="rs-field-rule" />
          </div>
        )}
        <div className="rs-field">
          <span className="rs-field-label">Дата</span>
          <span className="rs-field-rule" />
        </div>
      </div>

      {settings.showInstruction !== false && (
        <section className="rs-note">
          <span className="rs-note-label">Как решать. </span>
          <span className="rs-note-text">{instructionText(settings)}</span>
        </section>
      )}
    </header>
  );
}

/**
 * Задача ученика. `solveMm` приходит снаружи: в зоне измерения задача меряется
 * «голой» (без места для решения), а его высота прибавляется арифметически —
 * так в measure-зоне живёт один и тот же рендер на все режимы.
 */
function StudentTask({ task, index, settings, solveMm = 0 }) {
  return (
    <article className="rs-task">
      <div className="rs-task-num">{index + 1}</div>
      <div className="rs-task-main">
        {/* Ответ стоит в строке условия, а не отдельным блоком под клеткой:
            отдельной строкой он съедал ~12 мм на каждой задаче — на листе из
            шести это целая задача. Рамка подписана номером задачи: именно этот
            ответ поедет дальше по цепочке. */}
        <div className="rs-task-row">
          <div className="rs-task-text">
            <RouteStatementRenderer content={task.statement_md || ''} />
          </div>
          <div className="rs-answer">
            <span className="rs-answer-label">
              Ответ <span className="rs-answer-mark">{circleNum(index)}</span>
            </span>
            <span className="rs-answer-box" />
          </div>
        </div>

        {solveMm > 0 && (
          <div className="rs-solve" style={{ height: `${solveMm}mm` }}>
            <span className="rs-solve-label">Решение</span>
            <PrintFill
              fill={settings.fill}
              heightMm={solveMm}
              widthMm={solveWidthMm()}
              cellMm={CELL_MM}
            />
          </div>
        )}
      </div>
    </article>
  );
}

// ─── Ключ учителя ────────────────────────────────────────────────────────────
function KeyPage({ title, tasks }) {
  return (
    <section className="rs-page rs-page--key" style={{ padding: pagePaddingCss() }}>
      <header className="rs-head rs-head--key">
        <div className="rs-eyebrow">Ключ учителя</div>
        <h1 className="rs-title">{title || 'Маршрутный лист'}</h1>
      </header>

      <div className="rs-key-grid">
        {tasks.map((task, index) => (
          <div className="rs-key-cell" key={task.id || index}>
            <span className="rs-key-num">{circleNum(index)}</span>
            <span className="rs-key-answer">
              {task.answer
                ? <MathRenderer text={task.answer} />
                : <span className="rs-key-dash">—</span>}
            </span>
          </div>
        ))}
      </div>

      <div className="rs-key-list">
        {tasks.map((task, index) => (
          <article className="rs-task rs-task--key" key={task.id || index}>
            <div className="rs-task-num">{index + 1}</div>
            <div className="rs-task-main">
              <div className="rs-task-text">
                {/* В ключе плейсхолдеры уже подставлены: учитель читает задачу
                    так, как её увидит ученик с верными ответами. */}
                <MathRenderer text={resolveStatement(task.statement_md, tasks, index)} />
              </div>
              <div className="rs-key-line">
                <span className="rs-answer-label">
                  Ответ <span className="rs-answer-mark">{circleNum(index)}</span>
                </span>
                <span className="rs-key-value">{task.answer || '—'}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function RouteSheetPrintLayout({
  title,
  tasks = [],
  settings: rawSettings = {},
  screenMode = false,
}) {
  // Лист мог быть сохранён версией без настроек печати вовсе — приводим их к
  // текущей форме здесь, а не в каждом блоке вёрстки.
  const settings = normalizeRouteSettings(rawSettings);
  const solveMm = solveHeightMm(settings);

  const items = useMemo(
    () => tasks.map((t, i) => ({ ...t, __key: `${i}-${t.id || i}`, __no: i })),
    [tasks],
  );

  const [pages, setPages] = useState(null);
  const [tick, setTick] = useState(0);
  const taskRefs = useRef({});
  const headRef = useRef(null);

  // Перемер при смене содержимого и настроек. В ключ входит ТЕКСТ условия:
  // правка задачи не меняет id, но меняет высоту.
  const measureKey = useMemo(() => [
    title, settings.fontSize, settings.solveCells, settings.fill,
    settings.showInstruction, settings.showClassField, settings.instruction,
    items.map(t => `${t.__key}|${t.statement_md || ''}`).join('§'),
  ].join('¦'), [title, settings, items]);

  // Шрифты KaTeX догружаются асинхронно — после готовности меряем заново.
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts?.ready) return undefined;
    let alive = true;
    document.fonts.ready.then(() => { if (alive) setTick(t => t + 1); });
    return () => { alive = false; };
  }, []);

  useLayoutEffect(() => {
    if (!items.length) { setPages([]); return; }

    // Место для решения в DOM не меряется — прибавляем его к «голой» задаче.
    const extraPx = solveMm > 0 ? (solveMm + SOLVE_GAP_MM) * MM : 0;
    const heights = new Map();
    items.forEach((it) => {
      const el = taskRefs.current[it.__key];
      heights.set(it.__key, (el?.offsetHeight || 0) + extraPx);
    });

    const headPx = headRef.current?.offsetHeight || 0;
    const firstCap = Math.max(bodyFirstMm() * MM - headPx, 40 * MM);
    const restCap = bodyRestMm() * MM;

    setPages(paginateByHeight(items, heights, firstCap, restCap, TASK_GAP_MM * MM));
  }, [measureKey, tick, solveMm, items]);

  // 🚨 Чертежи грузятся асинхронно: пока <img> не загружен, его высота 0 —
  // задача меряется короче, чем печатается, и хвост уезжает за лист.
  useEffect(() => {
    const pending = Object.values(taskRefs.current)
      .filter(Boolean)
      .flatMap(el => [...el.querySelectorAll('img')])
      .filter(img => !img.complete);
    if (!pending.length) return undefined;

    const bump = () => setTick(t => t + 1);
    pending.forEach(img => {
      img.addEventListener('load', bump);
      img.addEventListener('error', bump);
    });
    return () => pending.forEach(img => {
      img.removeEventListener('load', bump);
      img.removeEventListener('error', bump);
    });
  }, [measureKey, tick]);

  const header = <Header title={title} settings={settings} />;
  // До первого измерения печатаем всё одной страницей: лучше лишний перенос
  // браузером, чем пустой лист, если печать успела раньше useLayoutEffect.
  const list = pages?.length ? pages : (items.length ? [items] : []);

  const inner = (
    <>
      {/* Фаза измерения — вне экрана, шириной полосы набора. Задачи меряются
          «голыми»: без места для решения. */}
      <div className="rs-measure" aria-hidden="true" style={{ width: `${contentWidthMm()}mm` }}>
        <div ref={headRef}>{header}</div>
        {items.map(it => (
          <div key={it.__key} ref={(el) => { taskRefs.current[it.__key] = el; }}>
            <StudentTask task={it} index={it.__no} settings={settings} />
          </div>
        ))}
      </div>

      {list.map((pageItems, pageIndex) => (
        <section className="rs-page" key={`p${pageIndex}`} style={{ padding: pagePaddingCss() }}>
          {pageIndex === 0 ? header : (
            <div className="rs-runhead">
              <span>{title || 'Маршрутный лист'}</span>
              <span>стр. {pageIndex + 1}</span>
            </div>
          )}

          <div className="rs-chain">
            {pageItems.map(it => (
              <StudentTask
                key={it.__key}
                task={it}
                index={it.__no}
                settings={settings}
                solveMm={solveMm}
              />
            ))}
          </div>
        </section>
      ))}

      {settings.showKey && items.length > 0 && (
        <KeyPage title={title} tasks={tasks} />
      )}
    </>
  );

  const cls = `${screenMode ? 'rs-screen-root' : 'rs-root'} rs-fs-${settings.fontSize}`;
  return <div className={cls}>{inner}</div>;
}
