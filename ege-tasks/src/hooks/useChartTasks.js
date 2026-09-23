import { useState, useCallback } from 'react';

/**
 * Генератор «Графики и диаграммы» (база №3 и №7): задачи «из жизни» —
 * температура по суткам, разогрев двигателя, среднемесячные значения.
 *
 * Вся логика — в чистом `utils/chartReadingTasks.js`; хук держит состояние
 * листа, устроен как `useGraphTasks` (сохранённые листы, панель порядка).
 */

import {
  DEFAULT_SETTINGS_CHART, generateChartVariants,
} from '../utils/chartReadingTasks';
import { useApplySheet } from './useApplySheet';

const TITLE = 'Графики и диаграммы';

export function useChartTasks() {
  const [title, setTitle] = useState(TITLE);
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS_CHART });
  const [tasksData, setTasksData] = useState(null);

  const applySheet = useApplySheet({
    setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_CHART,
  });

  const updateSetting = useCallback((k, v) => setSettings((p) => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) => setSettings((p) => ({
    ...p, categories: { ...p.categories, [cat]: checked },
  })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateChartVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle(TITLE);
    setSettings({ ...DEFAULT_SETTINGS_CHART });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData, setTasksData, applySheet,
    generate, reset,
  };
}

export default useChartTasks;
