// Распознавание фото бланков ответов №1 — чистая логика ручек /scan-blank и
// /scan-task-list (pdf-service.js): какие модели спрашивать, промпт, разбор
// ответа модели. Без сети и Express — под тестом
// ege-tasks/src/__tests__/scanBlankServer.test.js.
//
// Модели выбраны сравнением на 16 живых бланках 22.10.2026 (эталон — ответы,
// сохранённые учителем после проверки). Одна модель, прочитавшая бланк дважды,
// повторяет свои ошибки: оба прочтения совпали — поле не подсвечено, а ответ
// неверен (у gemini-3.5-flash-lite ×2 так терялось 0,31 балла на бланк). Две
// РАЗНЫЕ модели ошибаются в разных местах: claude-haiku-5-5 + gemini-3.5-flash-lite
// не пропустили ни одной ошибки, меняющей балл, за ту же цену (~0,2 ₽ за бланк).
// Первой стоит более точная — её ответ клиент показывает по умолчанию.

export const DEFAULT_SCAN_MODELS = ['anthropic/claude-haiku-5-5', 'gemini/gemini-3.5-flash-lite'];
// Запасная — если Timeweb снимет модель (gemini-2.5-flash отключили в октябре
// 2026 молча: ручка отвечала 502, пока это не заметили).
export const DEFAULT_SCAN_FALLBACK = ['gemini/gemini-4-argon'];

const splitList = (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean);

/**
 * Модели из окружения: SCAN_BLANK_MODELS (через запятую), старое одиночное
 * SCAN_BLANK_MODEL, запасные — SCAN_BLANK_FALLBACK.
 */
export function scanModels(env = {}) {
  const models = splitList(env.SCAN_BLANK_MODELS);
  const single = splitList(env.SCAN_BLANK_MODEL);
  const fallback = splitList(env.SCAN_BLANK_FALLBACK);
  return {
    models: models.length ? models : single.length ? single : DEFAULT_SCAN_MODELS,
    fallback: fallback.length ? fallback : DEFAULT_SCAN_FALLBACK,
  };
}

/**
 * Очередь моделей для прочтения номер `slot`: своя модель, затем остальные
 * основные, затем запасные — без повторов. Клиент читает бланк дважды
 * (slot 0 и 1), поэтому прочтения делают разные модели.
 */
export function modelsForSlot({ models, fallback }, slot = 0) {
  const n = Number.isInteger(slot) && slot >= 0 ? slot % models.length : 0;
  return [...new Set([models[n], ...models, ...fallback])];
}

/** Ответ шлюза, после которого стоит спросить следующую модель. */
export function shouldTryNext(status) {
  // 402/403/404/410 — модель снята или недоступна ключу, 408/429/5xx — сбой
  // шлюза или модели. 400/401/413 — беда в самом запросе: другая модель не поможет.
  return [402, 403, 404, 408, 410, 429].includes(status) || status >= 500;
}

export const SCAN_BLANK_PROMPT = (tasksCount) => `На фото — бланк ответов №1 ЕГЭ, заполненный от руки.

СТРУКТУРА БЛАНКА:
- Основная зона «Результаты выполнения заданий с КРАТКИМ ответом»: поля 1–40 в две колонки. СЛЕВА поля 1–20, СПРАВА поля 21–40. Номер поля напечатан слева от клеток. В каждом поле ответ записан по одному символу в клетке (цифры, минус, запятая).
- Внизу отдельная зона «Замена ошибочных ответов»: строки вида [2 клетки с номером задания] - [клетки с новым ответом]. Печатный дефис между номером задания и ответом — разделитель, напечатанный на бланке, он НЕ минус ответа. Минус ответа, если есть, написан от руки в первой клетке самого ответа.
- Если в зоне замены есть запись для задания N — новый ответ ЗАМЕНЯЕТ содержимое поля N.
${tasksCount ? `- В этом варианте ${tasksCount} заданий: заполненными могут быть только поля 1–${tasksCount}. Записи, похожие на ответы вне этих полей, не выдумывай.` : ''}

Верни СТРОГО JSON без пояснений и без markdown-ограждений:
{"fields":{"<номер>":"<ответ>"},"replacements":[{"task":<номер>,"value":"<ответ>"}],"uncertain":[<номера полей, в прочтении которых сомневаешься>]}

Правила: только непустые поля; в fields — то, что написано в основной зоне (замены НЕ применяй, их верни отдельно в replacements); десятичный разделитель — запятая; минус — обычный дефис; символы без пробелов.`;

// Крестик или прочерк в поле — ученик пропустил задание. Модели честно
// переписывают «X», учитель же вносит пустое поле.
const NO_ANSWER = /^(?:[xх×]|[-−–—]+)$/i;

/** Значение поля как в бланке: без пробелов, минус — дефис, запятая; «X»/прочерк → ''. */
export function normalizeScanValue(value) {
  const s = String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/\./g, ',');
  return NO_ANSWER.test(s) ? '' : s;
}

/** JSON из ответа модели: снимает ```json-ограждение, иначе ищет первый {...}. */
export function extractJson(raw) {
  const text = String(raw ?? '').trim();
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch { return null; }
  }
}

/**
 * Ответ модели → { fields, replacements, uncertain }. Поля вне 1..tasksCount
 * отбрасываются, замены применяются к fields (в replacements — что было в зоне
 * замены). null — модель ответила не JSON.
 */
export function parseScanReply(raw, tasksCount) {
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const max = Number.isInteger(tasksCount) && tasksCount > 0 ? tasksCount : 40;
  const inRange = (n) => Number.isInteger(n) && n >= 1 && n <= max;

  const fields = {};
  for (const [k, v] of Object.entries(parsed.fields || {})) {
    const n = parseInt(k, 10);
    const value = normalizeScanValue(v);
    if (inRange(n) && value) fields[n] = value;
  }
  const replacements = (Array.isArray(parsed.replacements) ? parsed.replacements : [])
    .map(r => ({ task: parseInt(r?.task, 10), value: normalizeScanValue(r?.value) }))
    .filter(r => inRange(r.task) && r.value);
  for (const r of replacements) fields[r.task] = r.value;
  const uncertain = [...new Set((Array.isArray(parsed.uncertain) ? parsed.uncertain : [])
    .map(n => parseInt(n, 10)).filter(inRange))];

  return { fields, replacements, uncertain };
}
