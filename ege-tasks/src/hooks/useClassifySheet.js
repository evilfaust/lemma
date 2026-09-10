import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_CLASSIFY_SETTINGS,
  bucketsFromPreset,
  createBucket,
  createItem,
  shuffleItems,
  sheetStats,
  classifyWarnings,
} from '../utils/classifySheet';

/**
 * Состояние листа-классификатора.
 *
 * В отличие от генераторов, здесь нечего «формировать»: уравнения пишет
 * учитель, а лист существует с первой минуты. Поэтому хук — это редактор
 * двух списков (карманы и банк) плюс настройки печати; вся счётная часть
 * живёт в `utils/classifySheet.js` и считается на лету.
 *
 * Снимок для `generator_sheets` — `{ buckets, items }` в `tasks_data`.
 */
export function useClassifySheet() {
  const [title, setTitle] = useState('Разложи по типам');
  const [buckets, setBuckets] = useState(() => bucketsFromPreset([
    'noC', 'noB', 'vieta', 'binomSquare', 'perfectSquare', 'full',
  ]));
  const [items, setItems] = useState([]);
  const [settings, setSettings] = useState({ ...DEFAULT_CLASSIFY_SETTINGS });

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // ─── Карманы ───────────────────────────────────────────────────────────────
  const addBucket = useCallback((fields = {}) => {
    setBuckets(prev => [...prev, createBucket(fields)]);
  }, []);

  const addPresetBuckets = useCallback((keys) => {
    setBuckets((prev) => {
      // Тип, который уже есть на листе, второй раз не добавляем: два
      // одинаковых кармана делят между собой уравнения и ломают ключ.
      const have = new Set(prev.map(b => b.presetKey).filter(Boolean));
      const fresh = bucketsFromPreset(keys).filter(b => !have.has(b.presetKey));
      return [...prev, ...fresh];
    });
  }, []);

  // Готовые карманы (окно добора считает их само, чтобы сразу знать id).
  const addBuckets = useCallback((list = []) => {
    setBuckets((prev) => {
      const have = new Set(prev.map(b => b.presetKey).filter(Boolean));
      return [...prev, ...list.filter(b => !b.presetKey || !have.has(b.presetKey))];
    });
  }, []);

  const patchBucket = useCallback((id, fields) => {
    setBuckets(prev => prev.map(b => (b.id === id ? { ...b, ...fields } : b)));
  }, []);

  const removeBucket = useCallback((id) => {
    setBuckets(prev => prev.filter(b => b.id !== id));
    // Уравнения удалённого типа не пропадают — они возвращаются в банк без
    // разметки, иначе учитель терял бы текст вместе с карманом.
    setItems(prev => prev.map(i => (i.bucketId === id ? { ...i, bucketId: null } : i)));
  }, []);

  const moveBucket = useCallback((index, dir) => {
    setBuckets((prev) => {
      const next = index + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[index], arr[next]] = [arr[next], arr[index]];
      return arr;
    });
  }, []);

  // ─── Банк уравнений ────────────────────────────────────────────────────────
  const addItem = useCallback((fields = {}) => {
    setItems(prev => [...prev, createItem(fields)]);
  }, []);

  const addItems = useCallback((list = []) => {
    setItems(prev => [...prev, ...list.map(f => createItem(f))]);
  }, []);

  const patchItem = useCallback((id, fields) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, ...fields } : i)));
  }, []);

  const removeItem = useCallback((id) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const moveItem = useCallback((index, dir) => {
    setItems((prev) => {
      const next = index + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[index], arr[next]] = [arr[next], arr[index]];
      return arr;
    });
  }, []);

  const shuffle = useCallback(() => setItems(prev => shuffleItems(prev)), []);

  const reset = useCallback(() => {
    setItems([]);
    setBuckets(bucketsFromPreset([
      'noC', 'noB', 'vieta', 'binomSquare', 'perfectSquare', 'full',
    ]));
    setSettings({ ...DEFAULT_CLASSIFY_SETTINGS });
  }, []);

  // ─── Снимок для generator_sheets ───────────────────────────────────────────
  const tasksData = useMemo(() => ({ buckets, items }), [buckets, items]);

  const applySheet = useCallback((sheet) => {
    setTitle(sheet.title || 'Разложи по типам');
    setSettings({ ...DEFAULT_CLASSIFY_SETTINGS, ...(sheet.settings || {}) });
    const data = sheet.tasksData || {};
    setBuckets(Array.isArray(data.buckets) ? data.buckets : []);
    setItems(Array.isArray(data.items) ? data.items : []);
  }, []);

  const stats = useMemo(
    () => sheetStats(buckets, items, settings),
    [buckets, items, settings],
  );

  const warnings = useMemo(
    () => classifyWarnings(buckets, items, settings),
    [buckets, items, settings],
  );

  return {
    title, setTitle,
    buckets, items, settings, stats, warnings,
    updateSetting,
    addBucket, addPresetBuckets, addBuckets, patchBucket, removeBucket, moveBucket,
    addItem, addItems, patchItem, removeItem, moveItem, shuffle,
    reset,
    tasksData, applySheet,
  };
}

export default useClassifySheet;
