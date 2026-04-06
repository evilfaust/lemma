import MathRenderer from '../../shared/components/MathRenderer';

/**
 * Компактный лист учителя — два столбца:
 * 1. Условие: «№N. [условие] Ответ: [ответ]»
 * 2. Решение / Подсказка
 */
export default function MarathonTeacherSheet({ tasks, title }) {
  if (!tasks.length) return null;

  return (
    <div className="marathon-teacher-print-root">
      <div className="marathon-teacher__header">
        <h2>{title} — Лист учителя</h2>
      </div>

      <table className="marathon-teacher__table">
        <thead>
          <tr>
            <th className="marathon-teacher__col-statement">Условие и ответ</th>
            <th className="marathon-teacher__col-solution">Решение / Подсказка</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, idx) => (
            <tr key={task.id} className={idx % 2 === 0 ? 'marathon-teacher__row--even' : ''}>
              <td className="marathon-teacher__col-statement">
                {task.image_url && (
                  <img
                    src={task.image_url}
                    alt=""
                    style={{ maxWidth: 80, maxHeight: 60, float: 'right', marginLeft: 4 }}
                    crossOrigin="anonymous"
                  />
                )}
                <span className="marathon-teacher__task-num">{idx + 1}.</span>{' '}
                <MathRenderer content={task.statement_md || ''} inline />
                {task.answer && (
                  <div className="marathon-teacher__answer">
                    <strong>Ответ:</strong>{' '}
                    <MathRenderer content={task.answer} />
                  </div>
                )}
              </td>
              <td className="marathon-teacher__col-solution">
                <MathRenderer content={task.solution_md || ''} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
