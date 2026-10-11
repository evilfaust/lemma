import { useState, useCallback } from 'react';
import { useApplySheet } from './useApplySheet';
import { generateByCategories } from '../utils/questionPlan';
import {
  BY_VALUE_GENERATORS, BY_VALUE_LABELS, BY_VALUE_GROUPS, BY_VALUE_EXAM,
} from '../utils/trig/byValue';

/**
 * «По значению и четверти» — вычисления и преобразования первой части
 * профиля ЕГЭ (v3.9.348). Логика и проверка ответа — `utils/trig/byValue.js`,
 * хук только склеивает её с состоянием листа.
 */

export const CATEGORY_LABELS_BY_VALUE = BY_VALUE_LABELS;
export const CATEGORY_GROUPS_BY_VALUE = BY_VALUE_GROUPS;
export const CATEGORY_EXAM_BY_VALUE = BY_VALUE_EXAM;

export const DEFAULT_SETTINGS_BY_VALUE = {
  variantsCount:  4,
  questionsCount: 8,
  categories: {
    identity_sc: true, identity_tg: true, identity_from_tg: false,
    double_cos: true, double_sin: false,
    reduction: true,
    homog: true, homog_sq: false,
    numeric: false,
  },
  categoryCounts: {},
  columnsCount:   1,
  showTeacherKey: true,
  fontSize:       's',
};

export const BY_VALUE_INSTRUCTION = 'Найдите значение выражения:';

export function generateTrigByValueVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_BY_VALUE, ...settings };
  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(BY_VALUE_GENERATORS[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: 120,
    make: (cat) => BY_VALUE_GENERATORS[cat](),
    uniqueKey: (q) => q.exprLatex,
  });
}

export function useTrigByValue() {
  const [title, setTitle] = useState('Вычисления по значению и четверти');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS_BY_VALUE });
  const [tasksData, setTasksData] = useState(null);

  const applySheet = useApplySheet({
    setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_BY_VALUE,
  });

  const updateSetting = useCallback((k, v) => setSettings(p => ({ ...p, [k]: v })), []);
  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({ ...p, categories: { ...p.categories, [cat]: checked } })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateTrigByValueVariants(s);
    if (!variants.length) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Вычисления по значению и четверти');
    setSettings({ ...DEFAULT_SETTINGS_BY_VALUE });
  }, []);

  return {
    title, setTitle, settings, updateSetting, updateCategory, tasksData, generate, reset,
    setTasksData, applySheet,
  };
}
