const FEATURES = [
  {
    num: '01',
    numColor: 'cyan',
    cardColor: 'cyan',
    title: '\u0411\u0430\u0437\u0430 \u0437\u0430\u0434\u0430\u0447',
    desc: '7000+ \u0437\u0430\u0434\u0430\u0447 \u043F\u043E \u0442\u0435\u043C\u0430\u043C \u0415\u0413\u042D \u0441 LaTeX-\u0444\u043E\u0440\u043C\u0443\u043B\u0430\u043C\u0438, \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F\u043C\u0438, \u0442\u0435\u0433\u0430\u043C\u0438 \u0438 \u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u044C\u044E. \u041C\u043E\u0449\u043D\u044B\u0435 \u0444\u0438\u043B\u044C\u0442\u0440\u044B.',
    tags: [
      { label: 'LaTeX', color: 'cyan' },
      { label: '\u0424\u0438\u043B\u044C\u0442\u0440\u044B', color: 'cyan' },
      { label: '3 \u0441\u043B\u043E\u0436\u043D\u043E\u0441\u0442\u0438', color: '' },
    ],
  },
  {
    num: '02',
    numColor: 'pink',
    cardColor: 'pink',
    title: 'Генератор работ',
    desc: 'Устный счёт, контрольные, карточки и полные варианты ЕГЭ в формате КИМ (21 задание, A5-печать). Несколько вариантов за секунды. PDF-экспорт.',
    tags: [
      { label: 'PDF', color: 'pink' },
      { label: 'КИМ ЕГЭ', color: 'pink' },
      { label: 'Drag & Drop', color: '' },
    ],
  },
  {
    num: '03',
    numColor: 'purple',
    cardColor: 'purple',
    title: '\u0422\u0435\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435',
    desc: '\u0423\u0447\u0435\u043D\u0438\u043A\u0438 \u0437\u0430\u0445\u043E\u0434\u044F\u0442 \u043F\u043E \u0441\u0441\u044B\u043B\u043A\u0435 \u0438\u043B\u0438 QR-\u043A\u043E\u0434\u0443, \u0440\u0435\u0448\u0430\u044E\u0442 \u0442\u0435\u0441\u0442. \u0410\u0432\u0442\u043E-\u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430, \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u0432 \u0440\u0435\u0430\u043B\u044C\u043D\u043E\u043C \u0432\u0440\u0435\u043C\u0435\u043D\u0438.',
    tags: [
      { label: 'QR-\u043A\u043E\u0434', color: 'purple' },
      { label: '\u0410\u0432\u0442\u043E-\u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430', color: 'purple' },
      { label: '\u041E\u043D\u043B\u0430\u0439\u043D', color: '' },
    ],
  },
]

const ACH_PREVIEW = [
  { icon: '/achievements/icon010.png', rarity: 'common' },
  { icon: '/achievements/icon020.png', rarity: 'common' },
  { icon: '/achievements/icon025.png', rarity: 'rare' },
  { icon: '/achievements/icon035.png', rarity: 'rare' },
  { icon: '/achievements/icon045.png', rarity: 'legendary' },
]

const FeaturesV2 = () => (
  <section className="v2-features v2-section" id="features">
    <div className="v2-container">
      <div className="v2-section-header v2-reveal">
        <span className="v2-label">{'\u0412\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438'}</span>
        <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
          {'\u0412\u0441\u0451 \u0434\u043B\u044F '}<span className="v2-gradient-text">{'\u0415\u0413\u042D'}</span>{' \u0432 \u043E\u0434\u043D\u043E\u043C \u043C\u0435\u0441\u0442\u0435'}
        </h2>
        <p>{'\u041F\u043E\u043B\u043D\u044B\u0439 \u043D\u0430\u0431\u043E\u0440 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u043E\u0432 \u0443\u0447\u0438\u0442\u0435\u043B\u044F \u043C\u0430\u0442\u0435\u043C\u0430\u0442\u0438\u043A\u0438'}</p>
      </div>

      <div className="v2-bento v2-reveal">
        {FEATURES.map((f, i) => (
          <div key={i} className={`v2-bento-card v2-bento-card--${f.cardColor} v2-stagger`}>
            <div className={`v2-bento-num v2-bento-num--${f.numColor}`}>{f.num}</div>
            <h3 className="v2-bento-title">{f.title}</h3>
            <p className="v2-bento-desc">{f.desc}</p>
            <div className="v2-bento-tags">
              {f.tags.map((tag, j) => (
                <span key={j} className={`v2-bento-tag ${tag.color ? `v2-bento-tag--${tag.color}` : ''}`}>
                  {tag.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Wide achievement card */}
      <div className="v2-bento v2-reveal" style={{ marginTop: 16 }}>
        <div className="v2-bento-card v2-bento-card--wide v2-bento-card--achievements">
          <div>
            <div className="v2-bento-num v2-bento-num--orange">04</div>
            <h3 className="v2-bento-title">{'\u0414\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u044F'}</h3>
            <p className="v2-bento-desc">
              {'72+ \u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u044F \u0442\u0440\u0451\u0445 \u0443\u0440\u043E\u0432\u043D\u0435\u0439 \u0440\u0435\u0434\u043A\u043E\u0441\u0442\u0438. \u0423\u0447\u0435\u043D\u0438\u043A\u0438 \u0441\u043E\u0431\u0438\u0440\u0430\u044E\u0442 \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u044E \u0438 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u044E\u0442\u0441\u044F \u043A \u0442\u0440\u0435\u043D\u0438\u0440\u043E\u0432\u043A\u0430\u043C \u0447\u0430\u0449\u0435.'}
            </p>
          </div>
          <div>
            <div className="v2-bento-achievements">
              {ACH_PREVIEW.map((a, i) => (
                <div key={i} className={`v2-bento-ach-icon v2-bento-ach-icon--${a.rarity}`}>
                  <img src={a.icon} alt="Achievement" loading="lazy" />
                </div>
              ))}
              <div className="v2-bento-ach-more">+67</div>
            </div>
            <div className="v2-bento-rarity-legend">
              <span className="v2-bento-rarity-item">
                <span className="v2-bento-rarity-dot v2-bento-rarity-dot--common" />
                {'\u041E\u0431\u044B\u0447\u043D\u044B\u0435'}
              </span>
              <span className="v2-bento-rarity-item">
                <span className="v2-bento-rarity-dot v2-bento-rarity-dot--rare" />
                {'\u0420\u0435\u0434\u043A\u0438\u0435'}
              </span>
              <span className="v2-bento-rarity-item">
                <span className="v2-bento-rarity-dot v2-bento-rarity-dot--legendary" />
                {'\u041B\u0435\u0433\u0435\u043D\u0434\u0430\u0440\u043D\u044B\u0435'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
)

export default FeaturesV2
