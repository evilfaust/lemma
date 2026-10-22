import { lazy, Suspense, useEffect, useRef, useState } from 'react'

const LiveStereo = lazy(() => import('./LiveStereo'))
const PlanimSample = lazy(() => import('./PlanimSample'))

// Исходник блока для показа слева от готового чертежа (тот же, что в PlanimSample).
const PLANIM_LINES = [
  'треугольник ABC 7 8 6',
  'H = высота B AC',
  'I = вписанная ABC',
  'угол BAC α',
]

const POINTS = [
  {
    title: 'Строите кликами или текстом',
    desc: 'Инструментами на чертеже или командой: «M на AA1 1:2», «X = MN ∩ AC», «сечение MNK». Невидимые линии сами уходят в пунктир.',
  },
  {
    title: 'Эфир на телефоны учеников',
    desc: 'Ученик открывает ссылку без входа и видит построение вживую — и крутит чертёж сам. «Все смотрят сюда» поворачивает его у всего класса.',
  },
  {
    title: 'От куба до шара',
    desc: 'Призмы и пирамиды, наклонные и усечённые, тела вращения, ступенчатые многогранники, жидкость в сосуде. Перпендикуляры, углы, подписи длин.',
  },
  {
    title: 'Генератор задач по чертежу',
    desc: 'Сечения, углы, расстояния, объёмы и первая часть ЕГЭ (Б11, Б13, П3). Ответ пересчитывается по самому чертежу — неверное задание не попадёт в работу.',
  },
]

// Движок чертежей (~90 КБ сжатого) качается, только когда до блока
// осталось около экрана прокрутки, — первой отрисовке страницы он не мешает.
function useNearViewport(margin = '600px') {
  const ref = useRef(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setNear(true); return undefined }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setNear(true); io.disconnect() }
    }, { rootMargin: margin })
    io.observe(el)
    return () => io.disconnect()
  }, [margin])
  return [ref, near]
}

const StereoFallback = () => (
  <div className="v2-stereo v2-stereo--loading">
    <div className="v2-stereo-stage" />
  </div>
)

const DrawingsV2 = () => {
  const [ref, near] = useNearViewport()
  return (
    <section className="v2-section v2-drawings" id="drawings" ref={ref}>
      <div className="v2-drawings-bg" />
      <div className="v2-container">
        <div className="v2-section-header v2-reveal">
          <span className="v2-label">Живые чертежи</span>
          <h2 className="v2-heading" style={{ fontSize: 'clamp(32px, 5vw, 56px)' }}>
            Чертёж строится <span className="v2-gradient-text">на глазах у класса</span>
          </h2>
          <p>
            Свои редакторы стереометрии и планиметрии. Учитель строит сечение
            на ноутбуке — ученики видят то же построение в телефонах.
          </p>
        </div>

        <div className="v2-split v2-reveal">
          <div className="v2-split-visual">
            {near ? (
              <Suspense fallback={<StereoFallback />}>
                <LiveStereo />
              </Suspense>
            ) : <StereoFallback />}
            <p className="v2-visual-note">Это настоящий чертёж Lemma — поверните его мышью.</p>
          </div>

          <ul className="v2-points">
            {POINTS.map(p => (
              <li key={p.title} className="v2-point v2-stagger">
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="v2-planim v2-reveal">
          <div className="v2-planim-text">
            <span className="v2-label">Планиметрия</span>
            <h3>Чертёж — несколькими строками в условии задачи</h3>
            <p>
              Треугольник с высотой, вписанная окружность, касательные, равные
              отрезки. Чертёж живёт прямо в тексте задачи и на печати строится
              под место: буквы того же размера, что в условии. Сложное — по-прежнему
              в GeoGebra.
            </p>
          </div>
          <pre className="v2-planim-code"><code>
            <span className="v2-code-fence">```planim</span>{'\n'}
            {PLANIM_LINES.join('\n')}{'\n'}
            <span className="v2-code-fence">```</span>
          </code></pre>
          <div className="v2-planim-arrow" aria-hidden="true">→</div>
          <div className="v2-paper">
            {near ? (
              <Suspense fallback={<div className="v2-planim-figure" />}>
                <PlanimSample />
              </Suspense>
            ) : <div className="v2-planim-figure" />}
          </div>
        </div>
      </div>
    </section>
  )
}

export default DrawingsV2
