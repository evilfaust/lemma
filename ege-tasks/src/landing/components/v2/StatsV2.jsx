import { useEffect, useRef, useState } from 'react'

// Округлено вниз, чтобы страница не устаревала с каждым импортом:
// 30,7 тыс. задач банка + 18 тыс. по геометрии (октябрь 2026).
const STATS = [
  { value: 48000, suffix: '+', label: 'задач в банке, из них 18 000 по геометрии', color: 'cyan' },
  { value: 45, suffix: '+', label: 'генераторов и тренажёров', color: 'purple' },
  { value: 106, suffix: '', label: 'достижений для учеников', color: 'pink' },
  { value: 3, suffix: '', label: 'экзамена: ОГЭ, база и профиль-2027', color: 'orange' },
]

function animateCount(start, end, duration, callback) {
  const startTime = performance.now()
  const step = (now) => {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 4)
    callback(Math.round(start + (end - start) * eased))
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

const StatItem = ({ value, suffix, label, color }) => {
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
    <div className="v2-stat v2-stagger" ref={ref}>
      <div className={`v2-stat-number v2-stat-number--${color}`}>
        {count.toLocaleString('ru-RU')}<span>{suffix}</span>
      </div>
      <div className="v2-stat-label">{label}</div>
    </div>
  )
}

const StatsV2 = () => (
  <section className="v2-stats v2-reveal">
    <div className="v2-container">
      <div className="v2-stats-grid">
        {STATS.map((stat, i) => (
          <StatItem key={i} {...stat} />
        ))}
      </div>
    </div>
  </section>
)

export default StatsV2
