import MathRenderer from '../MathRenderer';
import { buildCryptogramForVariant } from '../../utils/cryptogram';

/**
 * Компонент листа с ответами ко всем вариантам.
 *
 * @param {Array} variants - массив вариантов
 * @param {string} variantLabel - название варианта
 * @param {boolean} show - показывать ли лист ответов
 * @param {boolean} cryptogramEnabled - включена ли шифровка
 * @param {string} cryptogramPhrase - слово/фраза шифровки
 */
const AnswersPage = ({
  variants = [],
  variantLabel = 'Вариант',
  show = true,
  cryptogramEnabled = false,
  cryptogramPhrase = '',
}) => {
  if (!show || variants.length === 0) return null;

  return (
    <div className="answers-page">
      <h2>{cryptogramEnabled ? 'Ответы и ключ шифровки' : 'Ответы'}</h2>
      {variants.map(variant => (
        (() => {
          const cryptogram = cryptogramEnabled
            ? buildCryptogramForVariant({ variant, phrase: cryptogramPhrase })
            : null;

          return (
            <div key={variant.number} className="variant-answers">
              <h3>
                {variantLabel} {variant.number}
              </h3>

              {cryptogramEnabled && cryptogram?.valid && (
                <div className="answers-cryptogram-box">
                  <div className="answers-cryptogram-title">Секретная фраза:</div>
                  <div className="answers-cryptogram-phrase">{cryptogram.visiblePhrase}</div>
                </div>
              )}

              {cryptogramEnabled && !cryptogram?.valid && (
                <div className="cryptogram-warning" style={{ marginBottom: 12 }}>
                  {cryptogram?.warnings?.join(' ')}
                </div>
              )}

              <div className="answers-grid">
                {variant.tasks.map((task, index) => {
                  const letter = cryptogram?.answerKey?.[index]?.letter;
                  return (
                    <div key={task.id} className="answer-item">
                      <span className="answer-number">{index + 1}.</span>
                      <span className="answer-value">
                        {task.answer ? <MathRenderer text={task.answer} /> : '—'}
                        {cryptogramEnabled && cryptogram?.valid && letter ? (
                          <span className="answer-letter-key"> → {letter}</span>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
      ))}
    </div>
  );
};

export default AnswersPage;
