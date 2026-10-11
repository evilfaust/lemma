import { useState, useCallback } from 'react';
import { useApplySheet } from './useApplySheet';
import { generateByCategories } from '../utils/questionPlan';
import { INEQ_GENERATORS, INEQ_LABELS, INEQ_GROUPS } from '../utils/trig/inequalities';

/**
 * Тригонометрические неравенства (v3.9.350). Модель, запись ответа и
 * проверка по напечатанному неравенству — `utils/trig/inequalities.js`.
 */

export const CATEGORY_LABELS_TRIG_INEQ = INEQ_LABELS;
export const CATEGORY_GROUPS_TRIG_INEQ = INEQ_GROUPS;

export const DEFAULT_SETTINGS_TRIG_INEQ = {
  variantsCount:  4,
  questionsCount: 6,
  answerForm:     'inequality',    // 'inequality' — «π/6 + 2πn < x < …», 'interval' — «x ∈ (…; …)»
  categories: {
    sin_basic: true, cos_basic: true, tan_basic: true,
    coef: true, arg_k: false, arg_shift: false, special: false,
  },
  categoryCounts: {},
  columnsCount:   1,
  showTeacherKey: true,
  fontSize:       's',
};

export function generateTrigInequalitiesVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_TRIG_INEQ, ...settings };
  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(INEQ_GENERATORS[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: 80,
    make: (cat) => INEQ_GENERATORS[cat](s.answerForm),
    uniqueKey: (q) => q.exprLatex,
  });
}

export function useTrigInequalities() {
  const [title, setTitle] = useState('Тригонометрические неравенства');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS_TRIG_INEQ });
  const [tasksData, setTasksData] = useState(null);

  const applySheet = useApplySheet({
    setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_TRIG_INEQ,
  });

  const updateSetting = useCallback((k, v) => setSettings(p => ({ ...p, [k]: v })), []);
  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({ ...p, categories: { ...p.categories, [cat]: checked } })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateTrigInequalitiesVariants(s);
    if (!variants.length) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Тригонометрические неравенства');
    setSettings({ ...DEFAULT_SETTINGS_TRIG_INEQ });
  }, []);

  return {
    title, setTitle, settings, updateSetting, updateCategory, tasksData, generate, reset,
    setTasksData, applySheet,
  };
}
