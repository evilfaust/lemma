import MathRenderer from '../../shared/components/MathRenderer';

const DIFFICULTY_LABEL = { 1: '●', 2: '●●', 3: '●●●' };
const DIFFICULTY_COLOR = { 1: '#52c41a', 2: '#faad14', 3: '#ff4d4f' };

/**
 * Компактный лист учителя — все задачи с ответами и решениями.
 * A4, видна только при печати.
 */
export default function MarathonTeacherSheet({ tasks, title }) {
  if (!tasks.length) return null;

  return (
    <div className="marathon-teacher-print-root">
      <div className="marathon-teacher__header">
        <h2>{title} — Лист учителя</h2>
        <p className="marathon-teacher__hint">
          Документ конфиденциальный. Не раздавать ученикам.
        </p>
      </div>

      <table className="marathon-teacher__table">
        <thead>
          <tr>
            <th className="marathon-teacher__col-num">№</th>
            <th className="marathon-teacher__col-diff">Сл.</th>
            <th className="marathon-teacher__col-statement">Условие</th>
            <th className="marathon-teacher__col-answer">Ответ</th>
            <th className="marathon-teacher__col-solution">Решение / Подсказка</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, idx) => {
            const diff = task.difficulty || 1;
            const color = DIFFICULTY_COLOR[diff];
            return (
              <tr key={task.id} className={idx % 2 === 0 ? 'marathon-teacher__row--even' : ''}>
                <td className="marathon-teacher__col-num">{idx + 1}</td>
                <td className="marathon-teacher__col-diff">
                  <span style={{ color, fontWeight: 600, fontSize: 10 }}>
                    {DIFFICULTY_LABEL[diff]}
                  </span>
                </td>
                <td className="marathon-teacher__col-statement">
                  {task.image_url && (
                    <img
                      src={task.image_url}
                      alt=""
                      style={{ maxWidth: 80, maxHeight: 60, float: 'right', marginLeft: 4 }}
                      crossOrigin="anonymous"
                    />
                  )}
                  <MathRenderer content={task.statement_md || ''} />
                </td>
                <td className="marathon-teacher__col-answer">
                  <strong><MathRenderer content={task.answer || '—'} /></strong>
                </td>
                <td className="marathon-teacher__col-solution">
                  <MathRenderer content={task.solution_md || ''} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
