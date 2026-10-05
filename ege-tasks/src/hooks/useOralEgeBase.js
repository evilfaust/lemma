import { useState, useCallback } from 'react';
import {
  fsuGenerators, FSU_DEC_LABELS, FSU_DEC_KEYS, fsuDefaults,
} from '../utils/shortMultiplication';
import { useApplySheet } from './useApplySheet';
import {
  DEC_GENERATORS, DEC_LABELS, DEC_EXAM, DEC_GROUPS,
} from '../utils/oral/decimals';
import { generateOralSheet, allOn } from '../utils/oral/sheet';
import { DEFAULT_LEVEL } from '../utils/oral/levels';

// Генераторы категорий — параметрические, по уровням: `utils/oral/decimals.js`.
// Прежние ручные примеры раздела живут там же образцами уровня «Как на экзамене».

// Раздел говорит десятичными — ФСУ здесь тоже на десятичных дробях
const FSU_GENERATORS_EGE = fsuGenerators({ domain: 'dec', style: 'dec' });

const GENERATORS_EGE = { ...DEC_GENERATORS, ...FSU_GENERATORS_EGE };

export const CATEGORY_LABELS_EGE = { ...DEC_LABELS, ...FSU_DEC_LABELS };
export const CATEGORY_EXAM_EGE = DEC_EXAM;
export const CATEGORY_GROUPS_EGE = [
  ...DEC_GROUPS,
  { label: 'Формулы сокращённого умножения', keys: FSU_DEC_KEYS },
];

export const DEFAULT_SETTINGS_EGE = {
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
    ...allOn(DEC_LABELS),
    ...fsuDefaults(FSU_DEC_KEYS),
  },
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generateEgeBaseVariants(settings) {
  return generateOralSheet({ ...DEFAULT_SETTINGS_EGE, ...settings }, GENERATORS_EGE);
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useOralEgeBase() {
  const [title, setTitle]         = useState('Устный счёт: действия с десятичными');
  const [settings, setSettings]   = useState({ ...DEFAULT_SETTINGS_EGE });
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_EGE });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({
      ...p,
      categories: { ...p.categories, [cat]: checked },
    })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateEgeBaseVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Устный счёт: действия с десятичными');
    setSettings({ ...DEFAULT_SETTINGS_EGE });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
