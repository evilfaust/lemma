const FEATURES = [
  {
    num: '01',
    numColor: 'cyan',
    cardColor: 'cyan',
    title: 'База задач',
    desc: '7000+ задач по темам ЕГЭ с LaTeX-формулами, изображениями, тегами и сложностью. Мощные фильтры.',
    tags: [
      { label: 'LaTeX', color: 'cyan' },
      { label: 'Фильтры', color: 'cyan' },
      { label: '3 сложности', color: '' },
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
    title: 'Тестирование',
    desc: 'Ученики заходят по ссылке или QR-коду, решают тест. Авто-проверка, результаты в реальном времени.',
    tags: [
      { label: 'QR-код', color: 'purple' },
      { label: 'Авто-проверка', color: 'purple' },
      { label: 'Онлайн', color: '' },
    ],
  },
  {
    num: '04',
    numColor: 'cyan',
    cardColor: 'cyan',
    title: 'QR-листы',
    desc: 'Ученик решает задачи, закрашивает числа-ответы в таблице — из них складывается QR-код. Нестандартный и вовлекающий формат работы.',
    tags: [
      { label: 'Печать A4', color: 'cyan' },
      { label: 'Сохранение', color: 'cyan' },
      { label: 'Картинки', color: '' },
    ],
  },
  {
    num: '05',
    numColor: 'pink',
    cardColor: 'pink',
    title: 'Геометрия',
    desc: 'Отдельный модуль для задач с чертежами. GeoGebra-редактор прямо в браузере, A5-листы для печати, сохранение наборов задач.',
    tags: [
      { label: 'GeoGebra', color: 'pink' },
      { label: 'A5-печать', color: 'pink' },
      { label: 'Чертежи', color: '' },
    ],
  },
  {
    num: '06',
    numColor: 'purple',
    cardColor: 'purple',
    title: 'Теория и ТДФ',
    desc: 'Библиотека статей с формулами и чертежами. Конспекты теорем, определений и формул (ТДФ) с GeoGebra, плюс бланки для устного опроса.',
    tags: [
      { label: 'Конспекты', color: 'purple' },
      { label: 'Опросники', color: 'purple' },
      { label: 'GeoGebra', color: '' },
    ],
  },
]

const ANALYTICS_ITEMS = [
  { icon: '📈', title: 'Динамика результатов', desc: 'График по всем попыткам ученика' },
  { icon: '⚠️', title: 'Слабые темы', desc: 'Задачи с низким процентом верных ответов' },
  { icon: '🔥', title: 'Серия успехов', desc: 'Streak при результате ≥70% несколько раз подряд' },
  { icon: '👥', title: 'Сводка класса', desc: 'Учитель видит всех учеников и их баллы' },
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
        <span className="v2-label">{'Возможности'}</span>
        <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
          {'Всё для '}<span className="v2-gradient-text">{'ЕГЭ'}</span>{' в одном месте'}
        </h2>
        <p>{'Полный набор инструментов учителя математики'}</p>
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

      {/* Analytics + Achievements row */}
      <div className="v2-bento v2-reveal" style={{ marginTop: 16 }}>
        {/* Analytics card */}
        <div className="v2-bento-card v2-bento-card--analytics">
          <div className="v2-bento-num v2-bento-num--orange">07</div>
          <h3 className="v2-bento-title">{'Аналитика и прогресс'}</h3>
          <p className="v2-bento-desc">
            {'Учитель видит полную картину класса. Ученик отслеживает прогресс и серию успехов.'}
          </p>
          <div className="v2-analytics-grid">
            {ANALYTICS_ITEMS.map((item, i) => (
              <div key={i} className="v2-analytics-item">
                <span className="v2-analytics-icon">{item.icon}</span>
                <div>
                  <div className="v2-analytics-title">{item.title}</div>
                  <div className="v2-analytics-desc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Wide achievement card */}
        <div className="v2-bento-card v2-bento-card--wide v2-bento-card--achievements">
          <div>
            <div className="v2-bento-num v2-bento-num--orange">08</div>
            <h3 className="v2-bento-title">{'Достижения'}</h3>
            <p className="v2-bento-desc">
              {'72+ достижения трёх уровней редкости. Ученики собирают коллекцию и возвращаются к тренировкам чаще.'}
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
                {'Обычные'}
              </span>
              <span className="v2-bento-rarity-item">
                <span className="v2-bento-rarity-dot v2-bento-rarity-dot--rare" />
                {'Редкие'}
              </span>
              <span className="v2-bento-rarity-item">
                <span className="v2-bento-rarity-dot v2-bento-rarity-dot--legendary" />
                {'Легендарные'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
)

export default FeaturesV2
