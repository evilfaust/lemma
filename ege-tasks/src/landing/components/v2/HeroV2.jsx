import { APP_VERSION } from '@shared/version/buildInfo'

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
          v{APP_VERSION} // open source // free
        </div>

      <h1 className="v2-hero-title">
        <span className="v2-hero-outline">{'\u041C\u0410\u0422\u0415\u041C\u0410\u0422\u0418\u041A\u0410'}</span>
        <br />
        <span className="v2-gradient-text">{'7000+ \u0437\u0430\u0434\u0430\u0447'}</span>
        <br />
        {'0 \u0440\u0443\u0442\u0438\u043D\u044B'}
      </h1>

      <p className="v2-hero-subtitle">
        {'LaTeX-\u0444\u043E\u0440\u043C\u0443\u043B\u044B, \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u0440\u0430\u0431\u043E\u0442 \u0437\u0430 \u0441\u0435\u043A\u0443\u043D\u0434\u044B, \u0442\u0435\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043F\u043E QR-\u043A\u043E\u0434\u0443, 72+ \u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u0439. \u0412\u0441\u0451 \u0434\u043B\u044F \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0438 \u043A \u0415\u0413\u042D \u2014 \u0432 \u043E\u0434\u043D\u043E\u043C \u043C\u0435\u0441\u0442\u0435.'}
      </p>

      <div className="v2-hero-actions">
        <a href="https://task-ege.oipav.ru" className="v2-btn v2-btn--primary">
          {'\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0443'}
        </a>
        <a href="#features" className="v2-btn v2-btn--outline"
           onClick={(e) => { e.preventDefault(); document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' }) }}>
          {'\u0423\u0437\u043D\u0430\u0442\u044C \u0431\u043E\u043B\u044C\u0448\u0435'}
        </a>
        <a href="/how-it-works.html" className="v2-btn v2-btn--outline">
          Как работает
        </a>
      </div>
    </div>

    <div className="v2-hero-scroll">
      <div className="v2-hero-scroll-line" />
      <span className="v2-hero-scroll-text">scroll</span>
    </div>
  </section>
)

export default HeroV2
