const STEPS = [
  {
    num: 1,
    title: 'Выберите задачи',
    desc: 'Фильтруйте по темам ЕГЭ, сложности, тегам и источникам. 7000+ задач с LaTeX-формулами и изображениями готовы к использованию.',
  },
  {
    num: 2,
    title: 'Сгенерируйте работу',
    desc: 'Устный счёт, контрольная или карточка — выберите формат. Несколько вариантов с разными задачами за пару кликов.',
  },
  {
    num: 3,
    title: 'Раздайте ученикам',
    desc: 'QR-код на экране — ученики сканируют телефоном и начинают тест. Или распечатайте PDF с идеальной вёрсткой.',
  },
  {
    num: 4,
    title: 'Смотрите результаты',
    desc: 'Автоматическая проверка ответов, оценки и аналитика по каждому ученику. Достижения мотивируют продолжать.',
  },
]

const HowItWorks = () => (
  <section className="landing-howitworks landing-section" id="how-it-works">
    <div className="landing-container">
      <div className="landing-section-header landing-animate">
        <h2 className="landing-section-title">
          Как это <span className="landing-gradient-text">работает</span>
        </h2>
        <p className="landing-section-subtitle">
          От выбора задач до результатов — четыре простых шага
        </p>
      </div>

      <div className="landing-timeline landing-animate">
        {STEPS.map((step, i) => (
          <div key={i} className="landing-timeline-step landing-stagger">
            <div className="landing-timeline-number">{step.num}</div>
            <div className="landing-timeline-content">
              <h3 className="landing-timeline-title">{step.title}</h3>
              <p className="landing-timeline-desc">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
)

export default HowItWorks
