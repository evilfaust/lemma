import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, App, Button, Checkbox, Input, Segmented, Space, Tooltip,
} from 'antd';
import {
  DeleteOutlined, DownloadOutlined, PlusOutlined, UndoOutlined, EditOutlined, LeftOutlined,
  RightOutlined, PlayCircleOutlined, FileTextOutlined, QuestionOutlined, ExpandOutlined,
  BorderInnerOutlined, RadiusSettingOutlined, BookOutlined, CodeOutlined,
} from '@ant-design/icons';
import { WorkspacePageHeader } from '../workspace/ui';
import PlanimCanvas from './PlanimCanvas';
import PlanimTextModal from './PlanimTextModal';
import PlanimHelpModal from './PlanimHelpModal';
import PlanimPointModal from './PlanimPointModal';
import PlanimFigureModal from './PlanimFigureModal';
import PlanimMarkTextModal from './PlanimMarkTextModal';
import StereoLibrary from '../stereo/StereoLibrary';
import { useOptionalAuth } from '../../contexts/AuthContext';
import {
  evaluateScene, tryAppendOps, removeOpCascade, applyAction,
  parseCommand, describeOp, opToCommand, editStepCommand, stepOfTarget, freeOrigin, figureOps, figureVertexCount, nextFreeNames,
  TOOLS, toolHint, toolClick, finishPending, chooseHit,
  pickPoint, pickLines, pickCircle, pickPoly, pickLabel, pickMarkText, gridStep,
  setMarkTextPosition, setMarkText, markTextOf,
  draggableOp, dragTarget, dragPosition, setOpPosition, labelAngleAt, snapPosition, snapWorld,
  setPointColors, setSegStyles, setOpStyle, setLabelAngle, newOpId,
  POINT_COLORS, planimFrame, planimSvgString,
} from '../../utils/planim';
import '../stereo/stereo.css';
import './planim.css';

const DRAFT_KEY = 'planim.editor.v1';
const EMPTY = { ops: [] };

function withIds(scene) {
  const ops = (scene?.ops || []).filter((o) => o && typeof o === 'object').map((o) => (o.id ? o : { ...o, id: newOpId() }));
  return { ...scene, ops };
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!Array.isArray(d?.scene?.ops)) return null;
    const scene = withIds(d.scene);
    evaluateScene(scene); // битый черновик не должен ронять страницу
    return { ...d, scene };
  } catch {
    return null;
  }
}

/** Что под курсором: точка, линии, окружность, заливка и место на плоскости. */
function buildHit(frame, x, y, { shift = false, alt = false } = {}) {
  const point = pickPoint(frame, x, y);
  const hits = pickLines(frame, x, y);
  const toLine = (h) => {
    const t = ((h.pos.x - h.line.p.x) * h.line.u.x + (h.pos.y - h.line.p.y) * h.line.u.y)
      / (h.line.u.x * h.line.u.x + h.line.u.y * h.line.u.y);
    const px = Math.hypot(h.line.u.x, h.line.u.y) * frame.scale;
    return { id: h.line.id, ref: h.line.ref, ...snapPosition(t, px), pos: h.pos, p: h.line.p, u: h.line.u };
  };
  const line = hits[0] ? toLine(hits[0]) : null;
  // Вторая линия в перекрестье — не лежащая на той же прямой.
  const second = hits[0] && hits.slice(1).find((h) => {
    const a = hits[0].line.u;
    const b = h.line.u;
    return Math.abs(a.x * b.y - a.y * b.x) > 1e-9 * Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  });
  const c = pickCircle(frame, x, y);
  const poly = pickPoly(frame, x, y);
  const raw = frame.toWorld(x, y);
  return {
    point,
    line,
    line2: second ? toLine(second) : null,
    circle: c ? { id: c.circle.id, ref: c.circle.ref, angle: c.angle } : null,
    poly: poly ? { id: poly.id } : null,
    pos: snapWorld(raw, alt ? 0 : gridStep(frame.scale) / 2),
    raw,
    shift,
  };
}

/**
 * Редактор планиметрических чертежей. План — PLANIM_PLAN.md.
 * Учитель строит кликами или строкой команд; журнал шагов справа.
 *
 * @param embedded     — редактор внутри окна (задача, теория, геометрия): без
 *                       черновика страницы, с кнопкой «применить»
 * @param initialScene — сцена для правки (открытый блок ```planim)
 * @param onApply      — (scene, { color, grid }) → вставить/обновить чертёж
 */
