import { useEffect, useMemo, useState } from 'react';
import { api } from '../../services/pocketbase';
import TaskStatementRenderer from '../TaskStatementRenderer';
import { variantTaskIds, pickVariant } from '../../utils/workShowLink';
// Вёрстка общая со ссылкой на геометрическую работу (/w/<id>) — оба экрана
// ученик видит одинаково.
import '../geometry/student/studentGeometryWork.css';

const pickKey = (id) => `workshow.variant.${id}`;
const readPick = (id) => {
  try {
    const raw = localStorage.getItem(pickKey(id));
    const v = raw == null || raw === '' ? NaN : Number(raw);
    return Number.isInteger(v) && v >= 1 ? v : null;
  } catch { return null; }
};
const savePick = (id, v) => {
  try {
    if (v == null) localStorage.removeItem(pickKey(id));
    else localStorage.setItem(pickKey(id), String(v));
  } catch { /* приватное окно — выбор просто не запомнится */ }
};

const variantTitle = (v) => `Вариант ${v.number}`;

/**
 * Работа из «Моих работ» для ученика в режиме показа: student.oipav.ru/r/<id>
 * (выбор варианта) или /r/<id>?v=N (свой вариант). Не выдача: ни попытки, ни
 * поля ответа — условия для разбора в классе или ДЗ, решение в тетради.
 * Ответов и решений страница не запрашивает.
 */
export default function StudentWorkShow({ id, variant: fixed = null }) {
  const [work, setWork] = useState(undefined); // undefined — грузим, null — закрыта
  const [variants, setVariants] = useState([]);
  const [tasks, setTasks] = useState(null);
  const [images, setImages] = useState(new Map());
  const [picked, setPicked] = useState(() => (fixed == null ? readPick(id) : null));

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const w = await api.getShownWork(id);
        if (!alive) return;
        if (!w) { setWork(null); return; }
        const vs = await api.getShownWorkVariants(id);
        if (!alive) return;
        setVariants(vs);
        setWork(w);
        const ids = [...new Set(vs.flatMap(variantTaskIds))];
        const [list, imgs] = await Promise.all([api.getShownTasks(ids), api.getShownTaskImages(ids)]);
        if (!alive) return;
        const byTask = new Map();
        for (const rec of imgs) {
          if (!byTask.has(rec.task)) byTask.set(rec.task, []);
          byTask.get(rec.task).push(rec);
        }
        setImages(byTask);
        setTasks(new Map(list.map((t) => [t.id, t])));
      } catch {
        if (alive) { setWork((w) => (w === undefined ? null : w)); setTasks((t) => t || new Map()); }
      }
    })();
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    if (work?.title) document.title = `${work.title} — Lemma`;
  }, [work?.title]);

  const single = variants.length === 1 ? variants[0] : null;
  const current = single
    || (fixed != null ? pickVariant(variants, fixed) : pickVariant(variants, picked));
  const taskIds = useMemo(() => (current ? variantTaskIds(current) : []), [current]);

  const choose = (n) => { setPicked(n); savePick(id, n); window.scrollTo?.(0, 0); };

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

  const canSwitch = fixed == null && !single && current;
  // Ссылка варианта, которого в работе уже нет, — даём выбрать из тех, что есть.
  const showPicker = !current && variants.length > 0;

  return (
    <div className="sgw">
      <header className="sgw-head">
        <div className="sgw-head__brand">Lemma · Задания</div>
        <h1 className="sgw-head__title">{work.title}</h1>
        <div className="sgw-head__meta">
          {work.class ? <span>{work.class} класс</span> : null}
          {current && variants.length > 1 && <span className="sgw-head__variant">{variantTitle(current)}</span>}
          {canSwitch && (
            <button type="button" className="sgw-link" onClick={() => choose(null)}>сменить вариант</button>
          )}
        </div>
      </header>

      {variants.length === 0 ? (
        <main className="sgw-tasks"><div className="sgw-empty"><p>В работе пока нет заданий.</p></div></main>
      ) : showPicker ? (
        <main className="sgw-pick">
          <p>Выберите свой вариант — его назовёт учитель.</p>
          <div className="sgw-pick__list">
            {variants.map((v) => (
              <button key={v.id} type="button" className="sgw-pick__btn" onClick={() => choose(v.number)}>
                {variantTitle(v)}
              </button>
            ))}
          </div>
        </main>
      ) : (
        <main className="sgw-tasks">
          {!tasks ? (
            <div className="sgw-empty"><div className="ssb__spinner" aria-hidden /></div>
          ) : taskIds.length === 0 ? (
            <div className="sgw-empty"><p>В этом варианте пока нет заданий.</p></div>
          ) : taskIds.map((taskId, i) => {
            const task = tasks.get(taskId);
            const pic = task?.has_image && task.image ? api.getTaskImageUrl(task) : '';
            return (
              <section key={`${i}-${taskId}`} className="sgw-task">
                <div className="sgw-task__no">{i + 1}</div>
                <div className="sgw-task__body">
                  {task ? (
                    <>
                      <TaskStatementRenderer text={task.statement_md || ''} images={images.get(taskId) || []} />
                      {pic && <div className="sgw-figure"><img src={pic} alt="Рисунок к задаче" loading="lazy" /></div>}
                    </>
                  ) : <p className="sgw-muted">Задача недоступна</p>}
                </div>
              </section>
            );
          })}
          <p className="sgw-foot">Решайте в тетради — записывайте решение полностью.</p>
        </main>
      )}
    </div>
  );
}
