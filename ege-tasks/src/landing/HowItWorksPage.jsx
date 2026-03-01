import { APP_VERSION } from '@shared/version/buildInfo'

const DOC_BASELINE = {
  changelogVersion: '3.7.4',
  changelogDate: '2026-03-01',
  geometrySchemaCheck: '2026-02-23',
}

const QUICK_FACTS = [
  { value: '7000+', label: 'задач в базе' },
  { value: '72+', label: 'достижения' },
  { value: '8', label: 'генераторов и модулей' },
  { value: '2+1', label: 'интерфейса: учитель, ученик и лендинг' },
]

const INTERFACES = [
  {
    title: 'Учительский интерфейс',
    desc: 'Центр управления задачами, работами и аналитикой: от выбора задач до выдачи сессий и просмотра результатов.',
    points: [
      'Управление задачами: фильтры, редактирование, теги, массовые операции.',
      'Генерация карточек, устного счёта и контрольных работ.',
      'Выдача сессий через ссылку и QR-код.',
      'Панель прогресса с динамикой и проблемными задачами.',
      'Управление достижениями и повторными попытками.',
    ],
  },
  {
    title: 'Ученический интерфейс',
    desc: 'Простой мобильный сценарий без лишних действий: зайти, решить, получить результат и увидеть прогресс.',
    points: [
      'Вход по ссылке `/student/{sessionId}` или QR-коду.',
      'Авторизация (или регистрация) через PocketBase Auth.',
      'Автосохранение ответов во время прохождения.',
      'Мгновенная проверка после отправки.',
      'Экран прогресса и галерея достижений.',
    ],
  },
]

const FEATURE_SECTIONS = [
  {
    title: 'Управление задачами',
    points: [
      'Фильтрация по темам, подтемам, тегам, сложности, источникам, годам и наличию изображений.',
      'Поддержка LaTeX и Markdown в условиях, решениях и пояснениях.',
      'Редактирование задач прямо в интерфейсе.',
      'Три способа добавления изображений: ссылка, файл, GeoGebra.',
      'Массовые операции по тегам, сложности, источникам и темам.',
    ],
  },
  {
    title: 'Генераторы и печать',
    points: [
      'Карточки в форматах A6/A5/A4 с листом ответов.',
      'Генератор «Устный счёт» с точным распределением по тегам/сложности.',
      'Генератор контрольных работ с блоками, фильтрами и несколькими режимами генерации.',
      'Drag & Drop между вариантами, замена и редактирование задач на месте.',
      'PDF-экспорт через Puppeteer (основной) и html2pdf.js (fallback).',
    ],
  },
  {
    title: 'WorkEditor и выдача',
    points: [
      'Список сохранённых работ с метриками, фильтрами и архивом.',
      'Панель выдачи сессии: ссылка для учеников и QR-код.',
      'Просмотр результатов учеников по попыткам.',
      'Ручная выдача достижений и управление повторной попыткой.',
      'Защита от потери данных: при наличии попыток доступен режим «Сохранить как новую».',
    ],
  },
  {
    title: 'Система тестирования',
    points: [
      'Распределение вариантов для учеников через round-robin.',
      'Автосохранение ответов и восстановление состояния.',
      'Проверка чисел с epsilon 1e-6.',
      'Поддержка дробей `1/3`, LaTeX-дробей `\\frac{1}{3}` и альтернативных ответов через `|`.',
      'Результат сразу после отправки.',
    ],
  },
  {
    title: 'Прогресс и аналитика',
    points: [
      'Дашборд аналитики задач: темы, подтемы, теги, сложность, источники.',
      'Панель прогресса учеников: попытки, средний балл, классы.',
      'Карточка ученика с динамикой результатов.',
      'Блок «Проблемные задачи» с быстрым просмотром условия и изображений.',
      'Переход из аналитики к конкретным задачам для точечной доработки.',
    ],
  },
  {
    title: 'Теория и геометрия',
    points: [
      'Theory Browser и Theory Editor (Monaco) для статей с Markdown + LaTeX.',
      'Категории теории, связка теории с задачами по тегам.',
      'Конструктор конспектов для печати.',
      'Отдельный модуль геометрии с GeoGebra.',
      'A5-печать геометрии с ручной компоновкой и drag & drop.',
    ],
  },
]

const TEST_FLOW = [
  'Учитель создаёт работу в генераторе или WorkEditor.',
  'Учитель создаёт сессию (кнопка «Выдать»).',
  'Система формирует ссылку и QR-код для класса.',
  'Ученик открывает `/student/{sessionId}`.',
  'Ученик регистрируется или авторизуется.',
  'Ученик нажимает «Начать тест».',
  'Система выдаёт вариант через round-robin.',
  'Ученик решает задачи (ответы автосохраняются).',
  'Ученик отправляет ответы.',
  'Система сразу показывает результат и достижения.',
  'Учитель видит попытку в таблице результатов.',
  'Учитель может выдать достижение вручную.',
  'Учитель может разрешить повторную попытку.',
]

