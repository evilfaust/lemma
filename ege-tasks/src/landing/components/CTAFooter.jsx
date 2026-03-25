const CTAFooter = () => (
  <>
    {/* CTA Section */}
    <section className="landing-cta">
      <div className="landing-container landing-cta-content">
        <h2 className="landing-section-title">
          Начните прямо сейчас
        </h2>
        <p className="landing-cta-subtitle">
          Бесплатно для учителя. Ученики подключаются по ссылке или QR-коду.
        </p>
        <a href="https://task-ege.oipav.ru" className="landing-btn landing-btn-white">
          Открыть учительский интерфейс &rarr;
        </a>
      </div>
    </section>

    {/* Footer */}
    <footer className="landing-footer">
      <div className="landing-container landing-footer-inner">
        <span>Lemma &copy; {new Date().getFullYear()}</span>
        <a href="https://task-ege.oipav.ru" className="landing-footer-link">
          task-ege.oipav.ru
        </a>
      </div>
    </footer>
  </>
)

export default CTAFooter
