import { useState, useCallback } from 'react';
import { useApplySheet } from './useApplySheet';
import {
  LOG_GENERATORS, LOG_LABELS, LOG_EXAM, LOG_GROUPS,
} from '../utils/oral/logarithms';
import { generateOralSheet, allOn } from '../utils/oral/sheet';
import { DEFAULT_LEVEL } from '../utils/oral/levels';

// Генераторы категорий — параметрические, по уровням: `utils/oral/logarithms.js`
// (там же образцы заданий с «Решу» для уровня «Как на экзамене»).

export const CATEGORY_LABELS_LOG = LOG_LABELS;
export const CATEGORY_EXAM_LOG = LOG_EXAM;
export const CATEGORY_GROUPS_LOG = LOG_GROUPS;

export const DEFAULT_SETTINGS_LOG = {
  variantsCount:  4,
  questionsCount: 20,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  columnsCount:   2,
  fontSize:       's',
  decimalOnly:    false,
  level:          DEFAULT_LEVEL,
  categories:     allOn(LOG_LABELS),
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateLogarithmsVariants(settings) {
  return generateOralSheet({ ...DEFAULT_SETTINGS_LOG, ...settings }, LOG_GENERATORS);
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useOralLogarithms() {
  const [title, setTitle]         = useState('Устный счёт: логарифмы');
  const [settings, setSettings]   = useState({ ...DEFAULT_SETTINGS_LOG });
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_LOG });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({
      ...p,
      categories: { ...p.categories, [cat]: checked },
    })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateLogarithmsVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Устный счёт: логарифмы');
    setSettings({ ...DEFAULT_SETTINGS_LOG });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
