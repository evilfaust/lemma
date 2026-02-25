const SYMBOLS = ['\u03A3', '\u222B', '\u03C0', '\u221A', '\u221E', '\u0394', '\u03B1', '\u00B1']

const HeroSection = () => (
  <section className="landing-hero" id="hero">
    {/* Floating math symbols */}
    <div className="landing-hero-symbols">
      {SYMBOLS.map((sym, i) => (
        <span key={i} className="landing-hero-symbol">{sym}</span>
      ))}
    </div>

    <div className="landing-hero-blob-teal" />

    <div className="landing-hero-content">
      <div className="landing-hero-badge">
        <span className="landing-hero-badge-dot" />
        Версия 3.6 — бесплатно
      </div>

      <h1 className="landing-hero-title">
        Подготовка к ЕГЭ<br />
        по математике —<br />
        <span className="landing-gradient-text">без рутины</span>
      </h1>

      <p className="landing-hero-subtitle">
        1000+ задач с LaTeX-формулами, генератор работ за секунды,
        тестирование через QR-код и система достижений.
        Всё, что нужно учителю математики.
      </p>

      <div className="landing-hero-buttons">
        <a href="https://task-ege.oipav.ru" className="landing-btn landing-btn-primary">
          Начать бесплатно
        </a>
        <a href="#features" className="landing-btn landing-btn-secondary"
           onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }) }}>
          Узнать больше
        </a>
      </div>
    </div>

    <div className="landing-hero-scroll">
      <span>Прокрутите вниз</span>
      <span className="landing-hero-scroll-arrow">&darr;</span>
    </div>
  </section>
)

export default HeroSection
