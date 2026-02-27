import { useState, useEffect } from 'react'
import LandingPage from './LandingPage'
import LandingPageV2 from './LandingPageV2'

const LandingApp = () => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('landing-theme') || 'v1'
  })

  useEffect(() => {
    localStorage.setItem('landing-theme', theme)
    window.scrollTo(0, 0)
  }, [theme])

  return (
    <>
      {theme === 'v1' ? <LandingPage /> : <LandingPageV2 />}

      <div className="theme-switcher">
        <button
          className={`theme-switcher-btn ${theme === 'v1' ? 'theme-switcher-btn--active' : ''}`}
          onClick={() => setTheme('v1')}
        >
          Classic
        </button>
        <button
          className={`theme-switcher-btn ${theme === 'v2' ? 'theme-switcher-btn--active' : ''}`}
          onClick={() => setTheme('v2')}
        >
          Neon
        </button>
      </div>
    </>
  )
}

export default LandingApp
