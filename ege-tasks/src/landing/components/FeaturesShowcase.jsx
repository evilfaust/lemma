const FEATURES = [
  {
    icon: '\uD83C\uDFAF',
    iconClass: 'landing-feature-icon--blue',
    title: 'База задач',
    desc: '7000+ задач по темам ЕГЭ с LaTeX-формулами, изображениями, сложностью и тегами. Мощные фильтры и поиск.',
    tags: ['LaTeX', 'Фильтры', '3 сложности'],
  },
  {
    icon: '\uD83D\uDCDD',
    iconClass: 'landing-feature-icon--pink',
    title: 'Генератор работ',
    desc: 'Устный счёт, контрольные работы, карточки. 3 режима генерации, несколько вариантов за секунды. Экспорт в PDF.',
    tags: ['PDF', 'Варианты', 'Drag & Drop'],
  },
  {
    icon: '\uD83D\uDCCA',
    iconClass: 'landing-feature-icon--teal',
    title: 'Тестирование',
    desc: 'Ученики заходят по ссылке или QR-коду, входят в аккаунт и решают тест. Автоматическая проверка и результаты в реальном времени.',
    tags: ['Ссылка + QR', 'Авто-проверка', 'Онлайн'],
  },
]

const ACHIEVEMENTS_PREVIEW = [
  { icon: '/achievements/icon010.png', rarity: 'common' },
  { icon: '/achievements/icon020.png', rarity: 'common' },
  { icon: '/achievements/icon025.png', rarity: 'rare' },
  { icon: '/achievements/icon035.png', rarity: 'rare' },
  { icon: '/achievements/icon045.png', rarity: 'legendary' },
]

const FeaturesShowcase = () => (
  <section className="landing-features landing-section" id="features">
    <div className="landing-container">
      <div className="landing-section-header landing-animate">
        <h2 className="landing-section-title">
          Всё для подготовки к <span className="landing-gradient-text">ЕГЭ</span>
        </h2>
        <p className="landing-section-subtitle">
          Полный набор инструментов учителя математики — от базы задач до аналитики
        </p>
      </div>

      <div className="landing-features-grid landing-animate">
        {FEATURES.map((f, i) => (
          <div key={i} className="landing-feature-card landing-stagger">
            <div className={`landing-feature-icon ${f.iconClass}`}>
              {f.icon}
            </div>
            <h3 className="landing-feature-title">{f.title}</h3>
            <p className="landing-feature-desc">{f.desc}</p>
            <div className="landing-feature-tags">
              {f.tags.map((tag, j) => (
                <span key={j} className="landing-feature-tag">{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Wide achievement card */}
      <div className="landing-features-grid landing-animate">
        <div className="landing-feature-card landing-feature-card--wide">
          <div>
            <div className="landing-feature-icon landing-feature-icon--gold">
              {'\uD83C\uDFC6'}
            </div>
            <h3 className="landing-feature-title">Система достижений</h3>
            <p className="landing-feature-desc">
              48+ достижений трёх уровней редкости.
              Ученики собирают коллекцию и возвращаются к тренировкам чаще.
            </p>
          </div>

          <div>
            <div className="landing-achievements-preview">
              {ACHIEVEMENTS_PREVIEW.map((a, i) => (
                <div key={i} className={`landing-achievement-mini landing-achievement-mini--${a.rarity}`}>
                  <img src={a.icon} alt="Achievement" loading="lazy" />
                </div>
              ))}
            </div>
            <div className="landing-rarity-legend">
              <span className="landing-rarity-item">
                <span className="landing-rarity-dot landing-rarity-dot--common" />
                Обычные
              </span>
              <span className="landing-rarity-item">
                <span className="landing-rarity-dot landing-rarity-dot--rare" />
                Редкие
              </span>
              <span className="landing-rarity-item">
                <span className="landing-rarity-dot landing-rarity-dot--legendary" />
                Легендарные
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
)

export default FeaturesShowcase
