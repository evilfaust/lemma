import MathRenderer from '../MathRenderer';
import { buildCryptogramForVariant } from '../../utils/cryptogram';

const DEFAULT_NOTE = 'Решите задачи, найдите каждый ответ в таблице и запишите буквы по порядку.';
const NUMBERED_NOTE = 'Найдите свой ответ в таблице и впишите его букву в клетки с номерами, '
  + 'которые стоят у задачи. Лишние строки таблицы — обманки.';

/**
 * Шифровка по ответам — блок печатного листа (хвост варианта или самостоятельный
 * лист «Шифровки»).
 *
 * Монохром, как и весь лист: обманки ничем не помечены — иначе ученик отсеет их
 * глазами, не решая. Блок участвует в пагинации наравне с задачами: не влез в
 * остаток страницы — уезжает на следующую целиком.
 *
 * @param {Object} crypt — готовая шифровка. Если не передана, строится из
 *   `variant` + `phrase`. 🚨 Две копии одного листа обязаны получать ОДИН
 *   объект: таблица перемешивается сидом от номера варианта, и пересчёт на
 *   месте дал бы разный порядок строк у двух половинок одного листа.
 * @param {'rows'|'chips'} layout — строка «ответ | буква» сеткой (лист задач)
 *   или карточка «ответ над буквой» (лист шифровки: при 12–20 записях экономит
 *   треть высоты блока).
 * @param {boolean} numbered — под клетками ответа стоят номера позиций. Нужен,
 *   когда номер задачи заменён номерами клеток (`task.numberLabel`).
 * @param {string} definition — «Узнай: …» под строкой ответа.
 * @param {string} note — подсказка под заголовком. Пустая строка убирает её
 *   совсем: на листе с полной шапкой инструкция уже сказана там.
 */
export default function SheetCryptogram({
  variant,
  phrase,
  crypt: ready,
  layout = 'rows',
  numbered = false,
  definition = '',
  note,
  title = 'Шифровка по ответам',
}) {
  const crypt = ready || buildCryptogramForVariant({ variant, phrase });
  const className = [
    'ps-crypt',
    layout === 'chips' ? 'ps-crypt--chips' : '',
    numbered ? 'ps-crypt--numbered' : '',
  ].filter(Boolean).join(' ');

  return (
    <section className={className}>
      <div className="ps-crypt-title">{title}</div>

      {crypt?.valid ? (
        <>
          {note !== '' && (
            <div className="ps-crypt-note">
              {note || (numbered ? NUMBERED_NOTE : DEFAULT_NOTE)}
            </div>
          )}

          <div className="ps-crypt-grid">
            {crypt.entries.map((entry, index) => (
              <div className="ps-crypt-cell" key={`${entry.letter}-${entry.answer}-${index}`}>
                <span className="ps-crypt-answer"><MathRenderer text={entry.answer} /></span>
                <span className="ps-crypt-letter">{entry.letter}</span>
              </div>
            ))}
          </div>

          <div className="ps-crypt-result">
            <div className="ps-crypt-result-label">Получившееся слово / фраза:</div>
            <div className="ps-crypt-cells">
              {crypt.answerCells.map((cell, index) => (
                cell.type === 'space'
                  ? <span key={`space-${index}`} className="ps-crypt-gap" />
                  : (
                    <span key={`cell-${index}`} className="ps-crypt-slot">
                      <span className="ps-crypt-box" />
                      {numbered && <span className="ps-crypt-slot-num">{cell.posNum}</span>}
                    </span>
                  )
              ))}
            </div>
          </div>

          {definition && (
            <div className="ps-crypt-def">
              <span className="ps-crypt-def-label">Узнай: </span>{definition}
            </div>
          )}
        </>
      ) : (
        <div className="ps-crypt-warn">{crypt?.warnings?.join(' ')}</div>
      )}
    </section>
  );
}
