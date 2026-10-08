import MathRenderer from '../MathRenderer';
import './kimAnswersSheet.css';

/**
 * Лист ответов учителю к КИМ-буклету (база, профиль, ОГЭ) — A4, в языке
 * буклета: Times, номер задания в квадрате, только чёрная краска, иерархия —
 * толщиной линеек. Ответы — ОДНИМ столбцом (№ · ответ · код задачи): так
 * лист кладётся рядом с бланком ученика и проверяется сверху вниз; каждая
 * пятая строка отбита линией потолще, чтобы глаз не терял строку.
 *
 * Номер варианта — тот же, что в шапке буклета (`kimMeta.variantNumberOverride`),
 * иначе лист и буклет разошлись бы.
 *
 * @param {Array} variants — [{ number, tasks }]
 * @param {Object} kimMeta — { variantNumberOverride, classNum }
 * @param {string} title — название работы (если сохранена)
 * @param {string} examLabel — «ЕГЭ, базовый уровень» и т. п.
 * @param {number|null} part1Last — последний номер с кратким ответом;
 *   дальше — часть 2 (развёрнутые решения с баллами). null — части 2 нет.
 * @param {boolean} preview — показать лист на экране («Как в печати»)
 */
export default function KimAnswersSheet({
  variants = [], kimMeta = {}, title = '', examLabel = '', part1Last = null, preview = false,
}) {
  if (!variants.length) return null;
  const meta = [examLabel, kimMeta.classNum ? `${kimMeta.classNum} класс` : ''].filter(Boolean).join(' · ');

  return (
    <div className={`kim-answers-sheet${preview ? ' kim-answers-sheet--preview' : ''}`}>
      <div className="kas">
        {variants.map((variant, vi) => {
          const tasks = (variant.tasks || []).map((t, i) => ({ ...t, kimNumber: i + 1 }));
          const short = part1Last ? tasks.filter((t) => t.kimNumber <= part1Last) : tasks;
          const long = part1Last ? tasks.filter((t) => t.kimNumber > part1Last) : [];
          const number = kimMeta.variantNumberOverride || variant.number;

          return (
            <section key={variant.number ?? vi} className="kas-variant">
              <header className="kas-head">
                <div className="kas-over">Лист ответов для учителя</div>
                <div className="kas-title">{title || 'Ответы'}</div>
                <div className="kas-meta">
                  {meta && <span>{meta}</span>}
                  <span className="kas-variant-no">Вариант {number}</span>
                </div>
              </header>

              {short.length > 0 && (
                <>
                  {long.length > 0 && <div className="kas-part">Часть 1 · краткий ответ</div>}
                  <table className="kas-table">
                    <colgroup>
                      <col className="kas-col-num" />
                      <col />
                      <col className="kas-col-code" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>№</th>
                        <th className="kas-th-answer">Ответ</th>
                        <th className="kas-th-code">Код</th>
                      </tr>
                    </thead>
                    <tbody>
                      {short.map((task) => (
                        <tr key={task.id} className={task.kimNumber % 5 === 0 ? 'kas-row--group' : undefined}>
                          <td className="kas-num"><span className="kas-box">{task.kimNumber}</span></td>
                          <td className="kas-answer">
                            {task.answer ? <MathRenderer text={task.answer} /> : <span className="kas-empty">ответ не задан</span>}
                          </td>
                          <td className="kas-code">{task.code || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}

              {long.length > 0 && (
                <>
                  <div className="kas-part">Часть 2 · развёрнутый ответ</div>
                  {long.map((task) => (
                    <div key={task.id} className="kas-solution">
                      <div className="kas-solution-head">
                        <span className="kas-box">{task.kimNumber}</span>
                        {task.max_score ? <span className="kas-score">{task.max_score} б.</span> : null}
                        {task.code && <span className="kas-code">{task.code}</span>}
                      </div>
                      <div className="kas-solution-body">
                        {task.solution_md ? <MathRenderer text={task.solution_md} /> : null}
                        {task.answer ? (
                          <div className="kas-solution-answer">
                            <b>Ответ:</b> <MathRenderer text={task.answer} />
                          </div>
                        ) : null}
                        {!task.solution_md && !task.answer && (
                          <span className="kas-empty">решение не задано</span>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
