/**
 * Сборка листа устного счёта из генераторов категорий `(level) => задание`.
 * Общая для разделов, переведённых на уровни: план типов, уровень, фильтр
 * «только целые/десятичные ответы» и защита от повторов — в одном месте.
 */
import { generateByCategories, byExpr } from '../questionPlan';
import { isFiniteDecimalAnswer } from '../oralAnswerFilter';
import { levelOf } from './levels';

export function generateOralSheet(settings, generators, { attempts = 80, accept = null } = {}) {
  const level = levelOf(settings);
  const decimalOnly = Boolean(settings.decimalOnly);
  return generateByCategories({
    categories: settings.categories,
    counts: settings.categoryCounts,
    known: (k) => Boolean(generators[k]),
    questionsCount: settings.questionsCount,
    variantsCount: settings.variantsCount,
    attempts: decimalOnly ? Math.max(attempts, 300) : attempts,
    uniqueKey: byExpr,
    make: (cat) => {
      let q;
      try { q = generators[cat](level); } catch { q = null; }
      if (!q) return null;
      if (decimalOnly && !isFiniteDecimalAnswer(q.resultLatex)) return null;
      if (accept && !accept(q)) return null;
      return { ...q, cat };
    },
  });
}

/** Все категории включены — дефолт раздела. */
export const allOn = (labels) => Object.fromEntries(Object.keys(labels).map(k => [k, true]));
