import { APP_VERSION } from '@shared/version/buildInfo'
import { GITHUB_URL, scrollToSection } from './nav'

// Четыре шага рабочего дня — они же оглавление страницы.
const PATH = [
  { id: 'prepare', label: 'Подготовить' },
  { id: 'lesson', label: 'Провести урок' },
  { id: 'check', label: 'Проверить' },
  { id: 'journal', label: 'Журнал' },
]

const HeroV2 = () => (
  <section className="v2-hero" id="hero">
    <div className="v2-hero-mesh" />
    <div className="v2-hero-grid" />

    {/* Floating geometric shapes */}
    <div className="v2-hero-shapes">
      <div className="v2-hero-shape v2-shape-triangle" />
      <div className="v2-hero-shape v2-shape-circle" />
      <div className="v2-hero-shape v2-shape-diamond" />
      <div className="v2-hero-shape v2-shape-ring" />
      <div className="v2-hero-shape v2-shape-cross" />
      <div className="v2-hero-shape v2-shape-hex" />
    </div>

    <div className="v2-hero-content">
      <div className="v2-hero-eyebrow">
        <span className="v2-hero-eyebrow-dot" />
        v{APP_VERSION} // open source // бесплатно
      </div>

      <h1 className="v2-hero-title">
        <span className="v2-hero-outline">МАТЕМАТИКА</span>
        <br />
        <span className="v2-gradient-text">48 000+ задач</span>
        <br />
        0 рутины
      </h1>

      <p className="v2-hero-subtitle">
        Банк задач ЕГЭ и ОГЭ, генераторы с проверенными ответами, живые
        стереочертежи, уроки, журнал класса и кабинет ученика — рабочее место
        учителя математики в одном окне.
      </p>

      <div className="v2-hero-actions">
        <a href="#drawings" className="v2-btn v2-btn--primary"
           onClick={(e) => { e.preventDefault(); scrollToSection('drawings') }}>
          Смотреть возможности
        </a>
        <a href={GITHUB_URL} className="v2-btn v2-btn--outline">
          Исходный код на GitHub
        </a>
      </div>

      <ol className="v2-hero-path">
        {PATH.map((step, i) => (
          <li key={step.id}>
            <a href={`#${step.id}`} onClick={(e) => { e.preventDefault(); scrollToSection(step.id) }}>
              <span className="v2-hero-path-num">{i + 1}</span>
              {step.label}
            </a>
          </li>
        ))}
      </ol>
    </div>

    <div className="v2-hero-scroll">
      <div className="v2-hero-scroll-line" />
      <span className="v2-hero-scroll-text">scroll</span>
    </div>
  </section>
)

export default HeroV2