export default function PlanimEditor({
  embedded = false, initialScene = null, initialColor = false, initialGrid = false,
  onApply, applyLabel = 'Вставить',
} = {}) {
  const { modal } = App.useApp();
  const draft = useMemo(() => {
    if (!embedded) return loadDraft();
    return initialScene ? { scene: withIds(initialScene) } : null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [applyColor, setApplyColor] = useState(initialColor);
  const [applyGrid, setApplyGrid] = useState(initialGrid);
  const [scene, setSceneRaw] = useState(() => draft?.scene || EMPTY);
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

  const [view, setView] = useState(null); // null — вписать (холст вернёт посчитанный вид)
  const [showGrid, setShowGrid] = useState(() => draft?.showGrid !== false);
  const [tool, setTool] = useState('move');
  const [pending, setPending] = useState([]);
  const [hover, setHover] = useState(null);
  const [hoverMovable, setHoverMovable] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [notice, setNotice] = useState(null);
  const [flashStep, setFlashStep] = useState(null);
  const [cmd, setCmd] = useState('');
  const cmdRef = useRef(null);
  const [cmdError, setCmdError] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [figureOpen, setFigureOpen] = useState(false);
  const [pointTarget, setPointTarget] = useState(null);
  // Подпись: { create: true, at } — новая надпись, { opId } — правка готовой
  const [markTarget, setMarkTarget] = useState(null);
  const [paintColor, setPaintColor] = useState('red');
  const [toolOpts, setToolOpts] = useState({ arcs: 1, angleLabel: '', ticks: 1, measureText: '' });
  const [libOpen, setLibOpen] = useState(false);
  const auth = useOptionalAuth();
  // Открытый из библиотеки чертёж и «подпись» сохранённого состояния — по ней
  // видно, есть ли несохранённые изменения.
  const [currentDoc, setCurrentDoc] = useState(() => draft?.doc || null);
  const [savedSig, setSavedSig] = useState(() => draft?.savedSig || '');

  const model = useMemo(() => evaluateScene(scene), [scene]);
  // Пошаговый показ: null — всё построение, число — сколько шагов видно.
  const [viewStep, setViewStep] = useState(null);
  const replay = viewStep != null;
  const shownModel = useMemo(
    () => (replay ? evaluateScene(scene, { upTo: viewStep }) : model),
    [replay, scene, viewStep, model],
  );
  const [editNote, setEditNote] = useState(null); // { opId, text }
  // Правка шага командой: { opId, text, error }. Шаг заменяется на месте.
  const [editCmd, setEditCmd] = useState(null);
  const stepsRef = useRef(null);

  // Черновик переживает перезагрузку страницы.
  useEffect(() => {
    if (embedded) return undefined;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ scene, showGrid, doc: currentDoc, savedSig }));
      } catch { /* приватный режим */ }
    }, 300);
    return () => clearTimeout(t);
  }, [scene, showGrid, currentDoc, savedSig, embedded]);

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
  const showNotice = useCallback((type, text) => {
    clearTimeout(noticeTimer.current);
    setNotice({ type, text });
    noticeTimer.current = setTimeout(() => setNotice(null), type === 'error' ? 8000 : 5000);
  }, []);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  /** Добавить операции в журнал; ошибка — объяснение вместо шага. */
  const commit = useCallback((ops, { quiet = false } = {}) => {
    const r = tryAppendOps(sceneRef.current, ops);
    if (!r.ok) {
      if (!quiet) showNotice('error', r.error);
      return r;
    }
    setScene(r.scene);
    setFlashStep(r.scene.ops.length - 1);
    if (r.note) showNotice('info', r.note);
    return r;
  }, [setScene, showNotice]);

  const undo = useCallback(() => {
    setPending([]);
    setEditCmd(null);
    const prev = historyRef.current.pop();
    if (prev) { sceneRef.current = prev; setSceneRaw(prev); return; }
    // Черновик после перезагрузки истории не имеет — снимаем последний шаг.
    setSceneRaw((s) => (s.ops.length ? { ...s, ops: s.ops.slice(0, -1) } : s));
  }, []);

  // --- перемещение точек и букв -------------------------------------------------
  const getDragTarget = useCallback((pt, frame) => {
    if (replay) return null;
    const name = pickPoint(frame, pt.x, pt.y);
    if (name) {
      const op = draggableOp(sceneRef.current, name);
      return op ? dragTarget(model, op) : null;
    }
    // Подпись пометки тянется в любом инструменте: короткий клик по ней
    // остаётся кликом инструмента, сдвиг — перетаскивание.
    const mark = pickMarkText(frame, pt.x, pt.y);
    if (mark) {
      return {
        kind: 'mark', name: null, opId: mark.opId,
        grab: { dx: pt.x - mark.x, dy: pt.y - (mark.y - 5) },
      };
    }
    if (tool !== 'move') return null;
    const label = pickLabel(frame, pt.x, pt.y);
    return label ? { kind: 'label', name: label.name, label } : null;
  }, [model, replay, tool]);

  const droppedRef = useRef(false);
  const handleDrag = useCallback(({ phase, x, y, frame, target, altKey }) => {
    if (phase === 'start') {
      pushHistory(sceneRef.current);
      setPending([]);
      setDragging(target.name || '#mark'); // у подписи имени нет — курсор всё равно «тащу»
      return;
    }
    if (phase === 'end') {
      droppedRef.current = true;
      setDragging(null);
      return;
    }
    let next;
    if (target.kind === 'mark') {
      // Центр подписи — там, где его держит курсор (с поправкой на место захвата).
      next = setMarkTextPosition(sceneRef.current, target.opId, frame.toWorld(x - target.grab.dx, y - target.grab.dy));
    } else if (target.kind === 'label') {
      next = setLabelAngle(sceneRef.current, target.name, labelAngleAt(target.label, x, y));
    } else {
      const pos = dragPosition(target, frame, x, y, { step: altKey ? 0 : gridStep(frame.scale) / 2 });
      if (!pos) return;
      next = setOpPosition(sceneRef.current, target.opId, pos);
    }
    sceneRef.current = next;
    setSceneRaw(next);
  }, [pushHistory]);

  // После сдвига точки часть построений могла перестать строиться
  // (прямые стали параллельны) — говорим об этом сразу.
  useEffect(() => {
    if (dragging || !droppedRef.current) return;
    droppedRef.current = false;
    const broken = model.steps.filter((st) => !st.ok);
    if (broken.length) showNotice('error', `Шаг ${broken[0].index + 1} теперь не строится: ${broken[0].error}`);
  }, [dragging, model, showNotice]);

  const selectTool = useCallback((key) => {
    setTool(key);
    setPending([]);
    setHover(null);
  }, []);

  // --- правка шага командой ---------------------------------------------------
  // Клик «Правкой» / двойной клик по объекту / кнопка в журнале → команда шага
  // открывается в журнале на месте; Enter заменяет шаг, дальнейшие пересчитываются.
  const startStepEdit = useCallback((opId) => {
    const sc = sceneRef.current;
    const idx = sc.ops.findIndex((o) => o.id === opId);
    const text = idx >= 0 ? opToCommand(sc.ops[idx]) : '';
    if (!text) { showNotice('error', 'Этот шаг командой не выражается — его можно только удалить'); return; }
    setEditNote(null);
    setPending([]);
    setEditCmd({ opId, text, error: '' });
    setFlashStep(idx);
    setTimeout(() => {
      stepsRef.current?.querySelector(`[data-op-id="${opId}"]`)?.scrollIntoView?.({ block: 'nearest' });
    }, 0);
  }, [showNotice]);

  const applyStepEdit = () => {
    if (!editCmd) return;
    const res = editStepCommand(sceneRef.current, editCmd.opId, editCmd.text);
    if (res.error) { setEditCmd({ ...editCmd, error: res.error }); return; }
    setScene(res.scene);
    setEditCmd(null);
    setPending([]);
    const idx = res.scene.ops.findIndex((o) => o.id === editCmd.opId);
    if (idx >= 0) setFlashStep(idx);
    if (res.broken.length) {
      showNotice('error', `После правки не строятся шаги ${res.broken.join(', ')} — поправьте их или верните как было (Ctrl+Z)`);
    }
  };

  // --- клики по чертежу -----------------------------------------------------
  const handleClick = useCallback(({ x, y, frame, shiftKey, altKey }) => {
    if (tool === 'move' || replay) return;
    if (tool === 'text' || tool === 'edit') {
      const mark = pickMarkText(frame, x, y);
      if (mark && tool === 'text') { setMarkTarget({ opId: mark.opId }); return; }
      if (mark) { startStepEdit(mark.opId); return; }
    }
    const hit = buildHit(frame, x, y, { shift: shiftKey, alt: altKey });
    const r = toolClick(tool, pending, hit, model, toolOpts);
    if (r.edit) { startStepEdit(r.edit.opId); return; }
    if (r.textAt) { setMarkTarget({ create: true, at: r.textAt }); return; }
    if (r.error) showNotice('error', r.error);
    let ok = true;
    if (r.ops?.length) ok = commit(r.ops).ok;
    setPending(ok ? r.pending : []);
    if (r.rename) setPointTarget(r.rename.name);
    const sc = sceneRef.current;
    if (r.paint) {
      // Повторный клик тем же цветом снимает выделение.
      if (r.paint.name) {
        setScene(setPointColors(sc, [r.paint.name], sc.colors?.[r.paint.name] === paintColor ? '' : paintColor));
      } else if (r.paint.segment) {
        const cur = sc.segStyles?.[r.paint.segment]?.color;
        setScene(setSegStyles(sc, [r.paint.segment], { color: cur === paintColor ? '' : paintColor }));
      } else {
        const id = r.paint.circle || r.paint.poly;
        const cur = sc.ops.find((o) => o.id === id)?.color;
        setScene(setOpStyle(sc, [id], { color: cur === paintColor ? '' : paintColor }));
      }
    }
    if (r.dash) {
      if (r.dash.segment) {
        setScene(setSegStyles(sc, [r.dash.segment], { dash: !sc.segStyles?.[r.dash.segment]?.dash }));
      } else if (r.dash.circle) {
        setScene(setOpStyle(sc, [r.dash.circle], { dash: !sc.ops.find((o) => o.id === r.dash.circle)?.dash }));
      }
    }
  }, [tool, pending, model, toolOpts, commit, showNotice, replay, paintColor, setScene, startStepEdit]);

  const hoverKey = useRef('');
  const handleHover = useCallback(({ x, y, frame }) => {
    const over = pickPoint(frame, x, y);
    setHoverMovable(!!(over && draggableOp(sceneRef.current, over))
      || (!over && !!pickMarkText(frame, x, y))
      || (tool === 'move' && !over && !!pickLabel(frame, x, y)));
    if (tool === 'move') {
      if (hoverKey.current) { hoverKey.current = ''; setHover(null); }
      return;
    }
    const target = chooseHit(tool, pending, buildHit(frame, x, y));
    const key = target && target.kind !== 'empty' ? `${target.kind}:${target.name || target.id}` : '';
    if (key !== hoverKey.current) {
      hoverKey.current = key;
      setHover(key ? target : null);
    }
  }, [tool, pending]);

  const highlight = useMemo(() => {
    const points = new Set();
    const lines = new Set();
    const circles = new Set();
    const polys = new Set();
    for (const p of [...pending, hover].filter(Boolean)) {
      if (p.kind === 'point') points.add(p.name);
      if (p.kind === 'line') lines.add(p.id);
      if (p.kind === 'circle') circles.add(p.id);
      if (p.kind === 'poly') polys.add(p.id);
    }
    if (dragging) points.add(dragging);
    return { points, lines, circles, polys };
  }, [pending, hover, dragging]);

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
        if (replay) exitReplay();
        else if (pending.length) setPending([]);
        else selectTool('move');
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen(true);
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
        if (r.ops) commit(r.ops);
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
    if (r.action) {
      const res = applyAction(scene, r);
      if (res.error) { setCmdError(res.error); return; }
      setScene(res.scene);
      setCmd('');
      return;
    }
    const res = commit(r.ops || [r.op], { quiet: true });
    if (!res.ok) { setCmdError(res.error); return; }
    setCmd('');
  };

  // --- подписи на чертеже ------------------------------------------------------
  const markOp = markTarget?.opId ? scene.ops.find((o) => o.id === markTarget.opId) : null;
  const markModal = useMemo(() => {
    if (!markTarget) return null;
    if (markTarget.create) return { kind: 'text', text: '', create: true };
    if (!markOp) return null;
    return {
      kind: markOp.type,
      text: markTextOf(markOp),
      moved: markOp.type !== 'text' && !!markOp.at,
    };
  }, [markTarget, markOp]);

  const applyMarkText = (text) => {
    const value = String(text || '').trim();
    const target = markTarget;
    setMarkTarget(null);
    if (!target) return;
    if (target.create) {
      if (value) commit([{ id: newOpId(), type: 'text', x: target.at.x, y: target.at.y, text: value }]);
      return;
    }
    const op = sceneRef.current.ops.find((o) => o.id === target.opId);
    if (!op) return;
    if (!value && op.type !== 'angle') { deleteStep(op.id); return; }
    setScene(setMarkText(sceneRef.current, op.id, value));
  };

  // --- журнал -----------------------------------------------------------------
  const deleteStep = (opId) => {
    const { scene: next, removed } = removeOpCascade(scene, opId);
    if (removed.length <= 1) { setScene(next); setPending([]); return; }
    modal.confirm({
      title: `Удалить шагов: ${removed.length}?`,
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
      title: 'Очистить чертёж?',
      content: 'Все шаги будут удалены (вернуть — Ctrl+Z).',
      okText: 'Очистить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: () => { setScene(EMPTY); setPending([]); setViewStep(null); },
    });
  };

  // --- новый чертёж / фигура ------------------------------------------------------
  const applyFigure = ({ spec, add }) => {
    const base = add ? model : evaluateScene(EMPTY);
    const names = nextFreeNames(base, figureVertexCount(spec) || 0, 'free');
    const r = figureOps(spec, names, add ? freeOrigin(model) : { x: 0, y: 0 });
    if (r.error) { showNotice('error', r.error); return; }
    const done = () => {
      setPending([]);
      setViewStep(null);
      setView(null);
      setFigureOpen(false);
    };
    if (add) { commit(r.ops); done(); return; }
    const start = () => {
      setScene({ ops: r.ops });
      setCurrentDoc(null);
      setSavedSig('');
      done();
    };
    if (!scene.ops.length) { start(); return; }
    modal.confirm({
      title: 'Новый чертёж',
      content: 'Текущие построения будут удалены (вернуть — Ctrl+Z).',
      okText: 'Начать заново',
      cancelText: 'Отмена',
      onOk: start,
    });
  };

  const downloadSvg = () => {
    const frame = planimFrame(scene, { size: { width: 900, height: 720 }, grid: applyGrid });
    const blob = new Blob([planimSvgString(frame, { crop: true })], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'planim.svg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const hint = toolHint(tool, pending);
  const patchOpts = (patch) => setToolOpts((o) => ({ ...o, ...patch }));
  const hasStyles = !!(scene.colors || scene.segStyles || scene.ops.some((o) => o.color));

  return (
    <div className={embedded ? 'stereo-embedded' : undefined}>
      {embedded ? (
        <div className="stereo-embedded__bar">
          <Space wrap size={6}>
            <Button icon={<PlusOutlined />} onClick={() => setFigureOpen(true)}>Фигура</Button>
            <Tooltip title="Взять чертёж из библиотеки (или сохранить туда)">
              <Button icon={<BookOutlined />} onClick={() => setLibOpen(true)}>Библиотека</Button>
            </Tooltip>
            <Tooltip title="Чертёж текстом — и обратно">
              <Button icon={<FileTextOutlined />} onClick={() => setTextOpen(true)}>Текст</Button>
            </Tooltip>
          </Space>
          <Space wrap size={10}>
            <Checkbox checked={applyGrid} onChange={(e) => setApplyGrid(e.target.checked)}>
              Клетчатый фон
            </Checkbox>
            <Checkbox checked={applyColor} onChange={(e) => setApplyColor(e.target.checked)}>
              Цветной (иначе ч/б — для печати)
            </Checkbox>
            <Button
              type="primary"
              disabled={!scene.ops.length}
              onClick={() => onApply?.(scene, { color: applyColor, grid: applyGrid })}
            >
              {applyLabel}
            </Button>
          </Space>
        </div>
      ) : (
        <WorkspacePageHeader
          icon={<RadiusSettingOutlined />}
          accent="teal"
          title="Планиметрия"
          subtitle={currentDoc
            ? `«${currentDoc.title}»${dirty ? ' · есть несохранённые изменения' : ''}`
            : 'Чертежи для задач и теории: треугольники, окружности, высоты, углы'}
          extra={(
            <Space wrap>
              <Tooltip title="Сохранённые чертежи и пособия для учеников (Ctrl+S)">
                <Button icon={<BookOutlined />} onClick={() => setLibOpen(true)}>Библиотека</Button>
              </Tooltip>
              <Button icon={<PlusOutlined />} onClick={() => setFigureOpen(true)}>Новый чертёж</Button>
              <Tooltip title="Блок ```planim для задачи или теории — и обратно">
                <Button icon={<FileTextOutlined />} onClick={() => setTextOpen(true)}>Текст</Button>
              </Tooltip>
              <Tooltip title="Картинка для печати или для доски">
                <Button icon={<DownloadOutlined />} onClick={downloadSvg}>SVG</Button>
              </Tooltip>
            </Space>
          )}
        />
      )}

      <div className="stereo-editor planim-editor">
        <div
          className="stereo-editor__stage"
          style={{ height: embedded ? 'clamp(380px, 62vh, 720px)' : 'clamp(420px, 72vh, 820px)' }}
        >
          <div className="stereo-editor__hint">
            <span className="stereo-editor__badge">
              {replay ? `Показ по шагам: ${viewStep} из ${stepsTotal} · ← → листать · Esc — выйти` : hint}
            </span>
            {pending.length > 0 && (
              <Button size="small" onClick={() => setPending([])}>Сбросить выбор (Esc)</Button>
            )}
          </div>
          <PlanimCanvas
            model={shownModel}
            view={view}
            onViewChange={setView}
            onClick={handleClick}
            onHover={handleHover}
            onDoubleClick={({ x, y, frame }) => {
              // Двойной клик по точке — её свойства, по подписи — её текст;
              // по пустому месту — вписать.
              // По линии, окружности, заливке — правка шага, который её построил.
              if (replay) return;
              const name = pickPoint(frame, x, y);
              const mark = name ? null : pickMarkText(frame, x, y);
              if (name) { setPointTarget(name); return; }
              if (mark) { setMarkTarget({ opId: mark.opId }); return; }
              const hit = buildHit(frame, x, y);
              const target = chooseHit('edit', [], hit);
              const opId = target ? stepOfTarget(model, target) : null;
              if (opId) startStepEdit(opId);
              else if (tool === 'move') setView(null);
            }}
            highlight={highlight}
            flashStep={flashStep}
            showGrid={showGrid}
            cursor={dragging ? 'grabbing' : hoverMovable ? 'move' : tool === 'move' ? 'grab' : 'crosshair'}
            getDragTarget={getDragTarget}
            onDrag={handleDrag}
          />
          <div className="stereo-editor__camera">
            <Tooltip title="Вписать чертёж в окно (или двойной клик по пустому месту)">
              <Button size="small" icon={<ExpandOutlined />} onClick={() => setView(null)}>Вписать</Button>
            </Tooltip>
            <Tooltip title="Сетка редактора: к ней прилипают свободные точки (с Alt — свободно). В чертёж задачи не попадает">
              <Button
                size="small"
                icon={<BorderInnerOutlined />}
                type={showGrid ? 'primary' : 'default'}
                ghost={showGrid}
                onClick={() => setShowGrid((v) => !v)}
              >
                Сетка
              </Button>
            </Tooltip>
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
          <div className="planim-tools" role="toolbar" aria-label="Инструменты построения">
            {TOOLS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`stereo-tool${tool === t.key ? ' is-active' : ''}`}
                onClick={() => selectTool(t.key)}
                title={`${t.label} (${t.hot}) — ${t.group.toLowerCase()}`}
              >
                <span className="stereo-tool__glyph">{t.glyph}</span>
                <span>{t.label}</span>
                <span className="stereo-tool__key">{t.hot}</span>
              </button>
            ))}
          </div>

          {tool === 'angle' && (
            <div className="planim-toolopts">
              <span>Дуг:</span>
              <Segmented size="small" value={toolOpts.arcs} onChange={(arcs) => patchOpts({ arcs })} options={[1, 2, 3]} />
              <Input
                size="small"
                value={toolOpts.angleLabel}
                onChange={(e) => patchOpts({ angleLabel: e.target.value })}
                placeholder="подпись: 30, α, ?"
                aria-label="Подпись угла"
                allowClear
              />
            </div>
          )}
          {tool === 'tick' && (
            <div className="planim-toolopts">
              <span>Штрихов:</span>
              <Segmented size="small" value={toolOpts.ticks} onChange={(ticks) => patchOpts({ ticks })} options={[1, 2, 3]} />
            </div>
          )}
          {tool === 'measure' && (
            <div className="planim-toolopts">
              <Input
                size="small"
                value={toolOpts.measureText}
                onChange={(e) => patchOpts({ measureText: e.target.value })}
                placeholder="подпись: 5, x, sqrt(3) — пусто: длина отрезка"
                aria-label="Подпись отрезка"
                allowClear
              />
            </div>
          )}
          {tool === 'color' && (
            <div className="stereo-palette" role="radiogroup" aria-label="Цвет">
              {POINT_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={paintColor === c.key}
                  aria-label={c.label}
                  title={c.label}
                  className={`stereo-palette__swatch${paintColor === c.key ? ' is-active' : ''}`}
                  style={{ background: c.hex }}
                  onClick={() => setPaintColor(c.key)}
                />
              ))}
              <Button
                size="small"
                type="text"
                disabled={!hasStyles}
                onClick={() => setScene((sc) => {
                  let next = setPointColors(sc, Object.keys(sc.colors || {}), '');
                  next = setSegStyles(next, Object.keys(next.segStyles || {}), { color: '' });
                  return setOpStyle(next, next.ops.filter((o) => o.color).map((o) => o.id), { color: '' });
                })}
              >
                Снять все
              </Button>
            </div>
          )}

          <div>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                ref={cmdRef}
                value={cmd}
                onChange={(e) => { setCmd(e.target.value); if (cmdError) setCmdError(''); }}
                onPressEnter={runCommand}
                placeholder="Команда: треугольник ABC 5 6 7 · H = высота B AC"
                allowClear
                status={cmdError ? 'error' : undefined}
                aria-label="Строка команд"
              />
              <Tooltip title="Справка: инструменты, команды, клавиши (?)">
                <Button icon={<QuestionOutlined />} onClick={() => setHelpOpen(true)} aria-label="Справка по командам" />
              </Tooltip>
            </Space.Compact>
            {cmdError
              ? <div className="stereo-cmd-error">{cmdError}</div>
              : (
                <div className="stereo-cmd-help">
                  <code>M = медиана B AC</code> · <code>X = AC ∩ BD</code> · <code>O = описанная ABC</code> ·
                  {' '}<code>угол ABC 30</code> · <code>равны AB BC</code> · <code>пунктир BH</code>
                </div>
              )}
          </div>

          <div>
            <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 6 }}>
              <strong>Шаги построения</strong>
              <Space size={4}>
                <Tooltip title="Отменить (Ctrl+Z)">
                  <Button size="small" icon={<UndoOutlined />} onClick={undo} disabled={!scene.ops.length && !historyRef.current.length} aria-label="Отменить" />
                </Tooltip>
                <Tooltip title="Очистить чертёж">
                  <Button size="small" icon={<DeleteOutlined />} onClick={clearAll} disabled={!scene.ops.length} aria-label="Очистить чертёж" />
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
                    Показать по шагам
                  </Button>
                )}
              </div>
            )}
            {model.steps.length === 0 ? (
              <div className="stereo-cmd-help">
                Пока пусто. Начните с готовой фигуры («{embedded ? 'Фигура' : 'Новый чертёж'}») или
                выберите инструмент и кликайте по листу — точки появятся сами.
              </div>
            ) : (
              <ol className="stereo-steps" ref={stepsRef}>
                {model.steps.map((st) => (
                  <li
                    key={st.op.id || st.index}
                    data-op-id={st.op.id}
                    className={[
                      'stereo-step',
                      flashStep === st.index ? 'is-flash' : '',
                      replay && st.index >= viewStep ? 'is-future' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => (replay ? goStep(st.index + 1) : setFlashStep(st.index))}
                  >
                    <span className="stereo-step__no">{st.index + 1}</span>
                    <span
                      className="stereo-step__text"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (!replay) startStepEdit(st.op.id);
                      }}
                    >
                      {editCmd && editCmd.opId === st.op.id ? (
                        <>
                          <Input
                            size="small"
                            autoFocus
                            className="stereo-step__cmd"
                            aria-label="Команда шага"
                            value={editCmd.text}
                            status={editCmd.error ? 'error' : undefined}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setEditCmd({ ...editCmd, text: e.target.value, error: '' })}
                            onPressEnter={applyStepEdit}
                            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditCmd(null); } }}
                          />
                          {editCmd.error
                            ? <div className="stereo-cmd-error">{editCmd.error}</div>
                            : <div className="stereo-cmd-help">Enter — заменить шаг, Esc — отмена</div>}
                        </>
                      ) : describeOp(st.op)}
                      {!st.ok && <div className="stereo-cmd-error">{st.error}</div>}
                      {editNote && editNote.opId === st.op.id ? (
                        <Input
                          size="small"
                          autoFocus
                          value={editNote.text}
                          maxLength={300}
                          placeholder="Подпись к шагу"
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditNote({ ...editNote, text: e.target.value })}
                          onPressEnter={(e) => e.target.blur()}
                          onBlur={saveNote}
                          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditNote(null); } }}
                        />
                      ) : st.op.note && <div className="stereo-step__note">{st.op.note}</div>}
                    </span>
                    <Tooltip title={opToCommand(st.op) ? 'Изменить построение — команда шага (или двойной клик)' : 'Этот шаг командой не выражается'}>
                      <Button
                        className="stereo-step__del"
                        size="small"
                        type="text"
                        icon={<CodeOutlined />}
                        disabled={replay || !opToCommand(st.op)}
                        onClick={(e) => { e.stopPropagation(); startStepEdit(st.op.id); }}
                        aria-label="Изменить построение"
                      />
                    </Tooltip>
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

      <PlanimPointModal
        name={pointTarget}
        scene={scene}
        onClose={() => setPointTarget(null)}
        onEditStep={pointTarget && model.points[pointTarget] ? () => {
          const opId = stepOfTarget(model, { kind: 'point', name: pointTarget });
          setPointTarget(null);
          if (opId) startStepEdit(opId);
        } : null}
        onApply={(next) => {
          setScene(next);
          setPointTarget(null);
          setPending([]);
        }}
      />
      <PlanimMarkTextModal
        target={markModal}
        onClose={() => setMarkTarget(null)}
        onApply={applyMarkText}
        onDelete={markTarget?.opId ? () => { setMarkTarget(null); deleteStep(markTarget.opId); } : null}
        onReset={markTarget?.opId ? () => {
          setScene(setMarkTextPosition(sceneRef.current, markTarget.opId, null));
          setMarkTarget(null);
        } : null}
      />
      <PlanimFigureModal
        open={figureOpen}
        onClose={() => setFigureOpen(false)}
        canAdd={scene.ops.length > 0}
        onApply={applyFigure}
      />
      <StereoLibrary
        kind="planim"
        open={libOpen}
        onClose={() => setLibOpen(false)}
        scene={scene}
        currentDoc={currentDoc}
        dirty={dirty}
        canEdit={!!auth?.canEdit}
        onSaved={onSaved}
        onOpen={(rec) => {
          const sc = withIds(Array.isArray(rec.scene?.ops) ? rec.scene : EMPTY);
          setScene(sc);
          setCurrentDoc({ id: rec.id, title: rec.title });
          setSavedSig(JSON.stringify(sc));
          setPending([]);
          setViewStep(null);
          setView(null);
        }}
      />
      <PlanimHelpModal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        onInsert={(text) => {
          setCmd(text);
          setCmdError('');
          setTimeout(() => cmdRef.current?.focus(), 0);
        }}
      />
      <PlanimTextModal
        open={textOpen}
        onClose={() => setTextOpen(false)}
        scene={scene}
        onLoad={(sc, { color, grid }) => {
          setScene(withIds(sc));
          setApplyColor(!!color);
          setApplyGrid(!!grid);
          setPending([]);
          setViewStep(null);
          setView(null);
        }}
      />
    </div>
  );
}
