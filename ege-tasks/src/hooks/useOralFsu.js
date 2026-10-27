import { useState, useCallback } from 'react';
import { useApplySheet } from './useApplySheet';
import {
  FSU_SECTION_GENERATORS, FSU_SECTION_LABELS, FSU_SECTION_GROUPS, FSU_DEFAULT_ON,
} from '../utils/oral/fsu';
import { generateOralSheet } from '../utils/oral/sheet';
import { DEFAULT_LEVEL } from '../utils/oral/levels';

// Генераторы категорий — параметрические, по уровням: `utils/oral/fsu.js`.
// Ответ — формула, поэтому «как в бланке» здесь нет (`decimalOnly` не
// выставляется), а тест — только A/B/C/D с типичными ошибками.

export const CATEGORY_LABELS_FSU = FSU_SECTION_LABELS;
export const CATEGORY_GROUPS_FSU = FSU_SECTION_GROUPS;

const TITLE = 'Формулы сокращённого умножения';

export const DEFAULT_SETTINGS_FSU = {
  variantsCount:  4,
  questionsCount: 10,      // разминка на 5–7 минут
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  columnsCount:   2,
  fontSize:       's',
  level:          DEFAULT_LEVEL,
  categories: Object.fromEntries(
    Object.keys(FSU_SECTION_LABELS).map(k => [k, FSU_DEFAULT_ON.includes(k)]),
  ),
};

// ─── Чистая функция генерации (для смешанных работ и сохранённых листов) ─────
export function generateFsuVariants(settings) {
  return generateOralSheet(
    { ...DEFAULT_SETTINGS_FSU, ...settings, decimalOnly: false },
    FSU_SECTION_GENERATORS,
  );
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useOralFsu() {
  const [title, setTitle]         = useState(TITLE);
  const [settings, setSettings]   = useState({ ...DEFAULT_SETTINGS_FSU });
  const [tasksData, setTasksData] = useState(null);

  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_FSU });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({
      ...p,
      categories: { ...p.categories, [cat]: checked },
    })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateFsuVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle(TITLE);
    setSettings({ ...DEFAULT_SETTINGS_FSU });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
