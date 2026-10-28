import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { suggestGivens, suggestFlips } from '../utils/nonogram/fix';
import {
  NONOGRAM_DEFAULTS, normalizeNonogramSettings, analyze, nonogramKey,
  generateNonogramVariants, nonogramTasksData,
} from '../utils/nonogram/sheet';

/**
 * Состояние генератора японского кроссворда.
 *
 * Картинка (`matrix`) приходит из загрузчика, библиотеки или редактора
 * пикселей. Готовые клетки (`givens`) пересчитываются при каждой новой
 * картинке — `setPicture`; загрузка сохранённого листа ставит их как были.
 * Подсказки-примеры пересобираются сами, когда устарели (ключ свежести —
 * `nonogramKey`), с короткой задержкой: клики в редакторе пикселей не
 * должны гонять генератор на каждый пиксель.
 */
export function useNonogram() {
  const [title, setTitle] = useState('Японский кроссворд');
  const [settings, setSettings] = useState(NONOGRAM_DEFAULTS);
  const [matrix, setMatrixState] = useState(null);
  const [givens, setGivens] = useState([]);
  const [clueSet, setClueSet] = useState(null); // { variants, stats, key }
  const [flipped, setFlipped] = useState(0);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => normalizeNonogramSettings({ ...prev, [key]: value }));
  }, []);

  /** Новая картинка: готовые клетки подбираются заново. */
  const setPicture = useCallback((m) => {
    setMatrixState(m);
    setFlipped(0);
    setGivens(m?.length ? suggestGivens(m).givens : []);
  }, []);

  /** Правка картинки по пикселю (редактор): учительские готовые клетки сохраняются, если верны. */
  const editPicture = useCallback((updater) => {
    setMatrixState(prev => {
      const next = updater(prev);
      setGivens(g => (next?.length ? suggestGivens(next, { keep: g }).givens : []));
      return next;
    });
  }, []);

  const toggleCell = useCallback((r, c) => {
    editPicture(prev => prev.map((row, i) => (i === r ? row.map((v, j) => (j === c ? !v : v)) : row)));
  }, [editPicture]);
  const clearMatrix = useCallback(() => editPicture(prev => prev.map(row => row.map(() => false))), [editPicture]);
  const fillMatrix = useCallback(() => editPicture(prev => prev.map(row => row.map(() => true))), [editPicture]);
  const invertMatrix = useCallback(() => editPicture(prev => prev.map(row => row.map(v => !v))), [editPicture]);

  /** Пустой холст под рисование руками. */
  const blankPicture = useCallback(() => {
    const m = Array.from({ length: settings.rows }, () => new Array(settings.cols).fill(false));
    setMatrixState(m);
    setGivens([]);
  }, [settings.rows, settings.cols]);

  /** Клик по клетке на схеме: поставить/снять готовую клетку. */
  const toggleGiven = useCallback((r, c) => {
    if (!matrix) return;
    setGivens(prev => {
      const has = prev.some(g => g.r === r && g.c === c);
      return has
        ? prev.filter(g => !(g.r === r && g.c === c))
        : [...prev, { r, c, v: matrix[r][c] ? 1 : 0 }];
    });
  }, [matrix]);

  /** Подобрать готовые клетки заново (с нуля). */
  const autoGivens = useCallback(() => {
    if (matrix) setGivens(suggestGivens(matrix).givens);
  }, [matrix]);

  /** Дополнить готовые клетки учителя до решаемого. */
  const completeGivens = useCallback(() => {
    if (matrix) setGivens(prev => suggestGivens(matrix, { keep: prev }).givens);
  }, [matrix]);

  /** «Подправить картинку»: переключить пару пикселей вместо готовых клеток. */
  const fixPicture = useCallback(() => {
    if (!matrix) return null;
    const res = suggestFlips(matrix);
    setMatrixState(res.matrix);
    setFlipped(n => n + res.flips.length);
    setGivens(suggestGivens(res.matrix).givens);
    return res;
  }, [matrix]);

  const analysis = useMemo(() => analyze(matrix, givens), [matrix, givens]);
  const key = useMemo(() => nonogramKey(matrix, settings), [matrix, settings]);
  const stale = Boolean(matrix) && clueSet?.key !== key;

  const regenerate = useCallback(() => {
    if (!matrix?.length) { setClueSet(null); return; }
    setClueSet(generateNonogramVariants(matrix, settings));
  }, [matrix, settings]);

  // Подсказки устарели — пересобрать (после паузы)
  const regenRef = useRef(regenerate);
  regenRef.current = regenerate;
  useEffect(() => {
    if (!stale) return undefined;
    const t = setTimeout(() => regenRef.current(), 250);
    return () => clearTimeout(t);
  }, [stale, key]);

  const tasksData = useMemo(() => (matrix && clueSet && !stale
    ? nonogramTasksData({ matrix, givens, ...clueSet })
    : null), [matrix, givens, clueSet, stale]);

  /** Загрузка сохранённого листа (`useSheetStorage.onLoad`). */
  const applySheet = useCallback(({ title: t, settings: s, tasksData: data }) => {
    setTitle(t || 'Японский кроссворд');
    const ns = normalizeNonogramSettings(s);
    setSettings(ns);
    if (data?.matrix?.length) {
      setMatrixState(data.matrix);
      setGivens(Array.isArray(data.givens) ? data.givens : []);
      setClueSet(data.variants?.length
        ? { variants: data.variants, stats: data.stats || null, key: nonogramKey(data.matrix, ns) }
        : null);
    } else {
      setMatrixState(null);
      setGivens([]);
      setClueSet(null);
    }
    setFlipped(0);
  }, []);

  const reset = useCallback(() => {
    setTitle('Японский кроссворд');
    setSettings(NONOGRAM_DEFAULTS);
    setMatrixState(null);
    setGivens([]);
    setClueSet(null);
    setFlipped(0);
  }, []);

  return {
    title, setTitle,
    settings, updateSetting,
    matrix, setPicture, toggleCell, clearMatrix, fillMatrix, invertMatrix, blankPicture,
    givens, toggleGiven, autoGivens, completeGivens, fixPicture, flipped,
    analysis,
    variants: clueSet?.variants || [],
    stats: clueSet?.stats || null,
    stale, regenerate,
    tasksData, applySheet, reset,
  };
}
