const FEATURES = [
  {
    icon: '\uD83C\uDFAF',
    iconClass: 'landing-feature-icon--blue',
    title: 'База задач',
    desc: '7000+ задач по темам ЕГЭ с LaTeX-формулами, изображениями, тегами и тремя уровнями сложности. Быстрый импорт с sdamgia.ru.',
    tags: ['LaTeX', 'Фильтры', 'Импорт sdamgia'],
  },
  {
    icon: '\uD83D\uDCDD',
    iconClass: 'landing-feature-icon--pink',
    title: 'Генераторы работ',
    desc: 'Устный счёт, карточки А5/А4/А6, контрольные по нескольким темам и полные варианты ЕГЭ в официальном стиле КИМ (21 задание). PDF-экспорт.',
    tags: ['КИМ ЕГЭ', 'PDF', 'Drag & Drop'],
  },
  {
    icon: '\uD83D\uDCBB',
    iconClass: 'landing-feature-icon--teal',
    title: 'Онлайн-тестирование',
    desc: 'Ученики заходят по ссылке или QR-коду, входят в аккаунт и решают тест. Автоматическая проверка ответов, результаты в реальном времени.',
    tags: ['QR-код', 'Авто-проверка', 'Онлайн'],
  },
  {
    icon: '\uD83D\uDD23',
    iconClass: 'landing-feature-icon--blue',
    title: 'QR-листы',
    desc: 'Ученик решает задачи, закрашивает числа-ответы в таблице — из них складывается QR-код. Нестандартный и запоминающийся формат урока.',
    tags: ['Печать A4', 'Сохранение', 'Картинки'],
  },
  {
    icon: '\uD83D\uDCD0',
    iconClass: 'landing-feature-icon--pink',
    title: 'Геометрия',
    desc: 'Отдельный модуль для задач с чертежами. GeoGebra-редактор прямо в браузере, A5-листы для печати, сохранение наборов задач.',
    tags: ['GeoGebra', 'A5-печать', 'Чертежи'],
  },
  {
    icon: '\uD83D\uDCDA',
    iconClass: 'landing-feature-icon--teal',
    title: 'Теория и ТДФ',
    desc: 'Библиотека статей с формулами и чертежами. Конспекты теорем, определений и формул (ТДФ) с GeoGebra, плюс бланки для устного опроса.',
    tags: ['Конспекты', 'Опросники', 'GeoGebra'],
  },
]

const ANALYTICS_ITEMS = [
  { icon: '\uD83D\uDCC8', title: 'Динамика результатов', desc: 'График по всем попыткам ученика' },
  { icon: '\u26A0\uFE0F', title: 'Слабые темы', desc: 'Задачи с низким процентом верных ответов' },
  { icon: '\uD83D\uDD25', title: 'Серия успехов', desc: 'Streak при результате ≥70% несколько раз подряд' },
  { icon: '\uD83D\uDC65', title: 'Сводка класса', desc: 'Учитель видит всех учеников и их баллы' },
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
          Всё для работы <span className="landing-gradient-text">учителя математики</span>
        </h2>
        <p className="landing-section-subtitle">
          Полный набор инструментов — от базы задач до аналитики успеваемости
        </p>
      </div>

      {/* Main feature cards — 2 rows × 3 */}
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

      {/* Analytics wide card */}
      <div className="landing-features-grid landing-animate">
        <div className="landing-feature-card landing-feature-card--analytics-wide">
          <div>
            <div className="landing-feature-icon landing-feature-icon--gold">
              {'\uD83D\uDCCA'}
            </div>
            <h3 className="landing-feature-title">Аналитика и прогресс</h3>
            <p className="landing-feature-desc">
              Учитель видит полную картину класса: успеваемость каждого ученика, динамику
              результатов и проблемные темы. Ученик отслеживает свой прогресс, серию
              успехов и историю всех попыток.
            </p>
            <div className="landing-feature-tags">
              {['Прогресс учеников', 'Слабые места', 'Серия успехов 🔥', 'История попыток'].map((t, i) => (
                <span key={i} className="landing-feature-tag">{t}</span>
              ))}
            </div>
          </div>
          <div className="landing-analytics-grid">
            {ANALYTICS_ITEMS.map((item, i) => (
              <div key={i} className="landing-analytics-item">
                <span className="landing-analytics-icon">{item.icon}</span>
                <div>
                  <div className="landing-analytics-title">{item.title}</div>
                  <div className="landing-analytics-desc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Achievements wide card */}
      <div className="landing-features-grid landing-animate">
        <div className="landing-feature-card landing-feature-card--wide">
          <div>
            <div className="landing-feature-icon landing-feature-icon--gold">
              {'\uD83C\uDFC6'}
            </div>
            <h3 className="landing-feature-title">Система достижений</h3>
            <p className="landing-feature-desc">
              72+ достижения трёх уровней редкости.
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
