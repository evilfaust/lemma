import { useState, useCallback } from 'react';
import { useApplySheet } from './useApplySheet';
import {
  LOGEXP_GENERATORS, LOGEXP_LABELS, LOGEXP_EXAM, LOGEXP_GROUPS,
} from '../utils/oral/logexp';
import { generateOralSheet, allOn } from '../utils/oral/sheet';
import { DEFAULT_LEVEL } from '../utils/oral/levels';

// Генераторы — параметрические, по уровням: `utils/oral/logexp.js`
// (уравнение строится от корня, область определения соблюдена по построению).

export const CATEGORY_LABELS_LOGEXP = LOGEXP_LABELS;
export const CATEGORY_EXAM_LOGEXP = LOGEXP_EXAM;
export const CATEGORY_GROUPS_LOGEXP = LOGEXP_GROUPS;

export const DEFAULT_SETTINGS_LOGEXP = {
  variantsCount:  4,
  questionsCount: 20,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  columnsCount:   2,
  fontSize:       's',
  decimalOnly:    false,
  level:          DEFAULT_LEVEL,
  categories:     allOn(LOGEXP_LABELS),
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateLogExpVariants(settings) {
  return generateOralSheet({ ...DEFAULT_SETTINGS_LOGEXP, ...settings }, LOGEXP_GENERATORS);
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useLogExpEquations() {
  const [title, setTitle]         = useState('Показательные и логарифмические уравнения');
  const [settings, setSettings]   = useState({ ...DEFAULT_SETTINGS_LOGEXP });
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_LOGEXP });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({
      ...p,
      categories: { ...p.categories, [cat]: checked },
    })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateLogExpVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Показательные и логарифмические уравнения');
    setSettings({ ...DEFAULT_SETTINGS_LOGEXP });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
