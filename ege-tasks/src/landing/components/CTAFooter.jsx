const CTAFooter = () => (
  <>
    {/* CTA Section */}
    <section className="landing-cta">
      <div className="landing-container landing-cta-content">
        <h2 className="landing-section-title">
          Начните прямо сейчас
        </h2>
        <p className="landing-cta-subtitle">
          Бесплатно. Без регистрации. Просто откройте и работайте.
        </p>
        <a href="https://task-ege.oipav.ru" className="landing-btn landing-btn-white">
          Открыть платформу &rarr;
        </a>
      </div>
    </section>

    {/* Footer */}
    <footer className="landing-footer">
      <div className="landing-container landing-footer-inner">
        <span>EGE Tasks Manager &copy; {new Date().getFullYear()}</span>
        <a href="https://task-ege.oipav.ru" className="landing-footer-link">
          task-ege.oipav.ru
        </a>
      </div>
    </footer>
  </>
)

export default CTAFooter
