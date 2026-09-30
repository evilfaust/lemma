import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { api } from '../../shared/services/pocketbase';
import StereoCanvas from './StereoCanvas';
import { evaluateScene } from '../../utils/stereo/scene';
import { DEFAULT_CAMERA, clampCamera } from '../../utils/stereo/camera';
import { describeOp } from '../../utils/stereo/commands';
import { sceneOfRoom } from '../../utils/stereo/room';
import './stereo.css';

// Планиметрический чертёж лежит в той же коллекции (kind = 'planim') и
// открывается по той же ссылке — у него свой холст, грузится только по нужде.
const StudentPlanimManual = lazy(() => import('../planim/StudentPlanimManual'));

/**
 * Пошаговое пособие: student.oipav.ru/s/<id> — сохранённый чертёж, который
 * учитель открыл ученикам. Ученик листает шаги (◀ ▶ или стрелки) и крутит
 * чертёж сам; строить здесь нечего — строить он учится в тетради.
 */
export default function StudentStereoManual({ id }) {
  const [rec, setRec] = useState(undefined); // undefined — грузим, null — недоступно
  const [step, setStep] = useState(0);
  const [camera, setCamera] = useState(DEFAULT_CAMERA);
  const [flashStep, setFlashStep] = useState(null);

  useEffect(() => {
    let alive = true;
    api.getPublicStereoScene(id)
      .then((r) => {
        if (!alive) return;
        setRec(r);
        if (r?.camera) setCamera(clampCamera({ ...DEFAULT_CAMERA, ...r.camera }));
      })
      .catch(() => alive && setRec(null));
    return () => { alive = false; };
  }, [id]);

  const scene = sceneOfRoom(rec);
  const total = scene?.ops?.length || 0;
  const model = useMemo(() => {
    if (!scene) return null;
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

  useEffect(() => {
    if (rec?.title) document.title = `${rec.title} — Lemma`;
  }, [rec?.title]);

  const current = step > 0 && model ? model.steps[step - 1] : null;

  if (rec?.kind === 'planim') {
    return <Suspense fallback={null}><StudentPlanimManual rec={rec} /></Suspense>;
  }

  return (
    <div className="ssb">
      <header className="ssb__head">
        <span className="ssb__brand">{rec?.title || 'Lemma · Стереометрия'}</span>
        {total > 0 && <span className="ssb__off">шаг {step} из {total}</span>}
      </header>

      <main className="ssb__stage">
        {model ? (
          <StereoCanvas
            model={model}
            camera={camera}
            onCameraChange={setCamera}
            flashStep={flashStep}
            className="ssb__canvas"
            ariaLabel="Чертёж — его можно поворачивать"
          />
        ) : (
          <div className="ssb__empty">
            {rec === undefined
              ? <div className="ssb__spinner" aria-hidden />
              : (
                <>
                  <p><b>Пособие недоступно</b></p>
                  <p>Учитель закрыл ссылку или удалил чертёж.</p>
                </>
              )}
          </div>
        )}
        {rec?.note && step === 0 && <div className="ssb__banner">{rec.note}</div>}
      </main>

      {model && (
        <footer className="ssb__foot ssb__foot--manual">
          <button type="button" className="ssb__nav" onClick={() => go(step - 1)} disabled={step <= 0} aria-label="Предыдущий шаг">◀</button>
          <div className="ssb__step">
            {current
              ? <>Шаг {step}: {describeOp(current.op, model.opsById)}</>
              : 'Сначала — само тело. Покрутите его и листайте шаги ▶'}
            {current?.op.note && <span className="ssb__note">{current.op.note}</span>}
          </div>
          <button type="button" className="ssb__nav" onClick={() => go(step + 1)} disabled={step >= total} aria-label="Следующий шаг">▶</button>
        </footer>
      )}
    </div>
  );
}
