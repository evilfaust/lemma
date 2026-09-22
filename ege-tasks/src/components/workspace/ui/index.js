/** Барель UI-слоя раздела «Моё пространство». */
import './workspace-ui.css';

export { default as WorkspacePageHeader } from './WorkspacePageHeader';
export { default as EmptyState } from './EmptyState';
export { default as SectionCard } from './SectionCard';
export { default as GroupColorPicker } from './GroupColorPicker';
export { Chip, GroupChip, LessonStatusChip, SubmitChip } from './Chip';
export {
  groupTone, groupHex, lessonHex, autoGroupTone, isGroupColor, registerGroupColors,
  GROUP_TONES, GROUP_COLORS, GROUP_COLOR_LABELS, TONE_HEX,
} from './groupColor';
