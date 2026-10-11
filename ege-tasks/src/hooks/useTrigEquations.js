import { useState, useCallback } from 'react';
import { useApplySheet } from './useApplySheet';
import { simpleEquation } from '../utils/trig/equations';
import { valuesFor } from '../utils/trig/angles';

/**
 * Простейшие уравнения f(t) = a. Серии корней считает ядро
 * `utils/trig/equations.js` и проверяет подстановкой — таблицы ответов,
 * набранной руками, больше нет. С v3.9.347 ещё нетабличные значения
 * (t = (−1)^n arcsin 1/3 + πn) и уравнения без корней (|a| > 1).
 * Соглашение arcctg(−a) = π − arcctg a: ctg t = −1 → t = 3π/4 + πn.
 */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Настройки по умолчанию ───────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  variantsCount:  4,
  questionsCount: 6,
  useSin:         true,
  useCos:         true,
  useTan:         false,
  useCot:         false,
  useNonTable:    false,   // a = 1/3: ответ через arcsin
  useNoRoots:     false,   // |a| > 1
  showTeacherKey: true,
  twoPerPage:     false,
  showWorkSpace:  false,
  workSpaceSize:  30,
};

/**
 * Квоты делятся поровну между включёнными функциями; табличные значения
 * каждой функции идут по кругу перемешанной колодой — повторов нет ни внутри
 * варианта, ни между вариантами, пока хватает значений. Нетабличные и «без
 * корней» подмешиваются долей (по одному-два на вариант).
 */
export function generateTrigEquationsVariants(settings) {
  const s = { ...DEFAULT_SETTINGS, ...settings };
  const fns = [
    s.useSin && 'sin', s.useCos && 'cos',
    s.useTan && 'tan', s.useCot && 'cot',
  ].filter(Boolean);
  if (fns.length === 0) return [];

  const { variantsCount, questionsCount } = s;
  const base = Math.floor(questionsCount / fns.length);
  const quotas = fns.map((_, i) => base + (i < questionsCount % fns.length ? 1 : 0));

  const decks = Object.fromEntries(fns.map(fn => [fn, { cards: [], at: 0 }]));
  const nextTable = (fn) => {
    const d = decks[fn];
    if (d.at >= d.cards.length) { d.cards = shuffle(valuesFor(fn)); d.at = 0; }
    return d.cards[d.at++];
  };

  const extraKinds = [s.useNonTable && 'nontable', s.useNoRoots && 'noroots'].filter(Boolean);
  const seen = new Set();

  return Array.from({ length: variantsCount }, () => {
    const tasks = [];
    const inVariant = new Set();
    // сколько «особых» заданий в варианте: треть, но хотя бы одно
    const extraCount = extraKinds.length ? Math.max(1, Math.round(questionsCount / 3)) : 0;
    const slots = shuffle(fns.flatMap((fn, i) => Array(quotas[i]).fill(fn)));
    slots.forEach((fn, idx) => {
      let kind = idx < extraCount ? extraKinds[idx % extraKinds.length] : 'table';
      if (kind === 'noroots' && (fn === 'tan' || fn === 'cot')) kind = 'nontable';
      if (kind === 'nontable' && !s.useNonTable) kind = 'table';
      let q = null;
      for (let t = 0; t < 30 && !q; t++) {
        const cand = kind === 'table' ? simpleEquation(fn, 'table', nextTable(fn)) : simpleEquation(fn, kind);
        if (!cand) continue;
        if (inVariant.has(cand.exprLatex)) continue;
        if (seen.has(cand.exprLatex) && t < 20) continue;
        q = cand;
      }
      if (q) { tasks.push(q); inVariant.add(q.exprLatex); seen.add(q.exprLatex); }
    });
    return shuffle(tasks);
  });
}

// ─── Хук ──────────────────────────────────────────────────────────────────────
export function useTrigEquations() {
  const [title, setTitle] = useState('Простейшие тригонометрические уравнения');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [tasksData, setTasksData] = useState(null);

  // Загрузка сохранённого листа (generator_sheets) и правка заданий на месте
  const applySheet = useApplySheet({ setTitle, setSettings, setTasksData, defaults: DEFAULT_SETTINGS });

  const updateSetting = useCallback((k, v) =>
    setSettings(p => ({ ...p, [k]: v })), []);

  const generate = useCallback((override) => {
    const s = override ? { ...settings, ...override } : settings;
    const variants = generateTrigEquationsVariants(s);
    if (!variants.length) return;
    setTasksData(variants);
  }, [settings]);

  const reset = useCallback(() => {
    setTasksData(null);
    setTitle('Простейшие тригонометрические уравнения');
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  return {
    title, setTitle, settings, updateSetting, tasksData, generate, reset,
    setTasksData, applySheet,
  };
}
