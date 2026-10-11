import { useState, useCallback } from 'react';
import { useApplySheet } from './useApplySheet';
import { generateByCategories } from '../utils/questionPlan';
import { ADV_GENERATORS, ADV_LABELS, ADV_GROUPS } from '../utils/trig/equations';

/**
 * Уравнения f(kx + b) = a. До v3.9.347 задания и ответы были набраны руками
 * (85 + 21 строка таблицы) — 16 ответов оказались неверными. Теперь задание
 * строит модель (`utils/trig/equations.js`): серии корней считаются точно в
 * долях π и проверяются подстановкой в напечатанное уравнение.
 */

export const CATEGORY_LABELS_TRIG_ADV = ADV_LABELS;
export const CATEGORY_GROUPS_TRIG_ADV = ADV_GROUPS;

export const DEFAULT_SETTINGS = {
  variantsCount:  4,
  questionsCount: 6,
  categories: {
    sin_k: true, cos_k: true, tan_k: true,
    sin_shift: true, cos_shift: true, tan_shift: false,
    coef_sin: false, coef_cos: false, coef_tan: false,
    special: false, noroots: false,
    part1_neg: false, part1_pos: false,
  },
  categoryCounts: {},
  columnsCount:   1,
  showTeacherKey: true,
  fontSize:       's',
};

/** Строка над заданиями: у листа только из «одного корня» — своя */
export function trigAdvInstruction(categories = {}) {
  const on = Object.keys(categories).filter(k => categories[k]);
  if (on.length && on.every(k => k.startsWith('part1'))) return 'Найдите корень уравнения:';
  return 'Решите уравнение:';
}

// ─── Чистая функция генерации (для смешанных работ и сохранённых листов) ─────
export function generateTrigEquationsAdvancedVariants(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  // Листы до v3.9.347: два флажка вместо категорий
  let categories = s.categories;
  if (!settings?.categories && (settings?.useType1 !== undefined || settings?.useType2 !== undefined)) {
    categories = {
      sin_k: !!settings.useType1, cos_k: !!settings.useType1, tan_k: !!settings.useType1,
      coef_sin: !!settings.useType2, coef_cos: !!settings.useType2, coef_tan: !!settings.useType2,
    };
  }
  return generateByCategories({
    categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(ADV_GENERATORS[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: 80,
    make: (cat) => ADV_GENERATORS[cat](),
    uniqueKey: (q) => q.exprLatex,
  });
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useTrigEquationsAdvanced() {
  const [title, setTitle] = useState('Тригонометрические уравнения f(kx + b) = a');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({ ...p, categories: { ...p.categories, [cat]: checked } })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateTrigEquationsAdvancedVariants(s);
    if (!variants.length) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Тригонометрические уравнения f(kx + b) = a');
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return {
    title, setTitle, settings, updateSetting, updateCategory, tasksData, generate, reset,
    setTasksData, applySheet,
  };
}
