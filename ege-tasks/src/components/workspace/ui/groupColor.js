/**
 * Цвет группы в разделе «Моё пространство».
 *
 * Сама логика (палитра, реестр явных цветов, хеш-фолбэк) живёт в
 * `shared/utils/groupColors.js` — её импортирует и API-слой, поэтому здесь
 * остался только реэкспорт для экранов раздела.
 */
export {
  GROUP_COLORS,
  GROUP_COLOR_LABELS,
  GROUP_TONES,
  TONE_HEX,
  autoGroupTone,
  clearGroupColors,
  groupHex,
  lessonHex,
  groupTone,
  isGroupColor,
  registerGroupColors,
} from '../../../shared/utils/groupColors';
