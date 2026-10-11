import { useState, useCallback } from 'react';
import { useApplySheet } from './useApplySheet';
import { generateByCategories } from '../utils/questionPlan';
import { buildPart2, PART2_GENERATORS, PART2_LABELS, PART2_GROUPS } from '../utils/trig/part2';

/**
 * Уравнения части 2 профиля ЕГЭ: а) решите уравнение, б) корни на отрезке
 * (v3.9.349). Модель и проверка — `utils/trig/part2.js`.
 */

export const CATEGORY_LABELS_TRIG_EGE = PART2_LABELS;
export const CATEGORY_GROUPS_TRIG_EGE = PART2_GROUPS;

export const DEFAULT_SETTINGS_TRIG_EGE = {
  variantsCount:  4,
  questionsCount: 4,
  withSegment:    true,      // пункт б): отбор корней на отрезке
  categories: {
    quad_sin: true, quad_cos: true, pythag: true, double_angle: true, reduction: false,
    sin2x: true, factor: false,
    homog1: false, homog2: true, tg_ctg: false,
  },
  categoryCounts: {},
  columnsCount:   1,
  showTeacherKey: true,
  fontSize:       's',
};

export function trigEgeInstruction(withSegment) {
  return withSegment
    ? 'а) Решите уравнение. б) Найдите все корни этого уравнения, принадлежащие отрезку.'
    : 'Решите уравнение:';
}

export function generateTrigEquationsEgeVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_TRIG_EGE, ...settings };
  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(PART2_GENERATORS[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: 150,
    make: (cat) => buildPart2(cat, { withSegment: s.withSegment }),
    uniqueKey: (q) => q.exprLatex,
  });
}

export function useTrigEquationsEge() {
  const [title, setTitle] = useState('Тригонометрические уравнения (ЕГЭ, часть 2)');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS_TRIG_EGE });
  const [tasksData, setTasksData] = useState(null);

  const applySheet = useApplySheet({
    setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_TRIG_EGE,
  });

  const updateSetting = useCallback((k, v) => setSettings(p => ({ ...p, [k]: v })), []);
  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({ ...p, categories: { ...p.categories, [cat]: checked } })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateTrigEquationsEgeVariants(s);
    if (!variants.length) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Тригонометрические уравнения (ЕГЭ, часть 2)');
    setSettings({ ...DEFAULT_SETTINGS_TRIG_EGE });
  }, []);

  return {
    title, setTitle, settings, updateSetting, updateCategory, tasksData, generate, reset,
    setTasksData, applySheet,
  };
}
