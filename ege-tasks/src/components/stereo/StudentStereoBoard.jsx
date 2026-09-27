import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../shared/services/pocketbase';
import StereoCanvas from './StereoCanvas';
import { evaluateScene } from '../../utils/stereo/scene';
import { DEFAULT_CAMERA } from '../../utils/stereo/camera';
import { describeOp } from '../../utils/stereo/commands';
import {
  roomChanges, interpolateCamera, chaseCamera, sceneOfRoom, isRoomLead,
} from '../../utils/stereo/room';
import './stereo.css';

const SEARCH_MS = 4000;
const POLL_MS = 8000;
const ANIM_MS = 450;

/**
 * Ученический экран эфира: student.oipav.ru/b/<code>.
 *
 * Ученик ничего не строит — только смотрит и крутит свой чертёж. Стоит
 * покрутить — слежение за учителем выключается, кнопка «Как у учителя»
 * возвращает. Команду учителя «Смотрите отсюда» получают все, даже те, кто
 * крутил сам. «Все смотрят сюда» (camera.lead) — ученик следит за каждым
 * поворотом учителя и сам не крутит, пока учитель не отпустит.
 *
 * Надёжность — как у эфира марафона: подписка на запись + опрос. Выключенный
 * эфир realtime не доставит (viewRule), его ловит опрос; после этого страница
 * снова ждёт эфир по коду, а последний чертёж остаётся на экране.
 */
