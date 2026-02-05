import MathRenderer from '../MathRenderer';

/**
 * Компонент листа с ответами ко всем вариантам.
 *
 * @param {Array} variants - массив вариантов
 * @param {string} variantLabel - название варианта
 * @param {boolean} show - показывать ли лист ответов
 */
const AnswersPage = ({
  variants = [],
  variantLabel = 'Вариант',
  show = true,
}) => {
  if (!show || variants.length === 0) return null;

  return (
    <div className="answers-page">
      <h2>Ответы</h2>
      {variants.map(variant => (
        <div key={variant.number} className="variant-answers">
          <h3>
            {variantLabel} {variant.number}
          </h3>
          <div className="answers-grid">
            {variant.tasks.map((task, index) => (
              <div key={task.id} className="answer-item">
                <span className="answer-number">{index + 1}.</span>
                <span className="answer-value">
                  {task.answer ? <MathRenderer text={task.answer} /> : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AnswersPage;
