import { useEffect, useState } from 'react'
import HeroV2 from './components/v2/HeroV2'
import StatsV2 from './components/v2/StatsV2'
import FeaturesV2 from './components/v2/FeaturesV2'
import TimelineV2 from './components/v2/TimelineV2'
import StudentV2 from './components/v2/StudentV2'
import AchievementsV2 from './components/v2/AchievementsV2'
import TestimonialsV2 from './components/v2/TestimonialsV2'
import FooterV2 from './components/v2/FooterV2'

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

  const scrollTo = (id) => {
    setMobileMenuOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="v2-page">
      {/* Navbar */}
      <nav className={`v2-nav ${navScrolled ? 'v2-nav--scrolled' : ''}`}>
        <div className="v2-container v2-nav-inner">
          <a href="#" className="v2-nav-logo">
            <span className="v2-nav-logo-mark">E</span>
            EGE Tasks
          </a>

          <ul className="v2-nav-links">
            <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features') }}>{'\u0412\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438'}</a></li>
            <li><a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works') }}>{'\u041F\u0440\u043E\u0446\u0435\u0441\u0441'}</a></li>
            <li><a href="#students" onClick={(e) => { e.preventDefault(); scrollTo('students') }}>{'\u0423\u0447\u0435\u043D\u0438\u043A\u0438'}</a></li>
            <li><a href="#achievements" onClick={(e) => { e.preventDefault(); scrollTo('achievements') }}>{'\u0414\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u044F'}</a></li>
            <li>
              <a href="https://task-ege.oipav.ru" className="v2-btn v2-btn--primary v2-nav-cta">
                {'\u041E\u0442\u043A\u0440\u044B\u0442\u044C'}
              </a>
            </li>
          </ul>

          <button className="v2-nav-burger" onClick={() => setMobileMenuOpen(true)}>
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className={`v2-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="v2-mobile-close" onClick={() => setMobileMenuOpen(false)}>
          &times;
        </button>
        <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features') }}>{'\u0412\u043E\u0437\u043C\u043E\u0436\u043D\u043E\u0441\u0442\u0438'}</a>
        <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works') }}>{'\u041F\u0440\u043E\u0446\u0435\u0441\u0441'}</a>
        <a href="#students" onClick={(e) => { e.preventDefault(); scrollTo('students') }}>{'\u0423\u0447\u0435\u043D\u0438\u043A\u0438'}</a>
        <a href="#achievements" onClick={(e) => { e.preventDefault(); scrollTo('achievements') }}>{'\u0414\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u044F'}</a>
        <a href="https://task-ege.oipav.ru" className="v2-btn v2-btn--primary">{'\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0443'}</a>
      </div>

      {/* Sections */}
      <HeroV2 />
      <StatsV2 />
      <FeaturesV2 />
      <TimelineV2 />
      <StudentV2 />
      <AchievementsV2 />
      <TestimonialsV2 />
      <FooterV2 />
    </div>
  )
}

export default LandingPageV2
