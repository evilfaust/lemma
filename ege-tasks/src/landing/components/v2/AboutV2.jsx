const ACHIEVEMENTS = [
  { icon: '/achievements/icon005.png', name: 'Первый шаг', rarity: 'common' },
  { icon: '/achievements/icon035.png', name: 'Виртуоз', rarity: 'rare' },
  { icon: '/achievements/icon003.png', name: 'Железный человек', rarity: 'legendary' },
  { icon: '/achievements/icon032.png', name: 'Джедай', rarity: 'legendary' },
  { icon: '/achievements/icon048.png', name: 'Легенда', rarity: 'legendary' },
]

const RARITY_LABEL = { common: 'Обычная', rare: 'Редкая', legendary: 'Легендарная' }

const CHECKLIST = [
  'Открытый код под лицензией AGPL-3.0',
  'Темы по кодификатору ЕГЭ и ОГЭ, профиль — по КИМ-2027',
  'Учителя делятся работами и передают учеников',
  'Роли: администратор, редактор, наблюдатель',
  'Печать и PDF прямо из браузера',
  'Каждая функция опробована на реальных уроках',
]

const AboutV2 = () => (
  <>
    <section className="v2-achievements v2-section" id="achievements">
      <div className="v2-achievements-bg" />
      <div className="v2-container">
        <div className="v2-section-header v2-reveal">
          <span className="v2-label">Геймификация</span>
          <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
            Мотивация через <span className="v2-gradient-text">игру</span>
          </h2>
          <p>106 достижений трёх уровней редкости — часть придумали сами ученики.</p>
        </div>

        <div className="v2-ach-grid v2-reveal">
          {ACHIEVEMENTS.map(a => (
            <div key={a.name} className={`v2-ach-card v2-ach-card--${a.rarity} v2-stagger`}>
              <div className="v2-ach-icon">
                <img src={a.icon} alt={a.name} loading="lazy" />
              </div>
              <div className="v2-ach-name">{a.name}</div>
              <div className={`v2-ach-rarity v2-ach-rarity--${a.rarity}`}>{RARITY_LABEL[a.rarity]}</div>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="v2-testimonials v2-section" id="about">
      <div className="v2-container">
        <div className="v2-section-header v2-reveal">
          <span className="v2-label">О проекте</span>
          <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
            Создано <span className="v2-gradient-text">учителем</span> для учителей
          </h2>
        </div>

        <div className="v2-testimonial-card v2-reveal">
          <p className="v2-testimonial-quote">
            Lemma делает практикующий учитель математики. Новое появляется,
            когда на уроке чего-то не хватило, — и сначала проверяется в своих классах.
          </p>

          <div className="v2-checklist">
            {CHECKLIST.map(item => (
              <div key={item} className="v2-checklist-item v2-stagger">
                <span className="v2-checklist-dot" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  </>
)

export default AboutV2
