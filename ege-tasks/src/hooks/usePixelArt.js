import { useState, useCallback, useRef, useEffect } from 'react';
import { imageToMatrix } from '../utils/imageToMatrix';
import { fillQRGrid } from '../utils/qrGridFill';

/**
 * Хук управления состоянием листа-раскраски (Pixel Art Worksheet).
 *
 * Архитектура:
 *  - processImage(file, cols, rows, thresh) → обновляет matrix
 *  - useEffect([matrix, tasks, customAnswers]) → авто-пересчитывает grid
 *  - Клетки grid: { value: number, isAnswer: boolean }
 */
export function usePixelArt() {
  // ── Изображение ──────────────────────────────────────────────────────────
  const [imageFile, setImageFile] = useState(null);
  const [imageDimensions, setImageDimensions] = useState(null); // { width, height }
  const [matrix, setMatrix] = useState(null);                   // boolean[][]
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  // ── Параметры сетки ───────────────────────────────────────────────────────
  const [gridCols, setGridCols] = useState(25);
  const [gridRows, setGridRows] = useState(25);
  const [threshold, setThreshold] = useState(128);
  const [lockAspect, setLockAspect] = useState(false);

  // ── Задачи ────────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState([]);
  const [customAnswers, setCustomAnswers] = useState({});

  // ── Результат ─────────────────────────────────────────────────────────────
  const [grid, setGrid] = useState(null); // Cell[][]

  // ── Параметры листа ───────────────────────────────────────────────────────
  const [title, setTitle] = useState('Раскраска');
  const [twoSheets, setTwoSheets] = useState(false);
  const [showTeacherKey, setShowTeacherKey] = useState(false);

  // ── Сохранение ────────────────────────────────────────────────────────────
  const [savedId, setSavedId] = useState(null); // ID записи в БД (null = новый)

  // ── Авто-пересчёт grid при смене matrix / tasks / customAnswers ───────────
  useEffect(() => {
    if (!matrix) {
      setGrid(null);
      return;
    }
    const answers = tasks
      .map(t => {
        const c = customAnswers[t.id];
        return c !== undefined && c !== '' ? c : (t.answer ?? '');
      })
      .filter(a => a !== '' && !isNaN(Number(a)))
      .map(Number);

    setGrid(answers.length > 0 ? fillQRGrid(matrix, answers) : null);
  }, [matrix, tasks, customAnswers]);

  // ── Задачи ────────────────────────────────────────────────────────────────
  const getAnswerForTask = useCallback((task) => {
    const c = customAnswers[task.id];
    if (c !== undefined && c !== '') return c;
    return task.answer ?? '';
  }, [customAnswers]);

  const addTask = useCallback((task) => {
    setTasks(prev => prev.find(t => t.id === task.id) ? prev : [...prev, task]);
  }, []);

  const removeTask = useCallback((taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setCustomAnswers(prev => { const n = { ...prev }; delete n[taskId]; return n; });
  }, []);

  const moveTask = useCallback((index, direction) => {
    setTasks(prev => {
      const next = [...prev];
      const ti = index + direction;
      if (ti < 0 || ti >= next.length) return prev;
      [next[index], next[ti]] = [next[ti], next[index]];
      return next;
    });
  }, []);

  const setCustomAnswer = useCallback((taskId, value) => {
    setCustomAnswers(prev => ({ ...prev, [taskId]: value }));
  }, []);

  const updateTask = useCallback((taskId, vals) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...vals } : t));
  }, []);

  // ── Ручное редактирование матрицы ────────────────────────────────────────
  const toggleCell = useCallback((r, c, value) => {
    setMatrix(prev => {
      if (!prev) return prev;
      const next = prev.map(row => [...row]);
      next[r][c] = value;
      return next;
    });
  }, []);

  const clearMatrix = useCallback(() => {
    setMatrix(prev => prev ? prev.map(row => row.map(() => false)) : prev);
  }, []);

  const fillMatrix = useCallback(() => {
    setMatrix(prev => prev ? prev.map(row => row.map(() => true)) : prev);
  }, []);

  const invertMatrix = useCallback(() => {
    setMatrix(prev => prev ? prev.map(row => row.map(v => !v)) : prev);
  }, []);

  // ── Создать пустую матрицу нужного размера ────────────────────────────────
  const createEmptyMatrix = useCallback((cols, rows) => {
    setMatrix(Array.from({ length: rows }, () => Array(cols).fill(false)));
    setGrid(null);
  }, []);

  // ── Обработка изображения ─────────────────────────────────────────────────
  /**
   * Конвертирует изображение в матрицу. Grid пересчитается автоматически через useEffect.
   */
  const processImage = useCallback(async (file, cols, rows, thresh) => {
    if (!file) return;
    setProcessing(true);
    setError(null);
    try {
      const mat = await imageToMatrix(file, cols, rows, thresh);
      setMatrix(mat);
    } catch (e) {
      setError('Ошибка обработки изображения: ' + (e.message || String(e)));
    } finally {
      setProcessing(false);
    }
  }, []);

  // ── Загрузка из сохранения ────────────────────────────────────────────────
  const loadFromSaved = useCallback((record) => {
    setSavedId(record.id);
    setTitle(record.title || 'Раскраска');
    setGridCols(record.grid_cols || 25);
    setGridRows(record.grid_rows || 25);
    setThreshold(record.threshold ?? 128);
    setTwoSheets(!!record.two_sheets);
    setShowTeacherKey(!!record.show_teacher_key);
    setCustomAnswers(record.custom_answers || {});
    // Задачи приходят через expand
    const expandedTasks = record.expand?.tasks || [];
    setTasks(expandedTasks);
    // Восстанавливаем матрицу (boolean[][]) и grid пересчитается через useEffect
    if (record.matrix) {
      setMatrix(record.matrix);
    }
    setImageFile(null);
    setImageDimensions(null);
    setError(null);
  }, []);

  // ── Сброс ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setImageFile(null);
    setImageDimensions(null);
    setMatrix(null);
    setGrid(null);
    setGridCols(25);
    setGridRows(25);
    setThreshold(128);
    setLockAspect(false);
    setTasks([]);
    setCustomAnswers({});
    setTitle('Раскраска');
    setTwoSheets(false);
    setShowTeacherKey(false);
    setError(null);
    setSavedId(null);
  }, []);

  return {
    // Изображение
    imageFile, setImageFile,
    imageDimensions, setImageDimensions,
    matrix,
    processing, error,
    // Параметры сетки
    gridCols, setGridCols,
    gridRows, setGridRows,
    threshold, setThreshold,
    lockAspect, setLockAspect,
    // Задачи
    tasks, addTask, removeTask, moveTask, updateTask,
    customAnswers, setCustomAnswer, getAnswerForTask,
    // Результат
    grid,
    // Параметры листа
    title, setTitle,
    twoSheets, setTwoSheets,
    showTeacherKey, setShowTeacherKey,
    // Действия
    processImage, reset, loadFromSaved,
    toggleCell, clearMatrix, fillMatrix, invertMatrix, createEmptyMatrix,
    // Сохранение
    savedId, setSavedId,
  };
}
