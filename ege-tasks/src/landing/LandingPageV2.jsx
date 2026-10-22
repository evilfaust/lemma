import { useEffect, useState } from 'react'
import HeroV2 from './components/v2/HeroV2'
import StatsV2 from './components/v2/StatsV2'
import DrawingsV2 from './components/v2/DrawingsV2'
import PrepareV2 from './components/v2/PrepareV2'
import LessonV2 from './components/v2/LessonV2'
import CheckV2 from './components/v2/CheckV2'
import JournalV2 from './components/v2/JournalV2'
import StudentV2 from './components/v2/StudentV2'
import AboutV2 from './components/v2/AboutV2'
import FooterV2 from './components/v2/FooterV2'
import { GITHUB_URL, NAV_ITEMS, scrollToSection } from './components/v2/nav'

const LandingPageV2 = () => {
  const [navScrolled, setNavScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('v2-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    document.querySelectorAll('.v2-reveal').forEach(el => observer.observe(el))

    const onScroll = () => setNavScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  const go = (e, id) => {
    e.preventDefault()
    setMobileMenuOpen(false)
    scrollToSection(id)
  }

  return (
    <div className="v2-page">
      {/* Navbar */}
      <nav className={`v2-nav ${navScrolled ? 'v2-nav--scrolled' : ''}`}>
        <div className="v2-container v2-nav-inner">
          <a href="#" className="v2-nav-logo">
            <img src="/lemma-logo-new.png" alt="Lemma" className="v2-nav-logo-img" />
          </a>

          <ul className="v2-nav-links">
            {NAV_ITEMS.map(item => (
              <li key={item.id}>
                <a href={`#${item.id}`} onClick={(e) => go(e, item.id)}>{item.label}</a>
              </li>
            ))}
            <li>
              <a href={GITHUB_URL} className="v2-btn v2-btn--primary v2-nav-cta">GitHub</a>
            </li>
          </ul>

          <button className="v2-nav-burger" aria-label="Меню" onClick={() => setMobileMenuOpen(true)}>
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className={`v2-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="v2-mobile-close" aria-label="Закрыть меню" onClick={() => setMobileMenuOpen(false)}>
          &times;
        </button>
        {NAV_ITEMS.map(item => (
          <a key={item.id} href={`#${item.id}`} onClick={(e) => go(e, item.id)}>{item.label}</a>
        ))}
        <a href="/how-it-works.html">Как работает приложение</a>
        <a href={GITHUB_URL} className="v2-btn v2-btn--primary">Исходный код на GitHub</a>
      </div>

      {/* Sections */}
      <HeroV2 />
      <StatsV2 />
      <DrawingsV2 />
      <PrepareV2 />
      <LessonV2 />
      <CheckV2 />
      <JournalV2 />
      <StudentV2 />
      <AboutV2 />
      <FooterV2 />
    </div>
  )
}

export default LandingPageV2
