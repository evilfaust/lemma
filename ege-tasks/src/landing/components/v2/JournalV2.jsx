// Макет журнала класса: бумажные и онлайн-колонки в одной сетке.
// Имена вымышленные.
const COLUMNS = [
  { title: 'Устный счёт', sub: 'из 20' },
  { title: 'Тест', sub: 'онлайн', online: true },
  { title: 'Сам. работа', sub: '2–5' },
  { title: 'Зачёт', sub: 'итог' },
]

const ROWS = [
  { name: 'Абрамова А.', cells: ['18', '92%', '5', '5'], avg: '5,0' },
  { name: 'Белов К.', cells: ['15', '74%', '4+', 'w'], avg: '4,0' },
  { name: 'Васильев Д.', cells: ['н', '81%', '.4−', '4'], avg: '4,0' },
  { name: 'Григорьева М.', cells: ['12', '65%', '3/4', '4'], avg: '3,8' },
  { name: 'Дёмин С.', cells: ['19', '—', '5', '5'], avg: '5,0' },
]

const LEGEND = [
  { mark: '4+', text: 'оценка с плюсом' },
  { mark: 'w', text: 'вейтинг — долг до пересдачи' },
  { mark: '.4−', text: 'дозачёт' },
  { mark: '3/4', text: 'пересдача, в средний — лучшая' },
  { mark: 'н', text: 'сама из посещаемости' },
]

const POINTS = [
  {
    title: 'Любая шкала',
    desc: 'Баллы из N, оценки 2–5, зачёт, проценты. Пороги перевода в оценку и вес колонки — свои у каждой работы.',
  },
  {
    title: 'Онлайн-работы встают сами',
    desc: 'Результаты тестов Lemma — колонками, без ручного ввода. Бумажные — с клавиатуры, как в таблице, или вставкой столбца из Excel.',
  },
  {
    title: 'Интенсив, зачёт и экзамен',
    desc: 'Работы по дням, части письменно и устно, подсказка итоговой оценки. В средний за год идёт только итог.',
  },
  {
    title: 'Черновики отзывов от ИИ',
    desc: 'Обратная связь по интенсиву: каждый отзыв начинается с хорошего. Имена учеников в ИИ не отправляются — их подставляет сам журнал.',
  },
]

const markClass = (v) => {
  if (v === 'w' || v === 'н') return 'v2-jr-cell--debt'
  if (v.startsWith('.')) return 'v2-jr-cell--retake'
  if (v.includes('/')) return 'v2-jr-cell--try'
  return ''
}

const JournalV2 = () => (
  <section className="v2-section v2-journal" id="journal">
    <div className="v2-container">
      <div className="v2-section-header v2-reveal">
        <span className="v2-label">4 · Журнал</span>
        <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
          Журнал вместо <span className="v2-gradient-text">Google Таблиц</span>
        </h2>
        <p>Бумажные и онлайн-работы — в одной сетке. Рабочий журнал учителя; официальный остаётся школьным.</p>
      </div>

      <div className="v2-split v2-reveal">
        <div className="v2-split-visual">
          <div className="v2-app v2-app--wide">
            <div className="v2-app-head">
              <span className="v2-app-swatch" style={{ background: '#14b8a6' }} />
              <div>
                <div className="v2-app-title">9 А · Журнал класса</div>
                <div className="v2-app-sub">Октябрь · 2026/2027</div>
              </div>
              <span className="v2-app-chip v2-app-chip--neutral">Баллы · % · Оценки</span>
            </div>
            <div className="v2-jr-scroll">
              <table className="v2-jr">
                <thead>
                  <tr>
                    <th className="v2-jr-name">Ученик</th>
                    {COLUMNS.map(c => (
                      <th key={c.title} className={c.online ? 'v2-jr-online' : ''}>
                        {c.title}<span>{c.sub}</span>
                      </th>
                    ))}
                    <th>Средний</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(r => (
                    <tr key={r.name}>
                      <td className="v2-jr-name">{r.name}</td>
                      {r.cells.map((v, i) => (
                        <td key={i} className={`v2-jr-cell ${markClass(v)}`}>{v}</td>
                      ))}
                      <td className="v2-jr-avg">{r.avg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="v2-jr-legend">
              {LEGEND.map(l => (
                <li key={l.mark}><b>{l.mark}</b>{l.text}</li>
              ))}
            </ul>
          </div>
        </div>

        <ul className="v2-points">
          {POINTS.map(p => (
            <li key={p.title} className="v2-point v2-stagger">
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
)

export default JournalV2