const STACK = [
  {
    title: 'Frontend',
    items: [
      'React 18 + Vite 5',
      'Ant Design 5',
      'KaTeX + react-markdown + remark-gfm',
      'Monaco Editor',
      'PocketBase SDK',
    ],
  },
  {
    title: 'Backend',
    items: [
      'PocketBase (SQLite, REST API, Auth, Files)',
      'Express.js PDF service',
      'Puppeteer для PDF',
      'Cheerio для парсинга задач',
    ],
  },
  {
    title: 'Инфраструктура',
    items: [
      'Nginx как reverse proxy',
      'Systemd для сервисов',
      'Shell-скрипты для deploy/backup/restore',
      'Разделение teacher/student интерфейсов',
    ],
  },
]

const DATA_COLLECTIONS = [
  { name: 'topics / subtopics / tags', desc: 'Справочники тем, подтем и тегов.' },
  { name: 'tasks', desc: 'Основная коллекция задач с метаданными, ответами и изображениями.' },
  { name: 'works / variants', desc: 'Сохранённые работы и варианты для выдачи.' },
  { name: 'work_sessions / attempts', desc: 'Сессии тестирования и попытки учеников.' },
  { name: 'students', desc: 'Auth-коллекция учеников с привязкой попыток.' },
  { name: 'theory_categories / theory_articles', desc: 'Структура и контент модуля теории.' },
  { name: 'geometry_topics / geometry_subtopics / geometry_tasks', desc: 'Отдельный модуль геометрии и GeoGebra-данные.' },
]

const DEPLOY_STEPS = [
  'Локально выполняется сборка фронтенда (Vite multi-page).',
  'Артефакты и backend-код синхронизируются на сервер через rsync.',
  'Nginx отдаёт статические файлы и проксирует API/PDF сервис.',
  'PocketBase и вспомогательные сервисы перезапускаются через systemd.',
  'Проводятся health-check проверки API и сайта.',
]

const LATEST_NOTES = [
  '3.7.4 (2026-03-01): крупный рефакторинг GeometryTaskEditor, TaskEditModal и генераторов через shared-компоненты/хуки.',
  '3.7.3: StudentDetailPage обновлён — проблемные задачи в компактных карточках, блок по умолчанию свёрнут.',
  '3.7.2: student-приложение получило mobile-first экран для `/` и быстрый вход по коду сессии.',
  '3.7.1: актуальная база достижений расширена до 72+.',
]

const GEOMETRY_SCHEMA = [
  '`geometry_tasks.topic` и `geometry_tasks.subtopic` — relation-поля к `geometry_topics` / `geometry_subtopics`.',
  '`geogebra_image_base64` — file field (PNG в storage), а не текст.',
  '`geogebra_base64` — текстовое состояние `.ggb` для повторного редактирования.',
  '`preview_layout` — JSON-макет карточки (print/student).',
  '`task_type` — select (`ready|build|mixed`), поле необязательное.',
]

