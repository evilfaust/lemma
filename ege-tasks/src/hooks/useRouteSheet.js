import { useCallback, useMemo, useRef, useState } from 'react';
import { api } from '../services/pocketbase';
import {
  circleNum, chainIssues, normalizeRouteSettings, DEFAULT_ROUTE_SETTINGS,
} from '../utils/routeSheet';

// Кружковые номера и разбор цепочки переехали в utils/routeSheet.js — там они
// без React и под тестами. Реэкспорт оставлен: на него завязаны редактор задачи
// и drawer AI-генерации.
export { circleNum };

/**
 * Хук управления состоянием маршрутного листа.
 *
 * chain_links: [{fromIndex, toIndex}] — какой ответ куда подставляется.
 * По умолчанию генерируется линейная цепочка: 0→1, 1→2, ...
 *
 * settings — настройки печатного листа (см. DEFAULT_ROUTE_SETTINGS). Хранятся
 * вместе с листом: лист на 4 задачи с клеткой и лист на 12 устных задач — это
 * разные листы, а не разные настройки одного учителя.
 *
 * Состав листа хранится ДВАЖДЫ и по-разному:
 *   `tasks`      — relation на банк: только задачи, взятые из каталога;
 *   `tasks_data` — снимок всей цепочки по порядку.
 * Причина: задача «уменьшите [②] в [①] раз» вне своей цепочки бессмысленна, в
 * банк такому не место (тот же вывод, что у `generator_sheets`). Поэтому
 * импортированные и сочинённые задачи живут только снимком, а из каталога —
 * и там, и там. Лист, сохранённый до появления снимка, читается из relation.
 */
export default function useRouteSheet() {
  const [title, setTitle] = useState('Маршрутный лист');
  const [tasks, setTasks] = useState([]);
  const [chainLinks, setChainLinks] = useState([]); // [] = линейная (авто)
  const [savedId, setSavedId] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_ROUTE_SETTINGS);
  // Локальные id для задач, которых нет в банке: React нужен стабильный key,
  // а PocketBase такие id не увидит — в relation они не уезжают.
  const localSeq = useRef(0);

  // Автогенерация линейной цепочки по числу задач
  const buildLinearChain = useCallback((taskList) => {
    return taskList.slice(0, -1).map((_, i) => ({ fromIndex: i, toIndex: i + 1 }));
  }, []);

  // Эффективные ссылки (если chainLinks пустой — линейная)
  const effectiveLinks = chainLinks.length > 0 ? chainLinks : buildLinearChain(tasks);

  // Разрывы цепочки: ссылка на задачу без ответа, на задачу ниже по листу и т.п.
  const issues = useMemo(() => chainIssues(tasks), [tasks]);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const addTask = useCallback((task) => {
    setTasks(prev => {
      if (prev.find(t => t.id === task.id)) return prev;
      return [...prev, task];
    });
  }, []);

  /**
   * Добавить задачи, которых нет в банке (импорт, ИИ-генерация).
   * `__local: true` — метка «в relation не отправлять».
   */
  const addLocalTasks = useCallback((list) => {
    const prepared = list.map(t => ({
      id: `local-${Date.now()}-${localSeq.current++}`,
      statement_md: t.statement_md || '',
      answer: t.answer || '',
      __local: true,
    }));
    setTasks(prev => [...prev, ...prepared]);
    setChainLinks([]);
    return prepared;
  }, []);

  /** Заменить цепочку целиком (загрузка готового маршрута вместо текущего). */
  const replaceTasks = useCallback((list) => {
    setTasks(list.map(t => ({
      id: `local-${Date.now()}-${localSeq.current++}`,
      statement_md: t.statement_md || '',
      answer: t.answer || '',
      __local: true,
    })));
    setChainLinks([]);
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
    setSettings(DEFAULT_ROUTE_SETTINGS);
  }, []);

  const loadFromSaved = useCallback((saved) => {
    setTitle(saved.title || 'Маршрутный лист');
    // PocketBase expand одного relation возвращает object, не array — нормализуем
    const raw = saved.expand?.tasks;
    const fromBank = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const byId = new Map(fromBank.map(t => [t.id, t]));

    // Снимок знает ПОРЯДОК цепочки, relation — актуальный текст задачи банка.
    // Поэтому порядок берём из снимка, а содержимое — из банка, если задача
    // оттуда: учитель мог поправить её в каталоге после сохранения листа.
    const snapshot = Array.isArray(saved.tasks_data) ? saved.tasks_data : null;
    const tasksList = snapshot?.length
      ? snapshot.map((item, i) => (item.task && byId.get(item.task))
        || {
          id: `local-${saved.id}-${i}`,
          statement_md: item.statement_md || '',
          answer: item.answer || '',
          __local: true,
        })
      : fromBank;
    setTasks(tasksList);
    setChainLinks(saved.chain_links || []);
    setSavedId(saved.id);
    // Лист мог быть сохранён до появления настроек печати — нормализация даёт
    // ему текущий вид листа, а не пустые поля.
    setSettings(normalizeRouteSettings(saved.settings));
  }, []);

  const buildPayload = useCallback(() => ({
    title,
    // В relation уходят только задачи банка: локальным там делать нечего, да и
    // PocketBase на выдуманный id ответит 400.
    tasks: tasks.filter(t => !t.__local).map(t => t.id),
    tasks_data: tasks.map(t => ({
      statement_md: t.statement_md || '',
      answer: t.answer || '',
      task: t.__local ? null : t.id,
    })),
    chain_links: chainLinks,
    settings,
  }), [title, tasks, chainLinks, settings]);

  const save = useCallback(async () => {
    const record = await api.createRouteSheet(buildPayload());
    setSavedId(record.id);
    return record;
  }, [buildPayload]);

  const update = useCallback(async () => {
    if (!savedId) return save();
    return await api.updateRouteSheet(savedId, buildPayload());
  }, [savedId, buildPayload, save]);

  return {
    title, setTitle,
    tasks,
    chainLinks,
    effectiveLinks,
    issues,
    savedId,
    settings, updateSetting,
    addTask,
    addLocalTasks,
    replaceTasks,
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
