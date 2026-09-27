import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, App, Button, Form, Input, InputNumber, Modal, Select, Space, Tooltip,
} from 'antd';
import {
  CodeSandboxOutlined, DeleteOutlined, DownloadOutlined, PlusOutlined, UndoOutlined,
  EditOutlined, LeftOutlined, RightOutlined, PlayCircleOutlined, FileTextOutlined, BookOutlined,
} from '@ant-design/icons';
import { WorkspacePageHeader } from '../workspace/ui';
import StereoCanvas from './StereoCanvas';
import StereoLivePanel from './StereoLivePanel';
import StereoTextModal from './StereoTextModal';
import StereoLibrary from './StereoLibrary';
import useStereoLive from '../../hooks/useStereoLive';
import { useOptionalAuth } from '../../contexts/AuthContext';
import {
  evaluateScene, tryAppendOp, removeOpCascade, renamePointInScene,
  parseCommand, describeOp, DEFAULT_CAMERA, DEFAULT_BODY, bodyTitle,
  normalizeBodySpec, BODY_KINDS, TOOLS, toolHint, toolClick, finishPending,
  chooseHit, lineHitParam, snapPosition, pickPoint, pickLine, pickFace,
  renderStereo, stereoSvgString, prettyName, isTeachingNotice,
  draggableOp, lineOfOp, dragPosition, setOpPosition,
  facePointAt, faceDragTarget, dragFacePosition, newOpId,
} from '../../utils/stereo';
import './stereo.css';

const DRAFT_KEY = 'stereo.editor.v1';

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d?.scene?.body || !Array.isArray(d.scene.ops)) return null;
    // У каждого шага должен быть id: на нём держатся удаление, подписи и эфир.
    const ops = d.scene.ops.filter((o) => o && typeof o === 'object').map((o) => (o.id ? o : { ...o, id: newOpId() }));
    const scene = { body: d.scene.body, ops };
    evaluateScene(scene); // битый черновик не должен ронять страницу
    return { ...d, scene };
  } catch {
    return null;
  }
}

const CAMERA_PRESETS = [
  { key: 'book', label: 'Как в учебнике', cam: DEFAULT_CAMERA },
  { key: 'front', label: 'Спереди', cam: { yaw: 0, pitch: 0, zoom: 1 } },
  { key: 'top', label: 'Сверху', cam: { yaw: 0, pitch: 75, zoom: 1 } },
];

function buildHit(frame, x, y, back, model) {
  const point = pickPoint(frame, x, y);
  const lh = pickLine(frame, x, y);
  let line = null;
  if (lh) {
    const { t, pxPerUnit } = lineHitParam(lh, frame.project);
    line = { id: lh.line.id, ref: lh.line.ref, ...snapPosition(t, pxPerUnit) };
  }
  const face = pickFace(frame, x, y, { back });
  return {
    point,
    line,
    face: face ? { id: face.id, verts: face.verts, pos: model ? facePointAt(model, frame, face.id, x, y) : null } : null,
  };
}

/**
 * Редактор стереочертежа (этап 1 — без эфира). План — STEREO_LIVE_PLAN.md.
 * Учитель строит кликами или строкой команд; журнал шагов справа.
 */
