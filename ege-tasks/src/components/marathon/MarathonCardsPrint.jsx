import MathRenderer from '../../shared/components/MathRenderer';

const DIFFICULTY_COLOR = { 1: '#52c41a', 2: '#faad14', 3: '#ff4d4f' };
const DIFFICULTY_LABEL = { 1: 'Лёгкая', 2: 'Средняя', 3: 'Сложная' };

function MarathonCard({ task, idx, title }) {
  const diff = task.difficulty || 1;
  const color = DIFFICULTY_COLOR[diff] || '#1890ff';
  return (
    <div className="marathon-card">
      {/* Угловые метки для разрезания */}
      <div className="marathon-card__corner marathon-card__corner--tl" />
      <div className="marathon-card__corner marathon-card__corner--tr" />
      <div className="marathon-card__corner marathon-card__corner--bl" />
      <div className="marathon-card__corner marathon-card__corner--br" />

      {/* Шапка */}
      <div className="marathon-card__header" style={{ background: color }}>
        <div className="marathon-card__num">{idx + 1}</div>
        <div className="marathon-card__meta">
          <span className="marathon-card__title-text">{title}</span>
          <span className="marathon-card__diff">{DIFFICULTY_LABEL[diff] || ''}</span>
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
}

/**
 * Печатная вёрстка A6-карточек — 4 на листе A4 (2×2).
 * Каждые 4 карточки = отдельная страница, что исключает наложение при многостраничной печати.
 */
export default function MarathonCardsPrint({ tasks, title }) {
  if (!tasks.length) return null;

  // Разбиваем на страницы по 4 карточки
  const pages = [];
  for (let i = 0; i < tasks.length; i += 4) {
    pages.push(tasks.slice(i, i + 4));
  }

  return (
    <div className="marathon-cards-print-root">
      {pages.map((pageTasks, pageIdx) => (
        <div key={pageIdx} className="marathon-cards-page">
          {/* Горизонтальная линия разреза посередине */}
          <div className="marathon-cut-line marathon-cut-line--h" />
          {/* Вертикальная линия разреза посередине */}
          <div className="marathon-cut-line marathon-cut-line--v" />

          <div className="marathon-cards-grid">
            {pageTasks.map((task, slotIdx) => (
              <MarathonCard
                key={task.id}
                task={task}
                idx={pageIdx * 4 + slotIdx}
                title={title}
              />
            ))}
            {/* Пустые слоты для последней неполной страницы */}
            {Array.from({ length: 4 - pageTasks.length }).map((_, i) => (
              <div key={`empty-${i}`} className="marathon-card marathon-card--empty" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
