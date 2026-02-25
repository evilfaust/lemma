const ACHIEVEMENTS = [
  { icon: '/achievements/icon005.png', name: 'Первый шаг', rarity: 'common' },
  { icon: '/achievements/icon012.png', name: 'Знаток', rarity: 'common' },
  { icon: '/achievements/icon025.png', name: 'Мастер', rarity: 'rare' },
  { icon: '/achievements/icon035.png', name: 'Виртуоз', rarity: 'rare' },
  { icon: '/achievements/icon048.png', name: 'Легенда', rarity: 'legendary' },
]

const AchievementsShowcase = () => (
  <section className="landing-achievements landing-section" id="achievements">
    <div className="landing-container">
      <div className="landing-section-header landing-animate">
        <h2 className="landing-section-title">
          Мотивация через <span className="landing-gradient-text">игру</span>
        </h2>
        <p className="landing-section-subtitle">
          48+ достижений трёх уровней редкости.
          Ученики соревнуются за коллекцию.
        </p>
      </div>

      <div className="landing-achievements-grid landing-animate">
        {ACHIEVEMENTS.map((a, i) => (
          <div key={i} className={`landing-achievement-card landing-achievement-card--${a.rarity} landing-stagger`}>
            <div className="landing-achievement-card-icon">
              <img src={a.icon} alt={a.name} loading="lazy" />
            </div>
            <div className="landing-achievement-card-name">{a.name}</div>
            <div className={`landing-achievement-card-rarity landing-achievement-card-rarity--${a.rarity}`}>
              {a.rarity === 'common' ? 'Обычная' : a.rarity === 'rare' ? 'Редкая' : 'Легендарная'}
            </div>
          </div>
        ))}
      </div>

      <p className="landing-achievements-quote landing-animate">
        «Ученики стремятся собрать всю коллекцию —
        учёба становится приключением, а не обязанностью»
      </p>
    </div>
  </section>
)

export default AchievementsShowcase
