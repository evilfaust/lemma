import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../shared/services/pocketbase';
import MathRenderer from '../../MathRenderer';
import TheoryStereoBlock from '../../stereo/TheoryStereoBlock';
import { sanitizeSvg } from '../../../utils/sanitizeSvg';
import { stereoSpecFromSvg } from '../../../utils/stereo/dsl';
import { normalizeStructure, structureTaskIds, variantLabel } from '../../../utils/geometryWork';
import { variantItems, variantCount } from '../../../utils/geometryWorkLink';
import './studentGeometryWork.css';

const pickKey = (id) => `gwork.variant.${id}`;
const readPick = (id) => {
  try {
    const raw = localStorage.getItem(pickKey(id));
    const v = raw == null || raw === '' ? NaN : Number(raw); // Number(null) = 0 — не «выбран первый»
    return Number.isInteger(v) && v >= 0 ? v : null;
  } catch { return null; }
};
const savePick = (id, v) => {
  try {
    if (v == null) localStorage.removeItem(pickKey(id));
    else localStorage.setItem(pickKey(id), String(v));
  } catch { /* приватное окно — выбор просто не запомнится */ }
};

/** Чертёж условия: стереочертёж крутится, остальное — картинкой. Чертёж решения не показываем. */
function TaskFigure({ task }) {
  if (task.drawing_view === 'svg' && task.drawing_svg) {
    const spec = stereoSpecFromSvg(task.drawing_svg);
    if (spec) return <div className="sgw-figure sgw-figure--live"><TheoryStereoBlock spec={spec} steps={false} /></div>;
    return (
      <div
        className="sgw-figure sgw-figure--svg"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: sanitizeSvg(task.drawing_svg) }}
      />
    );
  }
  if (task.image_role === 'solution') return null;
  const url = api.getGeometryImageUrl(task);
  return url ? <div className="sgw-figure"><img src={url} alt="Чертёж к задаче" loading="lazy" /></div> : null;
}

/**
 * Работа по геометрии для ученика: student.oipav.ru/w/<id> (выбор варианта)
 * или /w/<id>?v=N (свой вариант). Без входа, только условия и чертежи —
 * ответов и решений страница не запрашивает: ученик решает в тетради.
 * Стереочертёж условия можно поворачивать.
 */
export default function StudentGeometryWork({ id, variant: fixed = null }) {
  const [work, setWork] = useState(undefined); // undefined — грузим, null — закрыта
  const [tasks, setTasks] = useState(null);
  const [picked, setPicked] = useState(() => (fixed == null ? readPick(id) : null));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const w = await api.getPublicGeometryWork(id);
        if (!alive) return;
        setWork(w);
        if (!w) return;
        const list = await api.getStudentGeometryTasks(structureTaskIds(normalizeStructure(w.structure)));
        if (alive) setTasks(new Map(list.map((t) => [t.id, t])));
      } catch {
        if (alive) { setWork((w) => (w === undefined ? null : w)); setTasks((t) => t || new Map()); }
      }
    })();
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    if (work?.title) document.title = `${work.title} — Lemma`;
  }, [work?.title]);

  const count = work ? variantCount(work.structure) : 1;
  const variant = fixed != null ? Math.min(fixed, count - 1) : count === 1 ? 0 : (picked != null && picked < count ? picked : null);
  const items = useMemo(
    () => (work && variant != null ? variantItems(work.structure, variant) : []),
    [work, variant],
  );

  const choose = (v) => { setPicked(v); savePick(id, v); window.scrollTo?.(0, 0); };

  if (work === undefined) {
    return <div className="sgw"><div className="sgw-empty"><div className="ssb__spinner" aria-hidden /></div></div>;
  }
  if (!work) {
    return (
      <div className="sgw">
        <div className="sgw-empty">
          <p><b>Работа недоступна</b></p>
          <p>Учитель закрыл ссылку или удалил работу.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sgw">
      <header className="sgw-head">
        <div className="sgw-head__brand">Lemma · Геометрия</div>
        <h1 className="sgw-head__title">{work.title}</h1>
        <div className="sgw-head__meta">
          {work.class ? <span>{work.class} класс</span> : null}
          {variant != null && count > 1 && <span className="sgw-head__variant">{variantLabel(variant)}</span>}
          {fixed == null && variant != null && count > 1 && (
            <button type="button" className="sgw-link" onClick={() => choose(null)}>сменить вариант</button>
          )}
        </div>
      </header>

      {variant == null ? (
        <main className="sgw-pick">
          <p>Выберите свой вариант — его назовёт учитель.</p>
          <div className="sgw-pick__list">
            {Array.from({ length: count }, (_, v) => (
              <button key={v} type="button" className="sgw-pick__btn" onClick={() => choose(v)}>
                {variantLabel(v)}
              </button>
            ))}
          </div>
        </main>
      ) : (
        <main className="sgw-tasks">
          {!tasks ? (
            <div className="sgw-empty"><div className="ssb__spinner" aria-hidden /></div>
          ) : items.length === 0 ? (
            <div className="sgw-empty"><p>В этом варианте пока нет заданий.</p></div>
          ) : items.map(({ no, taskId }) => {
            const task = tasks.get(taskId);
            return (
              <section key={`${no}-${taskId}`} className="sgw-task">
                <div className="sgw-task__no">{no}</div>
                <div className="sgw-task__body">
                  {task ? (
                    <>
                      <MathRenderer text={task.statement_md || ''} />
                      <TaskFigure task={task} />
                    </>
                  ) : <p className="sgw-muted">Задача недоступна</p>}
                </div>
              </section>
            );
          })}
          <p className="sgw-foot">Решайте в тетради. Объёмный чертёж можно поворачивать пальцем или мышью.</p>
        </main>
      )}
    </div>
  );
}
