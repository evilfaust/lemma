import { useState, useCallback } from 'react';
import {
  fsuGenerators, FSU_MIX_LABELS, FSU_MIX_KEYS, fsuDefaults,
} from '../utils/shortMultiplication';
import { useApplySheet } from './useApplySheet';
import {
  FR_GENERATORS, FR_LABELS, FR_EXAM, FR_GROUPS,
} from '../utils/oral/fractions';
import { generateOralSheet, allOn } from '../utils/oral/sheet';
import { DEFAULT_LEVEL } from '../utils/oral/levels';

// Генераторы категорий — параметрические, по уровням: `utils/oral/fractions.js`.
// Прежние ручные примеры раздела живут там же образцами уровня «Как на экзамене».

// Раздел говорит обыкновенными дробями — ФСУ здесь на смешанных числах
const FSU_GENERATORS_FR = fsuGenerators({ domain: 'mix', style: 'mix' });

const GENERATORS_FR = { ...FR_GENERATORS, ...FSU_GENERATORS_FR };

export const CATEGORY_LABELS_FR = { ...FR_LABELS, ...FSU_MIX_LABELS };
export const CATEGORY_EXAM_FR = FR_EXAM;
export const CATEGORY_GROUPS_FR = [
  ...FR_GROUPS,
  { label: 'Формулы сокращённого умножения', keys: FSU_MIX_KEYS },
];

export const DEFAULT_SETTINGS_FR = {
  variantsCount:  4,
  questionsCount: 20,
  twoPerPage:     false,
  sideBySide:     true,
  showTeacherKey: true,
  columnsCount:   2,
  fontSize:       's',
  decimalOnly:    false,
  level:          DEFAULT_LEVEL,
  categories: {
    ...allOn(FR_LABELS),
    ...fsuDefaults(FSU_MIX_KEYS),
  },
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateFractionsVariants(settings) {
  return generateOralSheet({ ...DEFAULT_SETTINGS_FR, ...settings }, GENERATORS_FR);
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useOralFractions() {
  const [title, setTitle]         = useState('Устный счёт: действия с обыкновенными дробями');
  const [settings, setSettings]   = useState({ ...DEFAULT_SETTINGS_FR });
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_FR });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({
      ...p,
      categories: { ...p.categories, [cat]: checked },
    })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateFractionsVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Устный счёт: действия с обыкновенными дробями');
    setSettings({ ...DEFAULT_SETTINGS_FR });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
