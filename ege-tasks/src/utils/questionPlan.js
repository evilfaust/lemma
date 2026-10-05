/**
 * План заданий листа: какая категория стоит на каждой позиции.
 *
 * Все варианты строятся по одному плану, поэтому задание №5 во всех вариантах —
 * одного типа. Так лист можно раздать по рядам и разбирать у доски «по номерам»,
 * а учителю удобно проверять: столбец ответов однороден.
 */

/**
 * План: какая категория стоит на каждой позиции.
 *
 * `counts` — сколько заданий нужно от конкретных категорий («пропорций — 3»).
 * Категории без указанного числа делят остаток поровну. Порядок при этом
 * остаётся чередующимся, а не «сначала три пропорции подряд»: типы идут по
 * кругу, пока у каждого не кончится своя квота.
 */
export function categoryPlan(enabledCats, count, counts = {}) {
  if (!enabledCats.length) return [];

  const quota = {};
  let assigned = 0;
  for (const cat of enabledCats) {
    const n = Number(counts?.[cat]);
    if (Number.isFinite(n) && n > 0) {
      quota[cat] = Math.floor(n);
      assigned += quota[cat];
    }
  }

  const free = enabledCats.filter(cat => !(cat in quota));
  const rest = Math.max(0, count - assigned);
  free.forEach((cat, i) => {
    quota[cat] = Math.floor(rest / free.length) + (i < rest % free.length ? 1 : 0);
  });

  const plan = [];
  const left = { ...quota };
  const pool = enabledCats.filter(cat => left[cat] > 0);
  for (let i = 0; pool.some(cat => left[cat] > 0); i++) {
    const cat = pool[i % pool.length];
    if (left[cat] > 0) {
      plan.push(cat);
      left[cat] -= 1;
    }
  }
  return plan;
}

/** Сколько заданий даст такой набор настроек — для подписи в панели. */
export function plannedTotal(categories, questionsCount, counts) {
  const enabled = Object.entries(categories || {}).filter(([, v]) => v).map(([k]) => k);
  return categoryPlan(enabled, questionsCount, counts).length;
}

/**
 * Строит варианты по плану: на каждой позиции — задание своей категории.
 *
 * `make(cat)` возвращает готовое задание или null, если случайные числа не
 * подошли (некрасивый корень и т.п.) — тогда пробуем ещё. Если категория так и
 * не дала задания, позиция заполняется любой другой доступной, чтобы вариант
 * не оказался короче остальных.
 *
 * `uniqueKey(q)` — по какому признаку задания считаются одинаковыми (обычно
 * `exprLatex`). С ним генератор сначала ищет задание, которого ещё нет на всём
 * листе, затем — которого нет в этом варианте, и только когда категория
 * исчерпана (квота больше, чем она умеет разных заданий), берёт повтор.
 * Без ключа — прежнее поведение: первое подошедшее задание.
 */
export function buildVariantsByPlan({
  plan,
  variantsCount,
  make,
  attempts = 80,
  fallbackCats = [],
  uniqueKey = null,
}) {
  if (!plan.length) return [];

  const usedOnSheet = new Set();

  const tryCat = (cat, limit, usedInVariant) => {
    let notInVariant = null;   // повтор из соседнего варианта — терпимо
    let any = null;            // повтор внутри варианта — крайний случай
    for (let i = 0; i < limit; i++) {
      const q = make(cat);
      if (!q) continue;
      const key = uniqueKey ? uniqueKey(q) : null;
      if (key == null || !usedOnSheet.has(key)) return q;
      if (!notInVariant && !usedInVariant.has(key)) notInVariant = q;
      if (!any) any = q;
    }
    return notInVariant || any;
  };

  return Array.from({ length: variantsCount }, () => {
    const questions = [];
    const usedInVariant = new Set();
    for (const cat of plan) {
      let q = tryCat(cat, attempts, usedInVariant);
      if (!q) {
        for (const alt of fallbackCats) {
          if (alt === cat) continue;
          q = tryCat(alt, 20, usedInVariant);
          if (q) break;
        }
      }
      if (q) {
        questions.push(q);
        const key = uniqueKey ? uniqueKey(q) : null;
        if (key != null) {
          usedOnSheet.add(key);
          usedInVariant.add(key);
        }
      }
    }
    return questions;
  });
}

/**
 * Обёртка для генераторов: план из включённых категорий + сборка вариантов.
 * `make(cat)` — как выше.
 */
export function generateByCategories({
  categories,
  counts,          // сколько заданий от конкретных категорий; остальные делят остаток
  known,
  questionsCount,
  variantsCount,
  make,
  attempts,
  uniqueKey,       // признак одинаковых заданий — см. buildVariantsByPlan
}) {
  const enabledCats = Object.entries(categories || {})
    .filter(([, v]) => v)
    .map(([k]) => k)
    .filter(k => !known || known(k));

  if (enabledCats.length === 0) return [];

  return buildVariantsByPlan({
    plan: categoryPlan(enabledCats, questionsCount, counts),
    variantsCount,
    make,
    attempts,
    fallbackCats: enabledCats,
    uniqueKey,
  });
}

/** Ключ одинаковости для листов «формула → ответ»: само выражение. */
export const byExpr = (q) => q?.exprLatex ?? null;
