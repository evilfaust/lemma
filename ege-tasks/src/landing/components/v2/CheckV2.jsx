// Макет проверки бумажного бланка: ответы прочитаны с фото дважды,
// расхождение подсвечено — учитель выбирает одним кликом.
const BLANK_ROWS = [
  { n: 1, read: '12', ok: true },
  { n: 2, read: '0,25', ok: true },
  { n: 3, read: '−3', ok: false, expected: '3' },
  { n: 4, read: '0,6', ok: true, unsure: '0,8' },
  { n: 5, read: '17', ok: true },
  { n: 6, read: '2,5', ok: true },
]

const METRICS = [
  {
    title: 'Онлайн — проверено сразу',
    desc: 'Дроби, корни и π понимаются как числа: 0,5 = 1/2. Спорный ответ учитель засчитывает вручную — балл пересчитается у ученика.',
  },
  {
    title: 'Бумага — фото с телефона',
    desc: 'Снимаете бланк ответов, ИИ читает его дважды и подсвечивает сомнительные клетки. Или вводите ответы руками — результат встаёт в журнал класса.',
  },
  {
    title: 'Ещё попытка — тем, кому нужно',
    desc: '«Ещё попытка» ученикам ниже порога одной кнопкой; ученик видит её сразу, без перезагрузки.',
  },
  {
    title: 'Видно, где класс теряет баллы',
    desc: 'Тепловая карта «ученик × задание», адресная работа над ошибками одной кнопкой и Excel для деканата: задания 1/0, успеваемость и качество знаний.',
  },
]

const CheckV2 = () => (
  <section className="v2-progress v2-section" id="check">
    <div className="v2-progress-bg" />
    <div className="v2-container">
      <div className="v2-section-header v2-reveal">
        <span className="v2-label">3 · Проверить</span>
        <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
          Проверка — <span className="v2-gradient-text">за минуты</span>, а не за вечер
        </h2>
        <p>Онлайн-тесты проверяются сами, бумажные бланки — по фотографии.</p>
      </div>

      <div className="v2-progress-layout v2-reveal">
        <div className="v2-progress-board v2-stagger">
          <div className="v2-progress-board-head">
            <span>Бланк ответов · Абрамова Анна</span>
            <span className="v2-progress-pill">5 из 6</span>
          </div>

          <div className="v2-blank">
            <div className="v2-blank-row v2-blank-row--head">
              <span>№</span><span>Распознано</span><span>Итог</span>
            </div>
            {BLANK_ROWS.map(row => (
              <div key={row.n} className={`v2-blank-row ${row.unsure ? 'v2-blank-row--unsure' : ''}`}>
                <span className="v2-blank-n">{row.n}</span>
                <span className="v2-blank-read">
                  {row.read}
                  {row.unsure && <span className="v2-blank-alt">или {row.unsure}?</span>}
                  {row.expected && <span className="v2-blank-expected">верно: {row.expected}</span>}
                </span>
                <span className={row.ok ? 'v2-blank-ok' : 'v2-blank-bad'}>{row.ok ? '✓' : '✗'}</span>
              </div>
            ))}
          </div>

          <div className="v2-progress-problems">
            <div className="v2-progress-problems-title">Прочитано дважды</div>
            <div className="v2-problem-row">
              <span>Задание 4: 0,6 или 0,8</span>
              <span>выберите вариант</span>
            </div>
          </div>
        </div>

        <div className="v2-progress-cards">
          {METRICS.map(metric => (
            <article key={metric.title} className="v2-progress-card v2-stagger">
              <h3>{metric.title}</h3>
              <p>{metric.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  </section>
)

export default CheckV2
