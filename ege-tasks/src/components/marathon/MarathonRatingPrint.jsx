/**
 * Бумажный бланк рейтинга — таблица для учителя:
 * строки = ученики, столбцы = задачи + итого
 */
export default function MarathonRatingPrint({ students, taskCount, title }) {
  if (!students.length || !taskCount) return null;

  const cols = Array.from({ length: taskCount }, (_, i) => i + 1);

  return (
    <div className="marathon-rating-print-root">
      <div className="marathon-rating__header">
        <h2>{title} — Рейтинговый лист</h2>
        <div className="marathon-rating__legend">
          <span>✓ — сдано</span>
          <span>— — попытка не засчитана</span>
          <span>○ ○ ○ — три попытки на задачу</span>
        </div>
      </div>

      <table className="marathon-rating__table">
        <thead>
          <tr>
            <th className="marathon-rating__col-name">Ученик</th>
            {cols.map(n => (
              <th key={n} className="marathon-rating__col-task">{n}</th>
            ))}
            <th className="marathon-rating__col-total">Итого</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, idx) => (
            <tr key={student} className={idx % 2 === 0 ? 'marathon-rating__row--even' : ''}>
              <td className="marathon-rating__col-name">{student}</td>
              {cols.map(n => (
                <td key={n} className="marathon-rating__col-task">
                  <div className="marathon-rating__attempts">
                    <span>○</span>
                    <span>○</span>
                    <span>○</span>
                  </div>
                </td>
              ))}
              <td className="marathon-rating__col-total"></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
