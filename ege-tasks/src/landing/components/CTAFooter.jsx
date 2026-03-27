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
        <a href="https://github.com/evilfaust/lemma" className="landing-btn landing-btn-white">
          Открыть учительский интерфейс &rarr;
        </a>
      </div>
    </section>

    {/* Footer */}
    <footer className="landing-footer">
      <div className="landing-container landing-footer-inner">
        <span>Lemma &copy; {new Date().getFullYear()}</span>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <a href="https://oipav.ru" className="landing-footer-link">oipav.ru</a>
          <a href="https://github.com/evilfaust/lemma" className="landing-footer-link">github.com/evilfaust/lemma</a>
        </div>
      </div>
    </footer>
  </>
)

export default CTAFooter