const HowItWorksPage = () => (
  <div className="v2-page v2-how-page">
    <nav className="v2-nav v2-nav--scrolled">
      <div className="v2-container v2-nav-inner">
        <a href="/landing.html" className="v2-nav-logo">
          <span className="v2-nav-logo-mark">E</span>
          EGE Tasks
        </a>

        <ul className="v2-nav-links">
          <li><a href="#overview">Обзор</a></li>
          <li><a href="#features-detail">Модули</a></li>
          <li><a href="#flow-detail">Поток</a></li>
          <li><a href="#tech-detail">Стек</a></li>
          <li><a href="#data-detail">Данные</a></li>
          <li>
            <a href="https://task-ege.oipav.ru" className="v2-btn v2-btn--primary v2-nav-cta">
              Открыть
            </a>
          </li>
        </ul>
      </div>
    </nav>

    <header className="v2-how-hero v2-section" id="overview">
      <div className="v2-how-hero-mesh" />
      <div className="v2-container">
        <div className="v2-how-hero-badge">README Style • Landing Format • v{APP_VERSION}</div>
        <h1 className="v2-heading v2-how-title">
          Как работает приложение: подробно, но в <span className="v2-gradient-text">стиле лендинга</span>
        </h1>
        <p className="v2-how-subtitle">
          Ниже собран полный обзор на основе README проекта: архитектура продукта, ключевые функции,
          сценарий тестирования, данные, стек и деплой. Это не краткий промо-блок, а подробное объяснение
          того, как платформа устроена и как работает в реальном учебном процессе.
        </p>
        <p className="v2-how-subtitle" style={{ marginTop: 12 }}>
          Актуализация по вашим файлам: `README.MD`, `CHANGELOG.md`, `CLAUDE.MD`, `SCHEMA_GEOMETRY.md`.
          Базовая версия функциональности: {DOC_BASELINE.changelogVersion} от {DOC_BASELINE.changelogDate}.
        </p>
        <div className="v2-how-hero-actions">
          <a href="https://task-ege.oipav.ru" className="v2-btn v2-btn--primary">Запустить платформу</a>
          <a href="/landing.html" className="v2-btn v2-btn--outline">Вернуться на лендинг</a>
        </div>

        <div className="v2-how-facts">
          {QUICK_FACTS.map((fact) => (
            <article key={fact.label} className="v2-how-fact">
              <div className="v2-how-fact-value">{fact.value}</div>
              <p>{fact.label}</p>
            </article>
          ))}
        </div>
      </div>
    </header>

    <section className="v2-section v2-how-interfaces">
      <div className="v2-container">
        <div className="v2-section-header">
          <span className="v2-label">Актуальные изменения</span>
          <h2 className="v2-heading" style={{ fontSize: 'clamp(30px, 4vw, 50px)' }}>
            Что подтверждено по CHANGELOG
          </h2>
        </div>
        <div className="v2-how-interface-grid">
          <article className="v2-how-interface-card">
            <h3>Последние релизы</h3>
            <ul className="v2-how-list">
              {LATEST_NOTES.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </article>
          <article className="v2-how-interface-card">
            <h3>Схема геометрии (production)</h3>
            <p>По `SCHEMA_GEOMETRY.md`, сверка с production: {DOC_BASELINE.geometrySchemaCheck}.</p>
            <ul className="v2-how-list">
              {GEOMETRY_SCHEMA.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>

    <section className="v2-section v2-how-interfaces">
      <div className="v2-container">
        <div className="v2-section-header">
          <span className="v2-label">Два интерфейса</span>
          <h2 className="v2-heading" style={{ fontSize: 'clamp(30px, 4vw, 50px)' }}>
            Разделение ролей: учитель и ученик
          </h2>
        </div>

        <div className="v2-how-interface-grid">
          {INTERFACES.map((item) => (
            <article key={item.title} className="v2-how-interface-card">
              <h3>{item.title}</h3>
              <p>{item.desc}</p>
              <ul className="v2-how-list">
                {item.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="v2-section" id="features-detail">
      <div className="v2-container">
        <div className="v2-section-header">
          <span className="v2-label">Функциональность</span>
          <h2 className="v2-heading" style={{ fontSize: 'clamp(30px, 4vw, 50px)' }}>
            Подробно по модулям (как в README)
          </h2>
          <p>
            Ключевые блоки платформы перечислены в формате технического описания, но оформлены как
            читаемые лендинговые секции.
          </p>
        </div>

        <div className="v2-how-feature-grid">
          {FEATURE_SECTIONS.map((section) => (
            <article key={section.title} className="v2-how-feature-card">
              <h3>{section.title}</h3>
              <ul className="v2-how-list">
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="v2-section v2-how-process" id="flow-detail">
      <div className="v2-container">
        <div className="v2-section-header">
          <span className="v2-label">Поток тестирования</span>
          <h2 className="v2-heading" style={{ fontSize: 'clamp(30px, 4vw, 50px)' }}>
            Полный сценарий от выдачи до аналитики
          </h2>
        </div>

        <div className="v2-how-flow">
          {TEST_FLOW.map((step, index) => (
            <article key={step} className="v2-how-flow-item">
              <span className="v2-how-flow-num">{index + 1}</span>
              <p>{step}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="v2-section" id="tech-detail">
      <div className="v2-container">
        <div className="v2-section-header">
          <span className="v2-label">Технологический стек</span>
          <h2 className="v2-heading" style={{ fontSize: 'clamp(30px, 4vw, 50px)' }}>
            Чем это реализовано технически
          </h2>
        </div>

        <div className="v2-how-tech-grid">
          {STACK.map((block) => (
            <article key={block.title} className="v2-how-tech-card">
              <h3>{block.title}</h3>
              <ul className="v2-how-list">
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="v2-section" id="data-detail">
      <div className="v2-container">
        <div className="v2-section-header">
          <span className="v2-label">Структура данных</span>
          <h2 className="v2-heading" style={{ fontSize: 'clamp(30px, 4vw, 50px)' }}>
            Основные коллекции PocketBase
          </h2>
        </div>

        <div className="v2-how-data-grid">
          {DATA_COLLECTIONS.map((item) => (
            <article key={item.name} className="v2-how-data-card">
              <h3>{item.name}</h3>
              <p>{item.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="v2-section v2-how-highlight">
      <div className="v2-container">
        <div className="v2-how-highlight-card">
          <span className="v2-label">Деплой и эксплуатация</span>
          <h2 className="v2-heading" style={{ fontSize: 'clamp(28px, 4vw, 46px)' }}>
            Как приложение доезжает в production
          </h2>
          <ul className="v2-how-list">
            {DEPLOY_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
          <div className="v2-how-highlight-actions">
            <a href="/landing.html#progress" className="v2-btn v2-btn--outline">
              Посмотреть блок аналитики на лендинге
            </a>
            <a href="https://task-ege.oipav.ru" className="v2-btn v2-btn--primary">
              Открыть рабочую платформу
            </a>
          </div>
        </div>
      </div>
    </section>

    <footer className="v2-footer">
      <div className="v2-container v2-footer-inner">
        <span>EGE Tasks Manager • Подробное описание работы приложения</span>
        <a href="/landing.html" className="v2-footer-link">landing</a>
      </div>
    </footer>
  </div>
)

export default HowItWorksPage
