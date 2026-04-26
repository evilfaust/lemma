import { useCallback, useState } from 'react';
import { api } from '../services/pocketbase';

const CIRCLE_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];

export function circleNum(index) {
  return CIRCLE_NUMBERS[index] ?? `(${index + 1})`;
}

/**
 * Хук управления состоянием маршрутного листа.
 *
 * chain_links: [{fromIndex, toIndex}] — какой ответ куда подставляется.
 * По умолчанию генерируется линейная цепочка: 0→1, 1→2, ...
 */
export default function useRouteSheet() {
  const [title, setTitle] = useState('Маршрутный лист');
  const [tasks, setTasks] = useState([]);
  const [chainLinks, setChainLinks] = useState([]); // [] = линейная (авто)
  const [savedId, setSavedId] = useState(null);
  const [showTeacherKey, setShowTeacherKey] = useState(false);

  // Автогенерация линейной цепочки по числу задач
  const buildLinearChain = useCallback((taskList) => {
    return taskList.slice(0, -1).map((_, i) => ({ fromIndex: i, toIndex: i + 1 }));
  }, []);

  // Эффективные ссылки (если chainLinks пустой — линейная)
  const effectiveLinks = chainLinks.length > 0 ? chainLinks : buildLinearChain(tasks);

  const addTask = useCallback((task) => {
    setTasks(prev => {
      if (prev.find(t => t.id === task.id)) return prev;
      return [...prev, task];
    });
  }, []);

  const removeTask = useCallback((taskId) => {
    setTasks(prev => {
      const newTasks = prev.filter(t => t.id !== taskId);
      // Сбрасываем chain_links — они пересчитаются линейно
      setChainLinks([]);
      return newTasks;
    });
  }, []);

  const moveTask = useCallback((fromIndex, toIndex) => {
    setTasks(prev => {
      const arr = [...prev];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, moved);
      setChainLinks([]);
      return arr;
    });
  }, []);

  const updateTask = useCallback((taskId, fields) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...fields } : t));
  }, []);

  const setCustomChainLinks = useCallback((links) => {
    setChainLinks(links);
  }, []);

  const reset = useCallback(() => {
    setTitle('Маршрутный лист');
    setTasks([]);
    setChainLinks([]);
    setSavedId(null);
    setShowTeacherKey(false);
  }, []);

  const loadFromSaved = useCallback((saved) => {
    setTitle(saved.title || 'Маршрутный лист');
    // PocketBase expand одного relation возвращает object, не array — нормализуем
    const raw = saved.expand?.tasks;
    const tasksList = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    setTasks(tasksList);
    setChainLinks(saved.chain_links || []);
    setSavedId(saved.id);
    setShowTeacherKey(false);
  }, []);

  const save = useCallback(async () => {
    const payload = {
      title,
      tasks: tasks.map(t => t.id),
      chain_links: chainLinks,
    };
    const record = await api.createRouteSheet(payload);
    setSavedId(record.id);
    return record;
  }, [title, tasks, chainLinks]);

  const update = useCallback(async () => {
    if (!savedId) return save();
    const payload = {
      title,
      tasks: tasks.map(t => t.id),
      chain_links: chainLinks,
    };
    return await api.updateRouteSheet(savedId, payload);
  }, [savedId, title, tasks, chainLinks, save]);

  return {
    title, setTitle,
    tasks,
    chainLinks,
    effectiveLinks,
    savedId,
    showTeacherKey, setShowTeacherKey,
    addTask,
    removeTask,
    moveTask,
    updateTask,
    setCustomChainLinks,
    reset,
    loadFromSaved,
    save,
    update,
    circleNum,
  };
}
