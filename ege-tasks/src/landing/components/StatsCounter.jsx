import { useEffect, useRef, useState } from 'react'

const STATS = [
  { value: 1000, suffix: '+', label: 'задач в базе' },
  { value: 30, suffix: '+', label: 'достижений для учеников' },
  { value: 8, suffix: '', label: 'генераторов и режимов' },
  { value: 3, suffix: '', label: 'минуты на работу' },
]

function animateCount(start, end, duration, callback) {
  const startTime = performance.now()
  const step = (now) => {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 4) // easeOutQuart
    callback(Math.round(start + (end - start) * eased))
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

const StatItem = ({ value, suffix, label }) => {
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true)
          animateCount(0, value, 2000, setCount)
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value, started])

  return (
    <div className="landing-stat-item landing-stagger" ref={ref}>
      <div className="landing-stat-number">
        {count}<span className="landing-stat-suffix">{suffix}</span>
      </div>
      <div className="landing-stat-label">{label}</div>
    </div>
  )
}

const StatsCounter = () => (
  <section className="landing-stats landing-animate">
    <div className="landing-container">
      <div className="landing-stats-grid">
        {STATS.map((stat, i) => (
          <StatItem key={i} {...stat} />
        ))}
      </div>
    </div>
  </section>
)

export default StatsCounter
