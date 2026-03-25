import { useEffect, useState } from 'react'
import HeroSection from './components/HeroSection'
import StatsCounter from './components/StatsCounter'
import FeaturesShowcase from './components/FeaturesShowcase'
import HowItWorks from './components/HowItWorks'
import StudentExperience from './components/StudentExperience'
import AchievementsShowcase from './components/AchievementsShowcase'
import TeacherTestimonials from './components/TeacherTestimonials'
import CTAFooter from './components/CTAFooter'

const LandingPage = () => {
  const [navScrolled, setNavScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    // Scroll reveal
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('landing-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    )
    document.querySelectorAll('.landing-animate').forEach(el => observer.observe(el))

    // Navbar background on scroll
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
    <div className="landing-page">
      {/* Navbar */}
      <nav className={`landing-nav ${navScrolled ? 'landing-nav--scrolled' : ''}`}>
        <div className="landing-container landing-nav-inner">
          <a href="#" className="landing-nav-logo">
            <span className="landing-nav-logo-icon">L</span>
            Lemma
          </a>

          <ul className="landing-nav-links">
            <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features') }}>Возможности</a></li>
            <li><a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works') }}>Как работает</a></li>
            <li><a href="#students" onClick={(e) => { e.preventDefault(); scrollTo('students') }}>Для учеников</a></li>
            <li><a href="#achievements" onClick={(e) => { e.preventDefault(); scrollTo('achievements') }}>Достижения</a></li>
            <li>
              <a href="https://task-ege.oipav.ru" className="landing-btn landing-btn-primary landing-nav-cta">
                Для учителя
              </a>
            </li>
          </ul>

          <button className="landing-nav-burger" onClick={() => setMobileMenuOpen(true)}>
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className={`landing-mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <button className="landing-mobile-close" onClick={() => setMobileMenuOpen(false)}>
          &times;
        </button>
        <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features') }}>Возможности</a>
        <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works') }}>Как работает</a>
        <a href="#students" onClick={(e) => { e.preventDefault(); scrollTo('students') }}>Для учеников</a>
        <a href="#achievements" onClick={(e) => { e.preventDefault(); scrollTo('achievements') }}>Достижения</a>
        <a href="https://task-ege.oipav.ru" className="landing-btn landing-btn-primary">Открыть для учителя</a>
      </div>

      {/* Sections */}
      <HeroSection />
      <StatsCounter />
      <FeaturesShowcase />
      <HowItWorks />
      <StudentExperience />
      <AchievementsShowcase />
      <TeacherTestimonials />
      <CTAFooter />
    </div>
  )
}

export default LandingPage
