/**
 * Бумажный бланк рейтинга — таблица для учителя:
 * строки = ученики, столбцы = задачи (попытки + очки) + итого
 * Печать: альбомная ориентация
 */
export default function MarathonRatingPrint({ students, taskCount, title }) {
  if (!students.length || !taskCount) return null;

  const cols = Array.from({ length: taskCount }, (_, i) => i + 1);

  return (
    <div className="marathon-rating-print-root">
      <div className="marathon-rating__header">
        <h2>{title} — Рейтинговый лист</h2>
        <div className="marathon-rating__legend">
          <span className="marathon-rating__legend-item marathon-rating__legend-item--3">+3 — с первой попытки</span>
          <span className="marathon-rating__legend-item marathon-rating__legend-item--2">+2 — со второй попытки</span>
          <span className="marathon-rating__legend-item marathon-rating__legend-item--1">+1 — с третьей попытки</span>
          <span className="marathon-rating__legend-item marathon-rating__legend-item--0">0 — три неудачи</span>
          <span className="marathon-rating__legend-item marathon-rating__legend-item--hint">○ ○ ○ — отметки попыток</span>
        </div>
      </div>

      <table className="marathon-rating__table">
        <thead>
          <tr>
            <th className="marathon-rating__col-name" rowSpan={2}>Ученик</th>
            {cols.map(n => (
              <th key={n} className="marathon-rating__col-task-header" colSpan={2}>{n}</th>
            ))}
            <th className="marathon-rating__col-total" rowSpan={2}>Итого</th>
          </tr>
          <tr>
            {cols.map(n => (
              <>
                <th key={`${n}-att`} className="marathon-rating__col-sub">попытки</th>
                <th key={`${n}-score`} className="marathon-rating__col-sub">очки</th>
              </>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((student, idx) => (
            <tr key={student} className={idx % 2 === 0 ? 'marathon-rating__row--even' : ''}>
              <td className="marathon-rating__col-name">{student}</td>
              {cols.map(n => (
                <>
                  <td key={`${n}-att`} className="marathon-rating__col-task">
                    <div className="marathon-rating__attempts">
                      <span>○</span>
                      <span>○</span>
                      <span>○</span>
                    </div>
                  </td>
                  <td key={`${n}-score`} className="marathon-rating__col-score"></td>
                </>
              ))}
              <td className="marathon-rating__col-total"></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
