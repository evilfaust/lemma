import { APP_VERSION } from '@shared/version/buildInfo'
import { GITHUB_URL } from './nav'

const FooterV2 = () => (
  <>
    {/* CTA */}
    <section className="v2-cta v2-section">
      <div className="v2-cta-mesh" />
      <div className="v2-container v2-cta-content">
        <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
          Посмотрите, <span className="v2-gradient-text">как устроено</span>
        </h2>
        <p>
          Lemma бесплатна, а код открыт: исходники, история изменений и запуск —
          на GitHub. Ученики подключаются по ссылке или QR-коду.
        </p>
        <a href={GITHUB_URL} className="v2-btn v2-btn--primary">
          Исходный код на GitHub →
        </a>
        <a href="/how-it-works.html" className="v2-btn v2-btn--outline">
          Как работает приложение
        </a>
      </div>
    </section>

    {/* Footer */}
    <footer className="v2-footer">
      <div className="v2-container v2-footer-inner">
        <span>Lemma &copy; {new Date().getFullYear()} Oleg Pavlyuchenko • v{APP_VERSION}</span>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <a href="https://oipav.ru" className="v2-footer-link">oipav.ru</a>
          <a href={GITHUB_URL} className="v2-footer-link">github.com/evilfaust/lemma</a>
          <a href={`${GITHUB_URL}/blob/main/LICENSE`} className="v2-footer-link">AGPL-3.0</a>
        </div>
      </div>
    </footer>
  </>
)

export default FooterV2
