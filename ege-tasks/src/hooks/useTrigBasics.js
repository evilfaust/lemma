import { useState, useCallback } from 'react';
import { useApplySheet } from './useApplySheet';
import { generateByCategories } from '../utils/questionPlan';
import { BASICS_GENERATORS, BASICS_LABELS, BASICS_GROUPS } from '../utils/trig/basics';

/**
 * «Основы тригонометрии» (v3.9.351): радианная мера, знаки и четверти,
 * период, область значений. Логика — `utils/trig/basics.js`.
 */

export const CATEGORY_LABELS_TRIG_BASICS = BASICS_LABELS;
export const CATEGORY_GROUPS_TRIG_BASICS = BASICS_GROUPS;

export const DEFAULT_SETTINGS_TRIG_BASICS = {
  variantsCount:  4,
  questionsCount: 10,
  categories: {
    deg_to_rad: true, rad_to_deg: true,
    sign: true, quarter: false,
    period: false, range: false, extremum: false,
  },
  categoryCounts: {},
  columnsCount:   2,
  showTeacherKey: true,
  fontSize:       's',
};

export const BASICS_INSTRUCTION = 'Выполните задания:';

export function generateTrigBasicsVariants(settings) {
  const s = { ...DEFAULT_SETTINGS_TRIG_BASICS, ...settings };
  return generateByCategories({
    categories: s.categories,
    counts: s.categoryCounts,
    known: (k) => Boolean(BASICS_GENERATORS[k]),
    questionsCount: s.questionsCount,
    variantsCount: s.variantsCount,
    attempts: 80,
    make: (cat) => BASICS_GENERATORS[cat](),
    uniqueKey: (q) => q.exprLatex,
  });
}

export function useTrigBasics() {
  const [title, setTitle] = useState('Основы тригонометрии');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS_TRIG_BASICS });
  const [tasksData, setTasksData] = useState(null);

  const applySheet = useApplySheet({
    setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS_TRIG_BASICS,
  });

  const updateSetting = useCallback((k, v) => setSettings(p => ({ ...p, [k]: v })), []);
  const updateCategory = useCallback((cat, checked) =>
    setSettings(p => ({ ...p, categories: { ...p.categories, [cat]: checked } })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateTrigBasicsVariants(s);
    if (!variants.length) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Основы тригонометрии');
    setSettings({ ...DEFAULT_SETTINGS_TRIG_BASICS });
  }, []);

  return {
    title, setTitle, settings, updateSetting, updateCategory, tasksData, generate, reset,
    setTasksData, applySheet,
  };
}
