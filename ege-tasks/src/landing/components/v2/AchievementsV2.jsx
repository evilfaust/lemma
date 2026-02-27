const ACHIEVEMENTS = [
  { icon: '/achievements/icon005.png', name: '\u041F\u0435\u0440\u0432\u044B\u0439 \u0448\u0430\u0433', rarity: 'common' },
  { icon: '/achievements/icon035.png', name: '\u0412\u0438\u0440\u0442\u0443\u043E\u0437', rarity: 'rare' },
  { icon: '/achievements/icon003.png', name: '\u0416\u0435\u043B\u0435\u0437\u043D\u044B\u0439 \u0447\u0435\u043B\u043E\u0432\u0435\u043A', rarity: 'legendary' },
  { icon: '/achievements/icon032.png', name: '\u0414\u0436\u0435\u0434\u0430\u0439', rarity: 'legendary' },
  { icon: '/achievements/icon048.png', name: '\u041B\u0435\u0433\u0435\u043D\u0434\u0430', rarity: 'legendary' },
]

const AchievementsV2 = () => (
  <section className="v2-achievements v2-section" id="achievements">
    <div className="v2-achievements-bg" />
    <div className="v2-container">
      <div className="v2-section-header v2-reveal">
        <span className="v2-label">{'\u0413\u0435\u0439\u043C\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F'}</span>
        <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
          {'\u041C\u043E\u0442\u0438\u0432\u0430\u0446\u0438\u044F \u0447\u0435\u0440\u0435\u0437 '}<span className="v2-gradient-text">{'\u0438\u0433\u0440\u0443'}</span>
        </h2>
        <p>{'72+ \u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u0439 \u0442\u0440\u0451\u0445 \u0443\u0440\u043E\u0432\u043D\u0435\u0439 \u0440\u0435\u0434\u043A\u043E\u0441\u0442\u0438. \u0423\u0447\u0435\u043D\u0438\u043A\u0438 \u0441\u043E\u0440\u0435\u0432\u043D\u0443\u044E\u0442\u0441\u044F \u0437\u0430 \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044E.'}</p>
      </div>

      <div className="v2-ach-grid v2-reveal">
        {ACHIEVEMENTS.map((a, i) => (
          <div key={i} className={`v2-ach-card v2-ach-card--${a.rarity} v2-stagger`}>
            <div className="v2-ach-icon">
              <img src={a.icon} alt={a.name} loading="lazy" />
            </div>
            <div className="v2-ach-name">{a.name}</div>
            <div className={`v2-ach-rarity v2-ach-rarity--${a.rarity}`}>
              {a.rarity === 'common' ? '\u041E\u0431\u044B\u0447\u043D\u0430\u044F' : a.rarity === 'rare' ? '\u0420\u0435\u0434\u043A\u0430\u044F' : '\u041B\u0435\u0433\u0435\u043D\u0434\u0430\u0440\u043D\u0430\u044F'}
            </div>
          </div>
        ))}
      </div>

      <p className="v2-ach-quote v2-reveal">
        {'\u00AB\u0423\u0447\u0435\u043D\u0438\u043A\u0438 \u0441\u0442\u0440\u0435\u043C\u044F\u0442\u0441\u044F \u0441\u043E\u0431\u0440\u0430\u0442\u044C \u0432\u0441\u044E \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044E \u2014 \u0443\u0447\u0451\u0431\u0430 \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0441\u044F \u043F\u0440\u0438\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435\u043C\u00BB'}
      </p>
    </div>
  </section>
)

export default AchievementsV2
