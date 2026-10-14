/**
 * Шапка печатного листа ТДФ (бланк опроса, конспект, ключ): тексты по
 * умолчанию и правки учителя.
 *
 * Правка хранится только для полей, которые учитель поменял: текст, совпавший
 * с умолчанием, правкой не считается — тогда шапка дальше следит за набором
 * (переименовали набор, включили колонку «чертёж» — подпись обновится сама).
 * Пустая строка — осознанное решение «эту строку не печатать».
 *
 * Строка варианта своя у каждого номера (`variants[n]`): «Вариант А» в первом
 * варианте не должен переименовать второй.
 */

export const HEAD_FIELDS = ['kind', 'title', 'variant', 'fioLabel', 'dateLabel', 'note'];

const KIND_BY_MODE = { blank: 'Устный опрос', key: 'Ключ учителя', etalon: 'Эталонный конспект' };

/** Тексты шапки по умолчанию — ровно то, что лист печатал до правок. */
export function defaultSheetHead({ mode, tdfSet, variantNumber, variantTitle, columns = {} }) {
  const isBlank = mode === 'blank';
  const what = [
    columns.formulation && 'формулировка',
    columns.drawing && 'чертёж',
    columns.notation && 'краткая запись',
  ].filter(Boolean).join(', ');
  return {
    kind: KIND_BY_MODE[mode] || KIND_BY_MODE.etalon,
    title: `${tdfSet?.title || ''}${tdfSet?.class_number ? ` · ${tdfSet.class_number} класс` : ''}`,
    variant: `Вариант ${variantNumber ?? ''}${variantTitle ? ` — ${variantTitle}` : ''}`.trim(),
    fioLabel: 'Фамилия, имя',
    dateLabel: 'Дата',
    note: isBlank ? `Заполните таблицу по памяти: ${what}.` : '',
  };
}

function overrideOf(overrides, field, variantNumber) {
  if (!overrides) return undefined;
  if (field === 'variant') return overrides.variants?.[String(variantNumber)];
  return overrides[field];
}

/** Итоговые тексты: правка учителя поверх умолчаний. */
export function resolveSheetHead(defaults, overrides, variantNumber) {
  const out = {};
  for (const f of HEAD_FIELDS) {
    const o = overrideOf(overrides, f, variantNumber);
    out[f] = typeof o === 'string' ? o : defaults[f];
  }
  return out;
}

/** Поле правлено учителем (для подсказки «изменено» и сброса). */
export function isHeadFieldEdited(overrides, field, variantNumber) {
  return typeof overrideOf(overrides, field, variantNumber) === 'string';
}

/**
 * Новая правка поля. Текст, совпавший с умолчанием, правку снимает;
 * пробелы по краям и переводы строк в однострочных полях срезаются.
 */
export function patchSheetHead(overrides, field, value, defaults, variantNumber) {
  const next = { ...(overrides || {}), variants: { ...(overrides?.variants || {}) } };
  let text = String(value ?? '');
  text = field === 'note' ? text.trim() : text.replace(/\s+/g, ' ').trim();
  const same = text === (defaults[field] || '').trim();
  if (field === 'variant') {
    const key = String(variantNumber);
    if (same) delete next.variants[key];
    else next.variants[key] = text;
  } else if (same) {
    delete next[field];
  } else {
    next[field] = text;
  }
  if (!Object.keys(next.variants).length) delete next.variants;
  return next;
}

/** Есть ли что сбрасывать. */
export function hasHeadOverrides(overrides) {
  if (!overrides) return false;
  return HEAD_FIELDS.some(f => f !== 'variant' && typeof overrides[f] === 'string')
    || Object.keys(overrides.variants || {}).length > 0;
}

/** Сброс всей шапки листа (строки вариантов — только текущего). */
export function resetSheetHead(overrides, variantNumber) {
  const variants = { ...(overrides?.variants || {}) };
  delete variants[String(variantNumber)];
  return Object.keys(variants).length ? { variants } : {};
}

/* ── Хранение: по набору и виду листа ─────────────────────────────────────── */

const keyOf = (setId, mode) => `tdf.sheetHead.${setId || 'none'}.${mode}`;

export function readSheetHead(setId, mode) {
  try {
    const raw = localStorage.getItem(keyOf(setId, mode));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function writeSheetHead(setId, mode, overrides) {
  try {
    if (hasHeadOverrides(overrides)) localStorage.setItem(keyOf(setId, mode), JSON.stringify(overrides));
    else localStorage.removeItem(keyOf(setId, mode));
  } catch { /* приватное окно — правка живёт до перезагрузки */ }
}
