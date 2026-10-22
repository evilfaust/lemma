// Макет окна урока: материалы одним списком, у каждого — как получит ученик.
const ITEMS = [
  { icon: '📝', title: 'Самостоятельная «Простейшие уравнения»', deliver: 'Решать онлайн', tone: 'cyan', when: 'на уроке', required: true },
  { icon: '🧊', title: 'Сечения куба — разбор у доски', deliver: 'Только условия', tone: 'purple', when: 'на уроке' },
  { icon: '🏠', title: 'Вариант 12, профиль, часть 1', deliver: 'Решать онлайн', tone: 'cyan', when: 'ДЗ к следующему уроку', required: true },
  { icon: '📎', title: 'Конспект «Формулы приведения».pdf', deliver: 'Посмотреть', tone: 'neutral', when: 'ДЗ' },
  { icon: '🔒', title: 'План урока и заметки', deliver: 'Только мне', tone: 'muted', when: '' },
]

const POINTS = [
  {
    title: 'Как получит ученик — у каждого пункта',
    desc: 'Решать онлайн, только условия, писали на бумаге, посмотреть или «только мне». Под строкой — что именно увидит ученик.',
  },
  {
    title: 'ДЗ «к следующему уроку»',
    desc: 'Дата считается сама по расписанию класса: урок перенесли или отменили — задание переехало вместе с ним.',
  },
  {
    title: 'QR-код на экране',
    desc: 'Ученики заходят с телефонов, варианты раздаются по кругу. Для разбора у доски — показ условий без выдачи и без ответов.',
  },
  {
    title: 'Календарь по парам',
    desc: 'Уроки, интенсивы, дедлайны и дела; посещаемость одной кнопкой. Подписка на телефон — iPhone, Google, Яндекс; школьный календарь и два учителя на класс.',
  },
]

const LessonV2 = () => (
  <section className="v2-section v2-lesson" id="lesson">
    <div className="v2-container">
      <div className="v2-section-header v2-reveal">
        <span className="v2-label">2 · Провести урок</span>
        <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
          Урок собран <span className="v2-gradient-text">в одном окне</span>
        </h2>
        <p>Работы, тесты, геометрия, файлы и текст — одним списком.</p>
      </div>

      <div className="v2-split v2-split--reverse v2-reveal">
        <div className="v2-split-visual">
          <div className="v2-app">
            <div className="v2-app-head">
              <span className="v2-app-swatch" style={{ background: '#3b82f6' }} />
              <div>
                <div className="v2-app-title">10 Б · Алгебра</div>
                <div className="v2-app-sub">Четверг · 3 пара · 14:05–15:40</div>
              </div>
              <span className="v2-app-chip v2-app-chip--teal">Идёт сейчас</span>
            </div>
            <div className="v2-app-section">Материалы урока</div>
            <ul className="v2-lesson-items">
              {ITEMS.map(item => (
                <li key={item.title} className="v2-lesson-item">
                  <span className="v2-lesson-icon">{item.icon}</span>
                  <div className="v2-lesson-body">
                    <div className="v2-lesson-title">{item.title}</div>
                    <div className="v2-lesson-meta">
                      <span className={`v2-app-chip v2-app-chip--${item.tone}`}>{item.deliver}</span>
                      {item.when && <span className="v2-lesson-when">{item.when}</span>}
                      {item.required && <span className="v2-lesson-req">✓ обязательно</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="v2-app-foot">
              Ученик увидит: 2 обязательных задания и 2 материала
            </div>
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

export default LessonV2
