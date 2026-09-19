import { useState, useCallback } from 'react';

/**
 * Генератор заданий «по графику» (профиль №9, база №7).
 *
 * Вся математика — в чистом `utils/derivativeGraphTasks.js` (там же ответы и
 * чертежи), хук держит только состояние листа: название, настройки и снимок
 * заданий. Устроен как остальные листовые генераторы, поэтому сохранённые
 * листы, панель порядка и правка задания работают без переделок.
 */

import {
  DEFAULT_SETTINGS_GRAPH, generateGraphVariants,
} from '../utils/derivativeGraphTasks';
import { useApplySheet } from './useApplySheet';

const TITLE = 'Производная и график';

export function useGraphTasks() {
  const [title, setTitle] = useState(TITLE);
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS_GRAPH });
  const [tasksData, setTasksData] = useState(null);

  const applySheet = useApplySheet({
    setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_GRAPH,
  });

  const updateSetting = useCallback((k, v) => setSettings((p) => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) => setSettings((p) => ({
    ...p, categories: { ...p.categories, [cat]: checked },
  })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateGraphVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle(TITLE);
    setSettings({ ...DEFAULT_SETTINGS_GRAPH });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData, setTasksData, applySheet,
    generate, reset,
  };
}

export default useGraphTasks;
