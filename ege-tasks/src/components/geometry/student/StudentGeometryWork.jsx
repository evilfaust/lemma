import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../shared/services/pocketbase';
import MathRenderer from '../../MathRenderer';
import TheoryStereoBlock from '../../stereo/TheoryStereoBlock';
import PlanimLiveBlock from '../../planim/PlanimLiveBlock';
import { sanitizeSvg } from '../../../utils/sanitizeSvg';
import { stereoSpecFromSvg } from '../../../utils/stereo/dsl';
import { planimSpecFromSvg } from '../../../utils/planim/dsl';
import { variantLabel } from '../../../utils/geometryWork';
import { variantItems, variantCount } from '../../../utils/geometryWorkLink';
import './studentGeometryWork.css';
import { CabinetLink } from '../../../student/pwa/InstallApp';

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

/**
 * Чертёж условия по уровню показа, который выбрал учитель (v3.9.377,
 * utils/geometryDrawings.js). Уровень и сам чертёж приходят с сервера уже
 * отрезанными (хук geometry_work.pb.js): скрытого чертежа здесь просто нет.
 *   none  — только условие; если чертёж у задачи есть — «сделайте его сами»;
 *   image — картинка (SVG без исходника или PNG);
 *   live  — объёмный крутится, плоский сдвигается и увеличивается;
 *   steps — то же + построение по шагам с самого начала.
 * Чертёж решения (image_role = solution) сервер не отдаёт никогда.
 */
function TaskFigure({ task }) {
  const level = task.level || 'image';
  if (level === 'none') {
    return task.has_drawing ? <p className="sgw-selfdraw">Чертёж к задаче сделайте сами.</p> : null;
  }
  if (task.drawing_svg) {
    if (level === 'live' || level === 'steps') {
      const stereo = stereoSpecFromSvg(task.drawing_svg);
      if (stereo) {
        return (
          <div className="sgw-figure sgw-figure--live">
            <TheoryStereoBlock spec={stereo} steps={level === 'steps'} startAt="start" />
          </div>
        );
      }
      const planim = planimSpecFromSvg(task.drawing_svg);
      if (planim) {
        return (
          <div className="sgw-figure sgw-figure--live">
            <PlanimLiveBlock spec={planim} steps={level === 'steps'} />
          </div>
        );
      }
    }
    return (
      <div
        className="sgw-figure sgw-figure--svg"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: sanitizeSvg(task.drawing_svg) }}
      />
    );
  }
  const url = api.getGeometryImageUrl(task);
  return url ? <div className="sgw-figure"><img src={url} alt="Чертёж к задаче" loading="lazy" /></div> : null;
}

/** Работа с сервера → структура для variantItems: { variants: [{ items: [{task}|null] }] }. */
const structureOf = (w) => ({
  variants: (w?.variants || [[]]).map((v) => ({ items: (v || []).map((t) => (t ? { task: t } : null)) })),
});

/** Подсказка внизу: про живые чертежи говорим, только если они есть. */
function footNote(tasks) {
  const levels = new Set(tasks.map((t) => t?.level));
  const kinds = new Set(tasks.filter((t) => t?.level === 'live' || t?.level === 'steps').map((t) => t.kind));
  const parts = ['Решайте в тетради.'];
  if (kinds.has('stereo')) parts.push('Объёмный чертёж можно поворачивать пальцем или мышью.');
  if (kinds.has('planim')) parts.push('Плоский чертёж можно сдвигать и увеличивать.');
  if (levels.has('steps')) parts.push('Построение листается по шагам ◀ ▶.');
  return parts.join(' ');
}

/**
 * Работа по геометрии для ученика: student.oipav.ru/w/<id> (выбор варианта)
 * или /w/<id>?v=N (свой вариант). Без входа, только условия и чертежи —
 * ответов и решений сервер не отдаёт: ученик решает в тетради. Какие чертежи
 * видны и как (картинка / живой / по шагам) — решает учитель (v3.9.377).
 */
export default function StudentGeometryWork({ id, variant: fixed = null }) {
  const [work, setWork] = useState(undefined); // undefined — грузим, null — закрыта
  const [tasks, setTasks] = useState(null);
  const [picked, setPicked] = useState(() => (fixed == null ? readPick(id) : null));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const w = await api.getStudentGeometryWork(id);
        if (!alive) return;
        setWork(w ? { ...w, structure: structureOf(w) } : null);
        if (w) setTasks(new Map((w.tasks || []).map((t) => [t.id, t])));
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
          <CabinetLink className="pwa-cabinet-link--block" />
          <p><b>Работа недоступна</b></p>
          <p>Учитель закрыл ссылку или удалил работу.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sgw">
      <header className="sgw-head">
        <CabinetLink className="pwa-cabinet-link--block" />
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
          <p className="sgw-foot">{footNote(items.map(({ taskId }) => tasks?.get(taskId)))}</p>
        </main>
      )}
    </div>
  );
}
