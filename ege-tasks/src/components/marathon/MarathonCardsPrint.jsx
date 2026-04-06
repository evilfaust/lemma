import MathRenderer from '../../shared/components/MathRenderer';

const DIFFICULTY_COLOR = { 1: '#52c41a', 2: '#faad14', 3: '#ff4d4f' };
const DIFFICULTY_LABEL = { 1: 'Лёгкая', 2: 'Средняя', 3: 'Сложная' };

/**
 * Печатная вёрстка A6-карточек — 4 на листе A4.
 * Монтируется вне основного контейнера, видна только при печати.
 */
export default function MarathonCardsPrint({ tasks, title, className = '' }) {
  if (!tasks.length) return null;

  return (
    <div className={`marathon-cards-print-root ${className}`}>
      <div className="marathon-cards-grid">
        {tasks.map((task, idx) => {
          const diff = task.difficulty || 1;
          const color = DIFFICULTY_COLOR[diff] || '#1890ff';
          return (
            <div key={task.id} className="marathon-card">
              {/* Шапка */}
              <div className="marathon-card__header" style={{ borderColor: color }}>
                <div className="marathon-card__num" style={{ background: color }}>
                  {idx + 1}
                </div>
                <div className="marathon-card__meta">
                  <span className="marathon-card__title-text">{title}</span>
                  <span className="marathon-card__diff" style={{ color }}>
                    {DIFFICULTY_LABEL[diff] || ''}
                  </span>
                </div>
              </div>
              {/* Условие */}
              <div className="marathon-card__body">
                {task.image_url && (
                  <img
                    src={task.image_url}
                    alt=""
                    className="marathon-card__image"
                    crossOrigin="anonymous"
                  />
                )}
                <MathRenderer content={task.statement_md || ''} />
              </div>
              {/* Подвал */}
              <div className="marathon-card__footer">
                <span>Задача № {idx + 1}</span>
                <span className="marathon-card__name-field">Ученик: ____________________</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