export default function StudentStereoBoard({ code }) {
  const [phase, setPhase] = useState('search'); // search | live | ended
  const [room, setRoom] = useState(null);
  const [camera, setCamera] = useState(DEFAULT_CAMERA);
  const [follow, setFollow] = useState(true);
  const [flashStep, setFlashStep] = useState(null);
  const [pulse, setPulse] = useState(null);
  const [notice, setNotice] = useState(null);
  const [showHint, setShowHint] = useState(true);

  const prevRef = useRef(null);
  const cameraRef = useRef(camera);
  cameraRef.current = camera;
  const animRef = useRef(0);
  const timers = useRef({});

  const later = (key, fn, ms) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  };
  useEffect(() => () => {
    Object.values(timers.current).forEach(clearTimeout);
    cancelAnimationFrame(animRef.current);
  }, []);

  // «Все смотрят сюда»: камера догоняет последний ракурс учителя каждый кадр.
  const chaseTarget = useRef(null);
  const chaseTo = useCallback((target) => {
    const running = chaseTarget.current;
    chaseTarget.current = target;
    if (running) return; // цикл уже идёт — он подхватит новую цель
    cancelAnimationFrame(animRef.current);
    let last = performance.now();
    const step = (now) => {
      const goal = chaseTarget.current;
      if (!goal) return;
      const r = chaseCamera(cameraRef.current, goal, now - last);
      last = now;
      cameraRef.current = r.camera;
      setCamera(r.camera);
      if (r.done) { chaseTarget.current = null; return; }
      animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  const animateTo = useCallback((target) => {
    chaseTarget.current = null;
    cancelAnimationFrame(animRef.current);
    const from = cameraRef.current;
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ANIM_MS);
      const e = 1 - (1 - k) ** 3;
      setCamera(interpolateCamera(from, target, e));
      if (k < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
  }, []);

  const applyRoom = useCallback((rec) => {
    if (!rec) return;
    const prev = prevRef.current;
    if (prev && rec.id === prev.id && rec.updated && prev.updated && rec.updated < prev.updated) return;
    if (!rec.live) { setPhase('ended'); return; }
    const ch = roomChanges(prev && prev.id === rec.id ? prev : null, rec);
    prevRef.current = rec;
    setRoom(rec);
    setPhase('live');
    if (ch.reset) setFlashStep(null);
    if (ch.flashStep != null) {
      setFlashStep(ch.flashStep);
      later('flash', () => setFlashStep(null), 1800);
    }
    // Ракурс учителя — всем: и «Смотрите отсюда», и «Все смотрят сюда»
    // возвращают слежение даже тем, кто крутил сам.
    if (ch.camera) {
      setFollow(true);
      setShowHint(false);
      if (ch.lead) chaseTo(ch.camera); else animateTo(ch.camera);
    }
    if (ch.pulse) {
      setPulse({ points: new Set(ch.pulse.points || []), lines: new Set(ch.pulse.lines || []), key: Date.now() });
      later('pulse', () => setPulse(null), 3000);
    }
    if (ch.notice) {
      setNotice(ch.notice);
      later('notice', () => setNotice(null), 7000);
    }
  }, [animateTo, chaseTo]);

  // Поиск эфира по коду — пока эфира нет.
  useEffect(() => {
    if (phase === 'live') return undefined;
    let alive = true;
    const tick = async () => {
      try {
        const rec = await api.findLiveStereoRoom(code);
        if (alive && rec) applyRoom(rec);
      } catch { /* сеть моргнула — попробуем ещё */ }
    };
    tick();
    const iv = setInterval(tick, SEARCH_MS);
    return () => { alive = false; clearInterval(iv); };
  }, [phase, code, applyRoom]);

  // Эфир идёт: подписка + опрос.
  const roomId = phase === 'live' ? room?.id : null;
  useEffect(() => {
    if (!roomId) return undefined;
    let alive = true;
    api.subscribeStereoRoom(roomId, (e) => {
      if (!alive) return;
      if (e.action === 'delete') setPhase('ended');
      else applyRoom(e.record);
    }).catch(() => { /* останется опрос */ });
    const poll = async () => {
      try {
        const rec = await api.getStereoRoom(roomId);
        if (!alive) return;
        if (!rec) setPhase('ended');
        else applyRoom(rec);
      } catch { /* сеть */ }
    };
    const iv = setInterval(poll, POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVisible);
      api.unsubscribeStereoRoom(roomId).catch(() => {});
    };
  }, [roomId, applyRoom]);

  const scene = sceneOfRoom(room);
  const model = useMemo(() => {
    if (!scene) return null;
    try { return evaluateScene(scene); } catch { return null; }
  }, [scene]);

  const lastStep = useMemo(() => {
    if (!model) return null;
    const ok = model.steps.filter((s) => s.ok);
    const last = ok[ok.length - 1];
    return last ? { text: `Шаг ${ok.length}: ${describeOp(last.op, model.opsById)}`, note: last.op.note || '' } : null;
  }, [model]);

  const lead = phase === 'live' && isRoomLead(room);

  const onCameraChange = useCallback((cam) => {
    chaseTarget.current = null;
    cancelAnimationFrame(animRef.current);
    setCamera(cam);
    setFollow(false);
    setShowHint(false);
  }, []);

  const backToTeacher = () => {
    setFollow(true);
    animateTo(room?.camera ? { ...DEFAULT_CAMERA, ...room.camera } : DEFAULT_CAMERA);
  };

  return (
    <div className="ssb">
      <header className="ssb__head">
        <span className="ssb__brand">Lemma · Стереометрия</span>
        {phase === 'live'
          ? <span className="ssb__live">в эфире</span>
          : <span className="ssb__off">эфир не идёт</span>}
      </header>

      <main className="ssb__stage">
        {model ? (
          <StereoCanvas
            model={model}
            camera={camera}
            onCameraChange={lead ? undefined : onCameraChange}
            cursor={lead ? 'default' : 'grab'}
            flashStep={flashStep}
            pulse={pulse}
            className="ssb__canvas"
            ariaLabel="Чертёж учителя — его можно поворачивать"
          />
        ) : (
          <div className="ssb__empty">
            <div className="ssb__spinner" aria-hidden />
            <p><b>Ждём учителя</b></p>
            <p>Когда учитель начнёт показ, чертёж появится здесь сам —
              обновлять страницу не нужно.</p>
            <p className="ssb__code">Комната: {code}</p>
          </div>
        )}
        {model && lead && (
          <div className="ssb__lead" role="status">Учитель показывает — смотрите</div>
        )}
        {model && showHint && !lead && (
          <div className="ssb__hint">Крутите пальцем · два пальца — масштаб</div>
        )}
        {phase === 'ended' && model && (
          <div className="ssb__banner">Показ завершён — чертёж остаётся, его можно крутить</div>
        )}
        {notice && <div className="ssb__notice" role="status">{notice}</div>}
      </main>

      {model && (
        <footer className="ssb__foot">
          <div className="ssb__step">
            {lastStep ? lastStep.text : 'Пока только тело — смотрите на доску'}
            {lastStep?.note && <span className="ssb__note">{lastStep.note}</span>}
          </div>
          {lead ? (
            <span className="ssb__follow is-on is-locked">Показывает учитель</span>
          ) : (
            <button
              type="button"
              className={`ssb__follow${follow ? ' is-on' : ''}`}
              onClick={backToTeacher}
            >
              {follow ? 'Как у учителя ✓' : 'Как у учителя'}
            </button>
          )}
        </footer>
      )}
    </div>
  );
}
