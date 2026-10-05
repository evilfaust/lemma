import { useState, useCallback } from 'react';
import {
  fsuRootGenerators, FSU_ROOT_LABELS, FSU_ROOT_KEYS, fsuDefaults,
} from '../utils/shortMultiplication';
import { useApplySheet } from './useApplySheet';
import {
  POW_GENERATORS, POW_LABELS, POW_EXAM, POW_GROUPS,
} from '../utils/oral/powers';
import { generateOralSheet, allOn } from '../utils/oral/sheet';
import { DEFAULT_LEVEL } from '../utils/oral/levels';

// Генераторы категорий — параметрические, по уровням: `utils/oral/powers.js`
// (там же образцы заданий с «Решу» для уровня «Как на экзамене»).

// Раздел говорит корнями — ФСУ здесь убирает иррациональность:
// сопряжённые множители и свёртка квадрата дают рациональный ответ.
// Формулы уровня не знают — аргумент уровня им просто не нужен.
const FSU_GENERATORS_PR = fsuRootGenerators({ style: 'auto' });

const GENERATORS_PR = { ...POW_GENERATORS, ...FSU_GENERATORS_PR };

export const CATEGORY_LABELS_PR = { ...POW_LABELS, ...FSU_ROOT_LABELS };

export const CATEGORY_EXAM_PR = {
  ...POW_EXAM,
  fsuConjRoots: ['О8', 'Б16'],
};

export const CATEGORY_GROUPS_PR = [
  ...POW_GROUPS,
  { label: 'Формулы сокращённого умножения', keys: FSU_ROOT_KEYS },
];

export const DEFAULT_SETTINGS_PR = {
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
    ...allOn(POW_LABELS),
    ...fsuDefaults(FSU_ROOT_KEYS),
  },
};

// ─── Чистая функция генерации (для смешанных работ) ──────────────────────────
export function generatePowersRootsVariants(settings) {
  return generateOralSheet({ ...DEFAULT_SETTINGS_PR, ...settings }, GENERATORS_PR);
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useOralPowersRoots() {
  const [title, setTitle]         = useState('Устный счёт: степени и корни');
  const [settings, setSettings]   = useState({ ...DEFAULT_SETTINGS_PR });
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_PR });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({
      ...p,
      categories: { ...p.categories, [cat]: checked },
    })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generatePowersRootsVariants(s);
    if (variants.length === 0) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Устный счёт: степени и корни');
    setSettings({ ...DEFAULT_SETTINGS_PR });
  }, []);

  return {
    title, setTitle,
    settings, updateSetting, updateCategory,
    tasksData,
    generate, reset,
    setTasksData, applySheet,
  };
}
