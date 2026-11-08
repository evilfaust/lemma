import { decTex, niceDecimal, rat } from './linearExpr';

export const decimalWithComma = value => decTex(value).replace('{,}', ',');

export function probabilityTask(statement_md, favorable, total, model, maxDigits = 3) {
  const probability = rat(favorable, total);
  if (!niceDecimal(probability, maxDigits)) return null;
  return {
    statement_md,
    answer: decimalWithComma(probability),
    modelKey: JSON.stringify(model),
  };
}

export function roundedProbabilityTask(statement, numerator, denominator, model) {
  const rounded = Math.floor((100 * numerator + denominator / 2) / denominator);
  if (rounded === 0 || rounded === 100) return null;
  return probabilityTask(`${statement} Результат округлите до сотых.`, rounded, 100, model);
}

export function exactOrRounded(statement, numerator, denominator, model) {
  return probabilityTask(statement, numerator, denominator, model, 4)
    || roundedProbabilityTask(statement, numerator, denominator, model);
}
