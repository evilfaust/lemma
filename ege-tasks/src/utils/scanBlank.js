// Распознавание бланка ответов №1 — чистая логика, без сети и React.
//
// Двойное прочтение (v3.9.313): один и тот же снимок уходит в модель дважды
// параллельно. При сравнительном тесте 02.07.2026 gemini-2.5-flash читала бланк
// идеально в 3 прогонах из 4 — значит, расхождение двух прочтений точно
// указывает на поле, где модель могла ошибиться. Время не растёт (запросы
// параллельны), цена — второе копеечное обращение (<0,5 ₽ за бланк).

// Сравнение прочтений: «0.5» и «0,5», лишние пробелы и типографский минус —
// одно и то же; иначе каждый такой бланк подсвечивался бы зря.
export function normalizeRead(value) {
  return String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/\./g, ',')
    .toLowerCase();
}

const fieldOf = (res, n) => {
  const v = res?.fields?.[n] ?? res?.fields?.[String(n)];
  return typeof v === 'string' ? v.trim() : (v == null ? '' : String(v).trim());
};

const numbers = (list) => (Array.isArray(list) ? list : [])
  .map((n) => parseInt(n, 10))
  .filter(Number.isInteger);

/**
 * Свести одно или два прочтения в то, что увидит учитель.
 *
 * reads — ответы /scan-blank (`{ fields, replacements, uncertain }`); второе
 * может отсутствовать (запрос упал) — тогда работаем как раньше, по одному.
 *
 * Возвращает:
 *   answers      — { [номер]: строка } для полей 1..tasksCount
 *   uncertain    — номера, которые стоит сверить с фото (модель сомневалась
 *                  или прочтения разошлись), по возрастанию
 *   alternatives — { [номер]: строка } — что дало второе прочтение там, где
 *                  оно другое (пустое не предлагаем: «или пусто» — не ответ)
 *   replacements — записи зоны замены (первого прочтения, иначе второго)
 *   reads        — сколько прочтений удалось
 */
export function mergeScanReads(reads, tasksCount) {
  const ok = (reads || []).filter(Boolean);
  const [a, b] = ok;
  const answers = {};
  const alternatives = {};
  const uncertain = new Set([...numbers(a?.uncertain), ...numbers(b?.uncertain)]);

  for (let n = 1; n <= tasksCount; n++) {
    const first = fieldOf(a, n);
    const second = fieldOf(b, n);
    // Пустое первое прочтение при непустом втором — берём второе: пропуск
    // поля встречается чаще, чем выдуманный ответ в пустом.
    answers[n] = first || second;
    if (b && normalizeRead(first) !== normalizeRead(second)) {
      uncertain.add(n);
      const other = first ? second : '';
      if (other) alternatives[n] = other;
    }
  }

  const replacements = (a?.replacements?.length ? a.replacements : b?.replacements) || [];

  return {
    answers,
    uncertain: [...uncertain].filter((n) => n >= 1 && n <= tasksCount).sort((x, y) => x - y),
    alternatives,
    replacements,
    reads: ok.length,
  };
}
