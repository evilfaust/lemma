import { useEffect, useMemo, useRef, useState } from 'react'
import StereoCanvas from '../../../components/stereo/StereoCanvas'
import { parseStereoBlock } from '../../../utils/stereo/dsl'
import { evaluateScene } from '../../../utils/stereo/scene'
import { clampCamera } from '../../../utils/stereo/camera'

// Живой чертёж на лендинге — тот же движок и холст, что у учителя и в эфире.
// Сечение куба строится по шагам и крутится само; мышью его можно повернуть.
// Грузится отдельным чанком (DrawingsV2 → lazy), лендинг без него лёгкий.

// Команды — ровно как их набирает учитель в строке редактора.
const COMMANDS = ['M на AA1 1:2', 'N на CC1 2:1', 'K на B1C1 0,5', 'сечение MNK']

const SPEC = [
  'куб 4',
  'цвет',
  'вид 35 22',
  ...COMMANDS,
  'цвет сечения MNK зелёный',
].join('\n')

const STEP_MS = 1700
const HOLD_MS = 4200
const YAW_PER_SEC = 9
const IDLE_AFTER_TOUCH_MS = 6000

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function LiveStereo() {
  const parsed = useMemo(() => parseStereoBlock(SPEC), [])
  const total = parsed.scene.ops.length
  const reduced = useMemo(prefersReducedMotion, [])

  const [camera, setCamera] = useState(parsed.camera)
  const [step, setStep] = useState(reduced ? total : 0)
  const [flash, setFlash] = useState(null)
  const [visible, setVisible] = useState(false)
  const wrapRef = useRef(null)
  const touchedAt = useRef(0)

  // Анимация идёт только пока блок на экране.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Шаги построения по кругу: тело → четыре шага → пауза на готовом чертеже.
  useEffect(() => {
    if (!visible || reduced) return undefined
    const t = setTimeout(() => {
      const next = step >= total ? 0 : step + 1
      setStep(next)
      setFlash(next > 0 ? next - 1 : null)
    }, step >= total ? HOLD_MS : STEP_MS)
    return () => clearTimeout(t)
  }, [step, total, visible, reduced])

  // Медленное вращение; после жеста пользователя — пауза.
  useEffect(() => {
    if (!visible || reduced) return undefined
    let raf
    let last = performance.now()
    const tick = (now) => {
      const dt = (now - last) / 1000
      last = now
      if (now - touchedAt.current > IDLE_AFTER_TOUCH_MS) {
        setCamera((c) => ({ ...c, yaw: c.yaw + YAW_PER_SEC * dt }))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible, reduced])

  const model = useMemo(() => {
    try { return evaluateScene(parsed.scene, { upTo: step }) } catch { return null }
  }, [parsed, step])

  const onCameraChange = (c) => {
    touchedAt.current = performance.now()
    setCamera(clampCamera(c))
  }

  const command = step > 0 ? COMMANDS[step - 1] : null
  const caption = step === 0
    ? 'Куб ABCDA₁B₁C₁D₁'
    : step === total ? 'Сечение готово — невидимые линии сами ушли в пунктир' : `Шаг ${step} из ${total}`

  return (
    <div className="v2-stereo" ref={wrapRef}>
      <div className="v2-stereo-bar">
        <span className="v2-stereo-dot" /><span className="v2-stereo-dot" /><span className="v2-stereo-dot" />
        <span className="v2-stereo-bar-title">Стереометрия · эфир 10 Б</span>
        <span className="v2-stereo-live">● эфир</span>
      </div>
      <div className="v2-stereo-stage">
        {model && (
          <StereoCanvas
            model={model}
            camera={camera}
            onCameraChange={onCameraChange}
            flashStep={flash}
            wheelZoom="modifier"
            ariaLabel="Сечение куба: чертёж строится по шагам, его можно крутить мышью"
          />
        )}
      </div>
      <div className="v2-stereo-cmd" aria-live="polite">
        <span className="v2-stereo-prompt">›</span>
        <span className="v2-stereo-cmd-text">{command || 'куб 4'}</span>
        <span className="v2-stereo-caret" />
        <span className="v2-stereo-caption">{caption}</span>
      </div>
    </div>
  )
}