export default function StereoEditor() {
  const { modal } = App.useApp();
  const draft = useMemo(loadDraft, []);
  const [scene, setSceneRaw] = useState(() => draft?.scene || { body: DEFAULT_BODY, ops: [] });
  // Отмена — по истории сцен: откатывает и шаги, и перемещения точек.
  const historyRef = useRef([]);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const pushHistory = useCallback((prev) => {
    historyRef.current = [...historyRef.current.slice(-99), prev];
  }, []);
  const setScene = useCallback((next) => {
    const prev = sceneRef.current;
    const value = typeof next === 'function' ? next(prev) : next;
    if (value === prev) return;
    pushHistory(prev);
    sceneRef.current = value;
    setSceneRaw(value);
  }, [pushHistory]);
  const [dragging, setDragging] = useState(null);
  const [hoverMovable, setHoverMovable] = useState(false);
  const [camera, setCamera] = useState(() => draft?.camera || DEFAULT_CAMERA);
  const [tool, setTool] = useState('rotate');
  const [pending, setPending] = useState([]);
  const [hover, setHover] = useState(null);
  const [notice, setNotice] = useState(null);
  const [flashStep, setFlashStep] = useState(null);
  const [cmd, setCmd] = useState('');
  const [cmdError, setCmdError] = useState('');
  const [bodyOpen, setBodyOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);
  // Открытый из библиотеки чертёж и «подпись» сохранённого состояния — по ней
  // видно, есть ли несохранённые изменения.
  const [currentDoc, setCurrentDoc] = useState(() => draft?.doc || null);
  const [savedSig, setSavedSig] = useState(() => draft?.savedSig || '');
  const [bodyForm] = Form.useForm();
  const bodyKind = Form.useWatch('kind', bodyForm);

  const model = useMemo(() => evaluateScene(scene), [scene]);
  // Пошаговый показ: null — всё построение, число — сколько шагов видно.
  const [viewStep, setViewStep] = useState(null);
  const replay = viewStep != null;
  const shownModel = useMemo(
    () => (replay ? evaluateScene(scene, { upTo: viewStep }) : model),
    [replay, scene, viewStep, model],
  );
  const liveScene = useMemo(() => (replay ? { ...scene, upTo: viewStep } : scene), [replay, scene, viewStep]);
  const [editNote, setEditNote] = useState(null); // { opId, text }
  const auth = useOptionalAuth();
  const live = useStereoLive({ scene: liveScene, enabled: !!auth?.canEdit });
  const [pulse, setPulse] = useState(null);

  // Черновик переживает перезагрузку страницы.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ scene, camera, doc: currentDoc, savedSig }));
      } catch { /* приватный режим */ }
    }, 300);
    return () => clearTimeout(t);
  }, [scene, camera, currentDoc, savedSig]);

  const sceneSig = useMemo(() => JSON.stringify(scene), [scene]);
  const dirty = currentDoc ? sceneSig !== savedSig : scene.ops.length > 0;
  const onSaved = useCallback((doc, { keepDirty = false } = {}) => {
    setCurrentDoc(doc);
    if (!keepDirty) setSavedSig(doc ? JSON.stringify(sceneRef.current) : '');
  }, []);

  useEffect(() => {
    if (flashStep == null) return undefined;
    const t = setTimeout(() => setFlashStep(null), 1800);
    return () => clearTimeout(t);
  }, [flashStep]);

  const noticeTimer = useRef(null);
  const { pushNotice, pushPulse } = live;
  const showNotice = useCallback((type, text) => {
    clearTimeout(noticeTimer.current);
    setNotice({ type, text });
    noticeTimer.current = setTimeout(() => setNotice(null), type === 'error' ? 8000 : 5000);
    // «Скрещиваются» — момент урока: в эфире его видит весь класс.
    if (type === 'error' && isTeachingNotice(text)) pushNotice(text);
  }, [pushNotice]);

  const pulseTimer = useRef(null);
  const attention = useCallback((target) => {
    clearTimeout(pulseTimer.current);
    setPulse({ points: new Set(target.points), lines: new Set(target.lines), key: Date.now() });
    pulseTimer.current = setTimeout(() => setPulse(null), 3000);
    pushPulse(target);
  }, [pushPulse]);
  useEffect(() => () => clearTimeout(pulseTimer.current), []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  /** Добавить операцию в журнал; ошибка — объяснение вместо шага. */
  const commit = useCallback((op, { quiet = false } = {}) => {
    const r = tryAppendOp(scene, op);
    if (!r.ok) {
      if (!quiet) showNotice('error', r.error);
      return r;
    }
    setScene(r.scene);
    setFlashStep(r.scene.ops.length - 1);
    if (r.note) showNotice('info', r.note);
    return r;
  }, [scene, showNotice]);

  const undo = useCallback(() => {
    setPending([]);
    const prev = historyRef.current.pop();
    if (prev) { sceneRef.current = prev; setSceneRaw(prev); return; }
    // Черновик после перезагрузки истории не имеет — снимаем последний шаг.
    setSceneRaw((s) => (s.ops.length ? { ...s, ops: s.ops.slice(0, -1) } : s));
  }, []);

  // --- перемещение точек ------------------------------------------------------
  const getDragTarget = useCallback((pt, frame) => {
    if (replay) return null;
    const name = pickPoint(frame, pt.x, pt.y);
    const op = name ? draggableOp(sceneRef.current, name) : null;
    if (!op) return null;
    if (op.type === 'pointOnFace') {
      const ft = faceDragTarget(model, op);
      return ft ? { ...ft, name, opId: op.id } : null;
    }
    const line = lineOfOp(model, op);
    if (!line) return null;
    return { kind: 'line', name, opId: op.id, line, onSegment: op.t >= 0 && op.t <= 1 };
  }, [model, replay]);

  const droppedRef = useRef(false);
  const handleDrag = useCallback(({ phase, x, y, frame, target }) => {
    if (phase === 'start') {
      pushHistory(sceneRef.current);
      setPending([]);
      setDragging(target.name);
      return;
    }
    if (phase === 'end') {
      droppedRef.current = true;
      setDragging(null);
      return;
    }
    const pos = target.kind === 'face'
      ? dragFacePosition(target, frame, x, y, model.body.size)
      : dragPosition(target.line, frame.project, x, y, { onSegment: target.onSegment });
    if (!pos) return;
    const next = setOpPosition(sceneRef.current, target.opId, pos);
    sceneRef.current = next;
    setSceneRaw(next);
  }, [pushHistory, model.body.size]);

  // После сдвига точки часть построений могла перестать строиться
  // (пересечение стало параллельным) — говорим об этом сразу.
  useEffect(() => {
    if (dragging || !droppedRef.current) return;
    droppedRef.current = false;
    const broken = model.steps.filter((st) => !st.ok);
    if (broken.length) {
      showNotice('error', `Шаг ${broken[0].index + 1} теперь не строится: ${broken[0].error}`);
    }
  }, [dragging, model, showNotice]);

  const selectTool = useCallback((key) => {
    setTool(key);
    setPending([]);
    setHover(null);
  }, []);

  // --- клики по чертежу -----------------------------------------------------
  const handleClick = useCallback(({ x, y, frame, shiftKey }) => {
    if (tool === 'rotate' || (replay && tool !== 'attention')) return;
    const r = toolClick(tool, pending, buildHit(frame, x, y, shiftKey, model), model);
    if (r.error) showNotice('error', r.error);
    setPending(r.pending);
    if (r.op) commit(r.op);
    if (r.attention) attention(r.attention);
  }, [tool, pending, model, commit, showNotice, attention, replay]);

  // --- пошаговый показ ----------------------------------------------------------
  const stepsTotal = scene.ops.length;
  const goStep = useCallback((k) => {
    const n = Math.max(0, Math.min(stepsTotal, k));
    setViewStep(n);
    setPending([]);
    if (n > 0) setFlashStep(n - 1);
  }, [stepsTotal]);
  const exitReplay = useCallback(() => setViewStep(null), []);

  const saveNote = () => {
    if (!editNote) return;
    const text = editNote.text.trim().slice(0, 300);
    setScene((sc) => ({
      ...sc,
      ops: sc.ops.map((o) => {
        if (o.id !== editNote.opId) return o;
        const next = { ...o };
        if (text) next.note = text; else delete next.note;
        return next;
      }),
    }));
    setEditNote(null);
  };

  const hoverKey = useRef('');
  const handleHover = useCallback(({ x, y, frame }) => {
    const over = pickPoint(frame, x, y);
    setHoverMovable(!!(over && draggableOp(sceneRef.current, over)));
    if (tool === 'rotate') {
      if (hoverKey.current) { hoverKey.current = ''; setHover(null); }
      return;
    }
    const target = chooseHit(tool, pending, buildHit(frame, x, y, false));
    const key = target ? `${target.kind}:${target.name || target.id}` : '';
    if (key !== hoverKey.current) {
      hoverKey.current = key;
      setHover(target);
    }
  }, [tool, pending]);

  const highlight = useMemo(() => {
    const points = new Set();
    const lines = new Set();
    const faces = new Set();
    for (const p of [...pending, hover].filter(Boolean)) {
      if (p.kind === 'point') points.add(p.name);
      if (p.kind === 'line') lines.add(p.id);
      if (p.kind === 'face') faces.add(p.id);
    }
    if (dragging) points.add(dragging);
    return { points, lines, faces };
  }, [pending, hover, dragging]);

  // --- клавиатура -----------------------------------------------------------
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !typing) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
        e.preventDefault();
        setLibOpen(true);
        return;
      }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (replay) exitReplay(); else selectTool('rotate');
        return;
      }
      if (replay && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        goStep(viewStep + (e.key === 'ArrowRight' ? 1 : -1));
        return;
      }
      if (e.key === 'Enter') {
        const r = finishPending(tool, pending);
        setPending(r.pending);
        if (r.op) commit(r.op);
        return;
      }
      const t = TOOLS.find((x) => e.code === `Key${x.hot}`);
      if (t) selectTool(t.key);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool, pending, undo, selectTool, commit, replay, exitReplay, goStep, viewStep]);

  // --- строка команд ----------------------------------------------------------
  const runCommand = () => {
    const r = parseCommand(cmd, model);
    if (r.error) { setCmdError(r.error); return; }
    setCmdError('');
    if (r.action === 'undo') { undo(); setCmd(''); return; }
    if (r.action === 'rename') {
      const pt = model.points[r.from];
      if (!pt) { setCmdError(`Нет точки ${prettyName(r.from)}`); return; }
      if (pt.kind === 'vertex') { setCmdError('Вершины тела не переименовываются'); return; }
      if (model.points[r.to]) { setCmdError(`Имя ${prettyName(r.to)} уже занято`); return; }
      setScene((s) => renamePointInScene(s, r.from, r.to));
      setCmd('');
      return;
    }
    const res = commit(r.op, { quiet: true });
    if (!res.ok) {
      setCmdError(res.error);
      if (isTeachingNotice(res.error)) pushNotice(res.error);
      return;
    }
    setCmd('');
  };

  // --- журнал -----------------------------------------------------------------
  const deleteStep = (opId) => {
    const { scene: next, removed } = removeOpCascade(scene, opId);
    if (removed.length <= 1) { setScene(next); setPending([]); return; }
    modal.confirm({
      title: `Удалить ${removed.length} шага?`,
      content: 'Следом за этим шагом уйдут построения, которые на него опираются.',
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: () => { setScene(next); setPending([]); },
    });
  };

  const clearAll = () => {
    if (!scene.ops.length) return;
    modal.confirm({
      title: 'Очистить построения?',
      content: 'Тело останется, все шаги будут удалены.',
      okText: 'Очистить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: () => { setScene((s) => ({ ...s, ops: [] })); setPending([]); },
    });
  };

  // --- тело -------------------------------------------------------------------
  const openBody = () => setBodyOpen(true);
  const applyBody = async () => {
    const values = await bodyForm.validateFields();
    const body = normalizeBodySpec(values);
    const apply = () => {
      setScene({ body, ops: [] });
      setCurrentDoc(null);
      setSavedSig('');
      setCamera(DEFAULT_CAMERA);
      setPending([]);
      setBodyOpen(false);
    };
    if (!scene.ops.length) { apply(); return; }
    modal.confirm({
      title: 'Новый чертёж',
      content: 'Текущие построения будут удалены.',
      okText: 'Начать заново',
      cancelText: 'Отмена',
      onOk: apply,
    });
  };

  const downloadSvg = () => {
    const frame = renderStereo(model, camera, { width: 900, height: 720 });
    const blob = new Blob([stereoSvgString(frame)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stereo.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const hint = toolHint(tool, pending);

  return (
    <div>
      <WorkspacePageHeader
        icon={<CodeSandboxOutlined />}
        accent="violet"
        title="Стереометрия"
        subtitle={currentDoc
          ? `«${currentDoc.title}»${dirty ? ' · есть несохранённые изменения' : ''} · ${bodyTitle(scene.body)}`
          : `${bodyTitle(scene.body)} · построения вживую`}
        extra={(
          <Space wrap>
            <Tooltip title="Сохранённые чертежи и пособия для учеников (Ctrl+S)">
              <Button icon={<BookOutlined />} onClick={() => setLibOpen(true)}>Библиотека</Button>
            </Tooltip>
            <Button icon={<PlusOutlined />} onClick={openBody}>Новый чертёж</Button>
            <Tooltip title="Блок ```stereo для задачи или теории — и обратно">
              <Button icon={<FileTextOutlined />} onClick={() => setTextOpen(true)}>Текст</Button>
            </Tooltip>
            <Tooltip title="Картинка для печати или для доски">
              <Button icon={<DownloadOutlined />} onClick={downloadSvg}>SVG</Button>
            </Tooltip>
          </Space>
        )}
      />

      <div className="stereo-editor">
        <div className="stereo-editor__stage" style={{ height: 'clamp(420px, 72vh, 820px)' }}>
          <div className="stereo-editor__hint">
            <span className="stereo-editor__badge">
              {replay ? `Показ по шагам: ${viewStep} из ${stepsTotal} · ← → листать · Esc — выйти` : hint}
            </span>
            {pending.length > 0 && (
              <Button size="small" onClick={() => setPending([])}>Сбросить выбор (Esc)</Button>
            )}
          </div>
          <StereoCanvas
            model={shownModel}
            camera={camera}
            onCameraChange={setCamera}
            onClick={handleClick}
            onHover={handleHover}
            onDoubleClick={tool === 'rotate' ? () => setCamera(DEFAULT_CAMERA) : undefined}
            highlight={highlight}
            flashStep={flashStep}
            pulse={pulse}
            cursor={dragging ? 'grabbing' : hoverMovable ? 'move' : tool === 'rotate' ? 'grab' : 'crosshair'}
            getDragTarget={getDragTarget}
            onDrag={handleDrag}
          />
          <div className="stereo-editor__camera">
            {CAMERA_PRESETS.map((p) => (
              <Button key={p.key} size="small" onClick={() => setCamera(p.cam)}>{p.label}</Button>
            ))}
          </div>
          {notice && (
            <div className="stereo-editor__notice">
              <Alert
                type={notice.type === 'error' ? 'warning' : 'info'}
                showIcon
                message={notice.text}
                closable
                onClose={() => setNotice(null)}
              />
            </div>
          )}
        </div>

        <div className="stereo-editor__panel">
          <StereoLivePanel live={live} camera={camera} />
          <div className="stereo-tools" role="toolbar" aria-label="Инструменты построения">
            {TOOLS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`stereo-tool${tool === t.key ? ' is-active' : ''}`}
                onClick={() => selectTool(t.key)}
                title={`${t.label} (${t.hot})`}
              >
                <span className="stereo-tool__glyph">{t.glyph}</span>
                <span>{t.label}</span>
                <span className="stereo-tool__key">{t.hot}</span>
              </button>
            ))}
          </div>

          <div>
            <Input
              value={cmd}
              onChange={(e) => { setCmd(e.target.value); if (cmdError) setCmdError(''); }}
              onPressEnter={runCommand}
              placeholder="Команда: M на AA1 1:2 · MN · X = MN ∩ AC"
              allowClear
              status={cmdError ? 'error' : undefined}
              aria-label="Строка команд"
            />
            {cmdError
              ? <div className="stereo-cmd-error">{cmdError}</div>
              : (
                <div className="stereo-cmd-help">
                  <code>прямая K || AB</code> · <code>след MN ABCD</code> · <code>сечение MND</code> ·
                  {' '}<code>грань AA1C1C</code> · <code>переименовать M K</code>
                </div>
              )}
          </div>

          <div>
            <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 6 }}>
              <strong>Шаги построения</strong>
              <Space size={4}>
                <Tooltip title="Отменить последний шаг (Ctrl+Z)">
                  <Button size="small" icon={<UndoOutlined />} onClick={undo} disabled={!scene.ops.length} />
                </Tooltip>
                <Tooltip title="Очистить построения">
                  <Button size="small" icon={<DeleteOutlined />} onClick={clearAll} disabled={!scene.ops.length} />
                </Tooltip>
              </Space>
            </Space>
            {stepsTotal > 0 && (
              <div className="stereo-replay">
                {replay ? (
                  <>
                    <Button size="small" icon={<LeftOutlined />} onClick={() => goStep(viewStep - 1)} disabled={viewStep <= 0} aria-label="Предыдущий шаг" />
                    <span className="stereo-replay__pos">Шаг {viewStep} из {stepsTotal}</span>
                    <Button size="small" icon={<RightOutlined />} onClick={() => goStep(viewStep + 1)} disabled={viewStep >= stepsTotal} aria-label="Следующий шаг" />
                    <Button size="small" onClick={exitReplay}>Всё построение</Button>
                  </>
                ) : (
                  <Button size="small" icon={<PlayCircleOutlined />} onClick={() => goStep(0)} block>
                    Показать по шагам{live.isLive ? ' (ученики увидят то же)' : ''}
                  </Button>
                )}
              </div>
            )}
            {model.steps.length === 0 ? (
              <div className="stereo-cmd-help">
                Пока пусто. Выберите инструмент справа или напишите команду —
                новые точки и прямые появятся на чертеже.
              </div>
            ) : (
              <ol className="stereo-steps">
                {model.steps.map((st) => (
                  <li
                    key={st.op.id || st.index}
                    className={[
                      'stereo-step',
                      flashStep === st.index ? 'is-flash' : '',
                      replay && st.index >= viewStep ? 'is-future' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => (replay ? goStep(st.index + 1) : setFlashStep(st.index))}
                  >
                    <span className="stereo-step__no">{st.index + 1}</span>
                    <span className="stereo-step__text">
                      {describeOp(st.op, model.opsById)}
                      {!st.ok && <div className="stereo-cmd-error">{st.error}</div>}
                      {editNote && editNote.opId === st.op.id ? (
                        <Input
                          size="small"
                          autoFocus
                          value={editNote.text}
                          maxLength={300}
                          placeholder="Подпись к шагу — её увидят ученики"
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditNote({ ...editNote, text: e.target.value })}
                          onPressEnter={(e) => e.target.blur()}
                          onBlur={saveNote}
                          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditNote(null); } }}
                        />
                      ) : st.op.note && <div className="stereo-step__note">{st.op.note}</div>}
                    </span>
                    <Tooltip title="Подпись к шагу">
                      <Button
                        className="stereo-step__del"
                        size="small"
                        type="text"
                        icon={<EditOutlined />}
                        onClick={(e) => { e.stopPropagation(); setEditNote({ opId: st.op.id, text: st.op.note || '' }); }}
                        aria-label="Подпись к шагу"
                      />
                    </Tooltip>
                    <Button
                      className="stereo-step__del"
                      size="small"
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={(e) => { e.stopPropagation(); deleteStep(st.op.id); }}
                      aria-label="Удалить шаг"
                    />
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>

      <StereoLibrary
        open={libOpen}
        onClose={() => setLibOpen(false)}
        scene={scene}
        camera={camera}
        currentDoc={currentDoc}
        dirty={dirty}
        canEdit={!!auth?.canEdit}
        onSaved={onSaved}
        onOpen={(rec) => {
          const sc = rec.scene?.body && Array.isArray(rec.scene.ops)
            ? { body: rec.scene.body, ops: rec.scene.ops.map((o) => (o.id ? o : { ...o, id: newOpId() })) }
            : { body: DEFAULT_BODY, ops: [] };
          setScene(sc);
          setCamera(rec.camera ? { ...DEFAULT_CAMERA, ...rec.camera } : DEFAULT_CAMERA);
          setCurrentDoc({ id: rec.id, title: rec.title });
          setSavedSig(JSON.stringify(sc));
          setPending([]);
          setViewStep(null);
        }}
      />

      <StereoTextModal
        open={textOpen}
        onClose={() => setTextOpen(false)}
        scene={scene}
        camera={camera}
        onLoad={(sc, cam) => {
          setScene(sc);
          setCamera(cam);
          setPending([]);
          setViewStep(null);
        }}
      />

      <Modal
        title="Новый чертёж"
        open={bodyOpen}
        onOk={applyBody}
        onCancel={() => setBodyOpen(false)}
        okText="Создать"
        cancelText="Отмена"
        destroyOnHidden
      >
        <Form form={bodyForm} layout="vertical" initialValues={normalizeBodySpec(scene.body)}>
          <Form.Item name="kind" label="Тело">
            <Select options={Object.entries(BODY_KINDS).map(([value, v]) => ({ value, label: v.label }))} />
          </Form.Item>
          {(bodyKind === 'prism' || bodyKind === 'pyramid') && (
            <Form.Item name="n" label="В основании">
              <Select options={[
                { value: 3, label: 'треугольник' },
                { value: 4, label: 'квадрат' },
                { value: 6, label: 'шестиугольник' },
              ]}
              />
            </Form.Item>
          )}
          <Space wrap>
            <Form.Item name="a" label={bodyKind === 'cube' ? 'Ребро' : bodyKind === 'box' ? 'Длина AB' : 'Ребро основания'}>
              <InputNumber min={0.5} max={50} step={0.5} />
            </Form.Item>
            {bodyKind === 'box' && (
              <>
                <Form.Item name="b" label="Ширина AD"><InputNumber min={0.5} max={50} step={0.5} /></Form.Item>
                <Form.Item name="c" label="Высота AA₁"><InputNumber min={0.5} max={50} step={0.5} /></Form.Item>
              </>
            )}
            {(bodyKind === 'prism' || bodyKind === 'pyramid') && (
              <Form.Item name="h" label="Высота"><InputNumber min={0.5} max={50} step={0.5} /></Form.Item>
            )}
            {(bodyKind === 'pyramid' || bodyKind === 'tetra') && (
              <Form.Item name="apex" label="Вершина">
                <Select style={{ width: 90 }} options={['S', 'D', 'M', 'P'].map((v) => ({ value: v, label: v }))} />
              </Form.Item>
            )}
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
