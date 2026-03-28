import { useState, useCallback } from 'react';
import { urlToQRMatrix, estimateQRSize } from '../utils/qrMatrix';
import { fillQRGrid } from '../utils/qrGridFill';

/**
 * Хук управления состоянием QR-листа.
 *
 * tasks: [{ id, statement_md, answer, code, topic }]  — выбранные задачи
 * customAnswers: { [taskId]: string }                 — ответы введённые вручную
 * qrUrl: string                                       — URL для QR
 * matrix: boolean[][] | null                          — QR-матрица
 * grid:   Cell[][] | null                             — заполненная сетка
 * mode:   'student' | 'teacher'                       — режим просмотра
 * title:  string                                      — заголовок листа
 */
export function useQRWorksheet() {
  const [tasks, setTasks] = useState([]);
  const [customAnswers, setCustomAnswers] = useState({});
  const [qrUrl, setQrUrl] = useState('');
  const [matrix, setMatrix] = useState(null);
  const [grid, setGrid] = useState(null);
  const [mode, setMode] = useState('student');
  const [title, setTitle] = useState('QR-лист');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  /** Получить числовой ответ задачи (из поля или из customAnswers) */
  const getAnswerForTask = useCallback((task) => {
    const custom = customAnswers[task.id];
    if (custom !== undefined && custom !== '') return custom;
    return task.answer ?? '';
  }, [customAnswers]);

  /** Все числовые ответы (только непустые) */
  const getAnswers = useCallback(() => {
    return tasks
      .map(t => getAnswerForTask(t))
      .filter(a => a !== '' && !isNaN(Number(a)))
      .map(Number);
  }, [tasks, getAnswerForTask]);

  /** Добавить задачу (без дублей) */
  const addTask = useCallback((task) => {
    setTasks(prev => {
      if (prev.find(t => t.id === task.id)) return prev;
      return [...prev, task];
    });
  }, []);

  /** Удалить задачу */
  const removeTask = useCallback((taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setCustomAnswers(prev => {
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
  }, []);

  /** Установить ответ вручную для конкретной задачи */
  const setCustomAnswer = useCallback((taskId, value) => {
    setCustomAnswers(prev => ({ ...prev, [taskId]: value }));
  }, []);

  /** Переместить задачу вверх/вниз */
  const moveTask = useCallback((index, direction) => {
    setTasks(prev => {
      const next = [...prev];
      const targetIdx = index + direction;
      if (targetIdx < 0 || targetIdx >= next.length) return prev;
      [next[index], next[targetIdx]] = [next[targetIdx], next[index]];
      return next;
    });
  }, []);

  /** Основная функция: генерация матрицы и сетки */
  const generate = useCallback(async () => {
    if (!qrUrl.trim()) {
      setError('Введите URL для QR-кода');
      return false;
    }
    const answers = getAnswers();
    if (answers.length === 0) {
      setError('Добавьте задачи с числовыми ответами');
      return false;
    }

    setGenerating(true);
    setError(null);
    try {
      const mat = await urlToQRMatrix(qrUrl.trim());
      const g = fillQRGrid(mat, answers);
      setMatrix(mat);
      setGrid(g);
      return true;
    } catch (e) {
      setError('Не удалось сгенерировать QR: ' + (e.message || e));
      return false;
    } finally {
      setGenerating(false);
    }
  }, [qrUrl, getAnswers]);

  /** Сброс */
  const reset = useCallback(() => {
    setTasks([]);
    setCustomAnswers({});
    setQrUrl('');
    setMatrix(null);
    setGrid(null);
    setMode('student');
    setTitle('QR-лист');
    setError(null);
  }, []);

  /** Обновить задачу в списке после редактирования */
  const updateTask = useCallback((taskId, updatedValues) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updatedValues } : t));
  }, []);

  /** Загрузить из сохранённой записи БД */
  const loadFromSaved = useCallback((record) => {
    setTitle(record.title || 'QR-лист');
    setQrUrl(record.qr_url || '');
    setCustomAnswers(record.custom_answers || {});
    setGrid(record.grid || null);
    setMatrix(null);
    setMode('student');
    setError(null);
    // tasks берём из expand, чтобы иметь полные объекты
    const expandedTasks = record.expand?.tasks ?? [];
    // Сохраняем порядок из поля tasks (массив ID)
    const taskIds = record.tasks ?? [];
    const taskMap = Object.fromEntries(expandedTasks.map(t => [t.id, t]));
    setTasks(taskIds.map(id => taskMap[id]).filter(Boolean));
  }, []);

  /** Размер QR (для информации) */
  const qrSize = qrUrl.trim() ? estimateQRSize(qrUrl.trim()) : null;

  return {
    tasks, addTask, removeTask, moveTask, updateTask,
    customAnswers, setCustomAnswer, getAnswerForTask, getAnswers,
    qrUrl, setQrUrl,
    matrix, grid,
    mode, setMode,
    title, setTitle,
    generating, error,
    generate, reset, loadFromSaved,
    qrSize,
  };
}
