import { useState, useCallback, useEffect, useRef } from 'react';
import { imageToMatrix } from '../utils/imageToMatrix';
import { splitMatrix, snapToTileCount } from '../utils/splitMatrix';
import { fillQRGrid } from '../utils/qrGridFill';
import { api } from '../shared/services/pocketbase';

/**
 * Хук управления командным пиксель-артом.
 *
 * Архитектура:
 *  - Полная матрица (matrix) хранится на уровне сета
 *  - splitMatrix(matrix, tileCount) → tiles[N²] — подматрицы для каждой плитки
 *  - Для каждой плитки хранятся задачи (tileTasks[i]) и customAnswers (tileAnswers[i])
 *  - tileGrids[i] = fillQRGrid(tiles[i], answersForTile(i)) — авто-пересчёт через useEffect
 *
 * Режимы задач:
 *  - 'same'     — sharedTasks / sharedCustomAnswers одинаковы для всех плиток
 *  - 'per_tile' — у каждой плитки свой набор tileTasks[i]
 */
export function useTeamPixelArt() {
  // ── Изображение / матрица ─────────────────────────────────────────────────
  const [imageFile, setImageFile]         = useState(null);
  const [matrix, setMatrix]               = useState(null);   // boolean[][]
  const [processing, setProcessing]       = useState(false);
  const [error, setError]                 = useState(null);

  // ── Параметры сетки ───────────────────────────────────────────────────────
  const [gridSize, setGridSize]           = useState(60);     // квадратная сетка N×N
  const [threshold, setThreshold]         = useState(128);
  const [tileCount, setTileCount]         = useState(2);      // 2=4шт, 3=9шт, 4=16шт

  // ── Режим задач ───────────────────────────────────────────────────────────
  const [taskMode, setTaskMode]           = useState('per_tile'); // 'same' | 'per_tile'

  // ── Shared-задачи (режим 'same') ──────────────────────────────────────────
  const [sharedTasks, setSharedTasks]     = useState([]);
  const [sharedAnswers, setSharedAnswers] = useState({});     // { taskId: string }

  // ── Per-tile задачи (режим 'per_tile') ───────────────────────────────────
  // tileTasks[i] и tileAnswers[i] — массивы длиной tileCount²
  const [tileTasks, setTileTasks]         = useState([]);     // Task[][]
  const [tileAnswers, setTileAnswers]     = useState([]);     // {taskId: string}[]

  // ── Вычисленные плитки / гриды ────────────────────────────────────────────
  const [tiles, setTiles]                 = useState([]);     // boolean[][][]
  const [tileGrids, setTileGrids]         = useState([]);     // Cell[][][]

  // ── Параметры листа ───────────────────────────────────────────────────────
  const [title, setTitle]                 = useState('Командная раскраска');
  const [twoSheets, setTwoSheets]         = useState(false);
  const [twoColumns, setTwoColumns]       = useState(false);

  // ── Сохранение ────────────────────────────────────────────────────────────
  const [savedId, setSavedId]             = useState(null);
  const [saving, setSaving]               = useState(false);

  const totalTiles = tileCount * tileCount;

  // ── Инициализация массивов при смене tileCount ────────────────────────────
  useEffect(() => {
    setTileTasks(prev => {
      const next = Array.from({ length: totalTiles }, (_, i) => prev[i] ?? []);
      return next;
    });
    setTileAnswers(prev => {
      const next = Array.from({ length: totalTiles }, (_, i) => prev[i] ?? {});
      return next;
    });
  }, [totalTiles]);

  // ── Разбивка матрицы на плитки ────────────────────────────────────────────
  useEffect(() => {
    if (!matrix) { setTiles([]); return; }
    setTiles(splitMatrix(matrix, tileCount));
  }, [matrix, tileCount]);

  // ── Авто-пересчёт gридов при смене задач/плиток ───────────────────────────
  useEffect(() => {
    if (!tiles.length) { setTileGrids([]); return; }

    const grids = tiles.map((tile, i) => {
      const tasks  = taskMode === 'same' ? sharedTasks : (tileTasks[i] ?? []);
      const custom = taskMode === 'same' ? sharedAnswers : (tileAnswers[i] ?? {});
      const answers = tasks
        .map(t => { const c = custom[t.id]; return c !== undefined && c !== '' ? c : (t.answer ?? ''); })
        .filter(a => a !== '' && !isNaN(Number(a)))
        .map(Number);
      return answers.length > 0 ? fillQRGrid(tile, answers) : null;
    });
    setTileGrids(grids);
  }, [tiles, taskMode, sharedTasks, sharedAnswers, tileTasks, tileAnswers]);

  // ── Обработка изображения ─────────────────────────────────────────────────
  const processImage = useCallback(async (file, size, thresh) => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    try {
      const snapped = snapToTileCount(size, tileCount);
      const mat = await imageToMatrix(file, snapped, snapped, thresh);
      setMatrix(mat);
      setGridSize(snapped);
    } catch (e) {
      setError('Ошибка обработки изображения: ' + (e.message || String(e)));
    } finally {
      setProcessing(false);
    }
  }, [tileCount]);

  // ── Смена tileCount: пересчитать размер сетки ──────────────────────────────
  const changeTileCount = useCallback((newCount) => {
    setTileCount(newCount);
    setGridSize(prev => snapToTileCount(prev, newCount));
  }, []);

  // ── Shared задачи ─────────────────────────────────────────────────────────
  const addSharedTask = useCallback((task) => {
    setSharedTasks(prev => prev.find(t => t.id === task.id) ? prev : [...prev, task]);
  }, []);

  const removeSharedTask = useCallback((taskId) => {
    setSharedTasks(prev => prev.filter(t => t.id !== taskId));
    setSharedAnswers(prev => { const n = { ...prev }; delete n[taskId]; return n; });
  }, []);

  const moveSharedTask = useCallback((index, direction) => {
    setSharedTasks(prev => {
      const next = [...prev];
      const ti = index + direction;
      if (ti < 0 || ti >= next.length) return prev;
      [next[index], next[ti]] = [next[ti], next[index]];
      return next;
    });
  }, []);

  const setSharedCustomAnswer = useCallback((taskId, value) => {
    setSharedAnswers(prev => ({ ...prev, [taskId]: value }));
  }, []);

  const getSharedAnswerForTask = useCallback((task) => {
    const c = sharedAnswers[task.id];
    return c !== undefined && c !== '' ? c : (task.answer ?? '');
  }, [sharedAnswers]);

  // ── Per-tile задачи ───────────────────────────────────────────────────────
  const addTileTask = useCallback((tileIndex, task) => {
    setTileTasks(prev => {
      const next = [...prev];
      const cur = next[tileIndex] ?? [];
      if (cur.find(t => t.id === task.id)) return prev;
      next[tileIndex] = [...cur, task];
      return next;
    });
  }, []);

  const removeTileTask = useCallback((tileIndex, taskId) => {
    setTileTasks(prev => {
      const next = [...prev];
      next[tileIndex] = (next[tileIndex] ?? []).filter(t => t.id !== taskId);
      return next;
    });
    setTileAnswers(prev => {
      const next = [...prev];
      const cur = { ...(next[tileIndex] ?? {}) };
      delete cur[taskId];
      next[tileIndex] = cur;
      return next;
    });
  }, []);

  const moveTileTask = useCallback((tileIndex, index, direction) => {
    setTileTasks(prev => {
      const next = [...prev];
      const arr = [...(next[tileIndex] ?? [])];
      const ti = index + direction;
      if (ti < 0 || ti >= arr.length) return prev;
      [arr[index], arr[ti]] = [arr[ti], arr[index]];
      next[tileIndex] = arr;
      return next;
    });
  }, []);

  const setTileCustomAnswer = useCallback((tileIndex, taskId, value) => {
    setTileAnswers(prev => {
      const next = [...prev];
      next[tileIndex] = { ...(next[tileIndex] ?? {}), [taskId]: value };
      return next;
    });
  }, []);

  const getTileAnswerForTask = useCallback((tileIndex, task) => {
    const c = (tileAnswers[tileIndex] ?? {})[task.id];
    return c !== undefined && c !== '' ? c : (task.answer ?? '');
  }, [tileAnswers]);

  // ── Копировать задачи с плитки на все остальные ───────────────────────────
  const copyTileTasksToAll = useCallback((fromIndex) => {
    const srcTasks   = tileTasks[fromIndex] ?? [];
    const srcAnswers = tileAnswers[fromIndex] ?? {};
    setTileTasks(prev  => prev.map((_, i)  => i === fromIndex ? prev[i]  : [...srcTasks]));
    setTileAnswers(prev => prev.map((_, i) => i === fromIndex ? prev[i] : { ...srcAnswers }));
  }, [tileTasks, tileAnswers]);

  // ── Сохранить в БД ────────────────────────────────────────────────────────
  const save = useCallback(async () => {
    if (!matrix) return null;
    setSaving(true);
    try {
      const setData = {
        title,
        matrix,
        grid_cols: matrix[0]?.length ?? gridSize,
        grid_rows: matrix.length,
        tile_count: tileCount,
        task_mode: taskMode,
        threshold,
        two_sheets: twoSheets,
        two_columns: twoColumns,
        shared_tasks: taskMode === 'same' ? sharedTasks.map(t => t.id) : [],
        shared_custom_answers: taskMode === 'same' ? sharedAnswers : {},
      };

      let record;
      if (savedId) {
        record = await api.updatePixelArtTeamSet(savedId, setData);
      } else {
        record = await api.createPixelArtTeamSet(setData);
        setSavedId(record.id);
      }

      // Сохраняем плитки только в per_tile-режиме
      if (taskMode === 'per_tile') {
        for (let i = 0; i < totalTiles; i++) {
          const tileData = {
            tasks: (tileTasks[i] ?? []).map(t => t.id),
            custom_answers: tileAnswers[i] ?? {},
          };
          if (tileGrids[i] != null) tileData.grid = tileGrids[i];
          await api.upsertPixelArtTeamTile(record.id, i, tileData);
        }
      }

      return record;
    } finally {
      setSaving(false);
    }
  }, [
    matrix, title, gridSize, tileCount, taskMode, threshold,
    twoSheets, twoColumns, sharedTasks, sharedAnswers,
    savedId, totalTiles, tileTasks, tileAnswers, tileGrids,
  ]);

  // ── Загрузка из сохранённой записи ────────────────────────────────────────
  const loadFromSaved = useCallback((setRecord, tileRecords) => {
    setSavedId(setRecord.id);
    setTitle(setRecord.title || 'Командная раскраска');
    setTileCount(setRecord.tile_count ?? 2);
    setGridSize(setRecord.grid_cols ?? 30);
    setThreshold(setRecord.threshold ?? 128);
    setTaskMode(setRecord.task_mode ?? 'per_tile');
    setTwoSheets(!!setRecord.two_sheets);
    setTwoColumns(!!setRecord.two_columns);
    if (setRecord.matrix) setMatrix(setRecord.matrix);
    setSharedTasks(setRecord.expand?.shared_tasks ?? []);
    setSharedAnswers(setRecord.shared_custom_answers ?? {});

    if (tileRecords?.length) {
      const sorted = [...tileRecords].sort((a, b) => a.tile_index - b.tile_index);
      setTileTasks(sorted.map(t => t.expand?.tasks ?? []));
      setTileAnswers(sorted.map(t => t.custom_answers ?? {}));
    }
    setImageFile(null);
    setError(null);
  }, []);

  // ── Сброс ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setImageFile(null);
    setMatrix(null);
    setProcessing(false);
    setError(null);
    setGridSize(60);
    setThreshold(128);
    setTileCount(2);
    setTaskMode('per_tile');
    setSharedTasks([]);
    setSharedAnswers({});
    setTileTasks([]);
    setTileAnswers([]);
    setTiles([]);
    setTileGrids([]);
    setTitle('Командная раскраска');
    setTwoSheets(false);
    setTwoColumns(false);
    setSavedId(null);
  }, []);

  return {
    // Изображение
    imageFile, setImageFile,
    matrix, setMatrix,
    processing, error,
    // Параметры сетки
    gridSize, setGridSize,
    threshold, setThreshold,
    tileCount, changeTileCount,
    totalTiles,
    // Режим
    taskMode, setTaskMode,
    // Shared
    sharedTasks, setSharedTasks, sharedAnswers,
    addSharedTask, removeSharedTask, moveSharedTask,
    setSharedCustomAnswer, getSharedAnswerForTask,
    // Per-tile
    tileTasks, setTileTasks, tileAnswers,
    addTileTask, removeTileTask, moveTileTask,
    setTileCustomAnswer, getTileAnswerForTask,
    copyTileTasksToAll,
    // Вычисленное
    tiles, tileGrids,
    // Лист
    title, setTitle,
    twoSheets, setTwoSheets,
    twoColumns, setTwoColumns,
    // Действия
    processImage, save, loadFromSaved, reset,
    saving, savedId, setSavedId,
  };
}
