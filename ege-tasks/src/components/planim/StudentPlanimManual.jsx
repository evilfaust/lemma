import { useEffect, useMemo, useState } from 'react';
import PlanimCanvas from './PlanimCanvas';
import { evaluateScene } from '../../utils/planim/scene';
import { describeOp } from '../../utils/planim/commands';
import '../stereo/stereo.css';

// С какого шага начинать: сама фигура (свободные точки и её контур) видна
// сразу, листать — построения.
const FIGURE_OPS = new Set(['point', 'polygon']);
export function firstManualStep(ops = []) {
  let k = 0;
  while (k < ops.length && FIGURE_OPS.has(ops[k].type)) k += 1;
  return k;
}

/**
 * Пошаговое пособие по планиметрическому чертежу: student.oipav.ru/s/<id>
 * (та же ссылка, что у стереочертежа, — запись одна, отличает её kind).
 * Ученик листает шаги (◀ ▶ или стрелки), двигать и масштабировать лист можно,
 * строить — нет.
 */
export default function StudentPlanimManual({ rec }) {
  const scene = useMemo(() => (Array.isArray(rec?.scene?.ops) ? rec.scene : { ops: [] }), [rec]);
  const total = scene.ops.length;
  const base = useMemo(() => firstManualStep(scene.ops), [scene]);
  const [step, setStep] = useState(() => base);
  const [view, setView] = useState(null);
  const [flashStep, setFlashStep] = useState(null);

  const full = useMemo(() => {
    try { return evaluateScene(scene); } catch { return null; }
  }, [scene]);
  const model = useMemo(() => {
    try { return evaluateScene(scene, { upTo: step }); } catch { return null; }
  }, [scene, step]);

  const go = (k) => {
    const n = Math.max(0, Math.min(total, k));
    setStep(n);
    setFlashStep(n > 0 ? n - 1 : null);
  };

  useEffect(() => {
    if (flashStep == null) return undefined;
    const t = setTimeout(() => setFlashStep(null), 1800);
    return () => clearTimeout(t);
  }, [flashStep]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(step + 1);
      if (e.key === 'ArrowLeft') go(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const current = step > 0 && model ? model.steps[step - 1] : null;
  const atBase = step <= base;

  return (
    <div className="ssb">
      <header className="ssb__head">
        <span className="ssb__brand">{rec?.title || 'Lemma · Планиметрия'}</span>
        {total > 0 && <span className="ssb__off">шаг {step} из {total}</span>}
      </header>

      <main className="ssb__stage">
        {model && full ? (
          <PlanimCanvas
            model={model}
            fitModel={full}
            view={view}
            onViewChange={setView}
            flashStep={flashStep}
            showGrid={false}
            cursor="grab"
            className="ssb__canvas"
            ariaLabel="Чертёж — его можно сдвигать и увеличивать"
          />
        ) : (
          <div className="ssb__empty"><p><b>Чертёж не открылся</b></p></div>
        )}
        {rec?.note && atBase && <div className="ssb__banner">{rec.note}</div>}
      </main>

      {model && (
        <footer className="ssb__foot ssb__foot--manual">
          <button type="button" className="ssb__nav" onClick={() => go(step - 1)} disabled={step <= 0} aria-label="Предыдущий шаг">◀</button>
          <div className="ssb__step">
            {current && !atBase
              ? <>Шаг {step}: {describeOp(current.op)}</>
              : 'Сначала — сама фигура. Листайте построение ▶'}
            {current?.op.note && !atBase && <span className="ssb__note">{current.op.note}</span>}
          </div>
          <button type="button" className="ssb__nav" onClick={() => go(step + 1)} disabled={step >= total} aria-label="Следующий шаг">▶</button>
        </footer>
      )}
    </div>
  );
}
