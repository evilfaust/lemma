import { Button, Tooltip, Segmented } from 'antd';
import {
  EditOutlined, SwapOutlined, PicLeftOutlined, PicCenterOutlined, PicRightOutlined,
} from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { KIM_IMAGE_SIZE_OPTIONS, DEFAULT_KIM_IMAGE_SIZE } from '../../utils/kimImageSize';
import { hasKimFigure, kimFigureLayout, kimSizeIsNatural } from './KimTaskContent';

// Место чертежа задачи в КИМ — в том порядке, в каком он встанет на листе.
export const KIM_PLACEMENT_OPTIONS = [
  { value: 'left', icon: <PicLeftOutlined />, title: 'Чертёж слева, текст обтекает' },
  { value: 'below', icon: <PicCenterOutlined />, title: 'Чертёж на своём месте в условии' },
  { value: 'right', icon: <PicRightOutlined />, title: 'Чертёж справа, текст обтекает' },
];

/** Переключатель размера чертежа КИМ (S/M/L/XL; у графика «не выбран» = как в условии). */
export function KimSizeSwitch({ task, onChange }) {
  if (!hasKimFigure(task)) return null;
  const natural = kimSizeIsNatural(task) && !task.kimImageSize;
  return (
    <Tooltip
      title={natural
        ? 'Размер чертежа в печати (КИМ). Не выбран — как задан в условии'
        : 'Размер чертежа в печати (КИМ)'}
    >
      <Segmented
        size="small"
        options={KIM_IMAGE_SIZE_OPTIONS}
        // null — ни одна кнопка не нажата: график «как в условии»
        value={task.kimImageSize || (kimSizeIsNatural(task) ? null : DEFAULT_KIM_IMAGE_SIZE)}
        onChange={onChange}
      />
    </Tooltip>
  );
}

/** Переключатель места чертежа КИМ: слева / на своём месте / справа. */
export function KimPlacementSwitch({ task, onChange }) {
  const imageUrl = task.has_image ? api.getTaskImageUrl(task) : null;
  const { placement } = kimFigureLayout(task, { answerTable: true, imageUrl });
  if (!placement) return null;
  return (
    <Tooltip title="Где чертёж в печати (КИМ): слева или справа с обтеканием текстом, либо на своём месте в условии">
      <Segmented size="small" options={KIM_PLACEMENT_OPTIONS} value={placement} onChange={onChange} />
    </Tooltip>
  );
}

/**
 * Панель задачи на странице буклета в режиме «Как в печати»: появляется по
 * наведению, в печать не идёт (`no-print`, absolute — высоту задачи не меняет).
 *
 * @param {Object} editing — { variantIndex, onSetImageSize, onSetFigurePlacement,
 *   onEditTask, onReplaceTask }; позиция задачи — `task.kimNumber - 1`.
 */
export default function KimTaskTools({ task, editing }) {
  const vi = editing.variantIndex;
  const ti = task.kimNumber - 1;
  return (
    <div className="kim-task-tools no-print">
      {editing.onSetImageSize && (
        <KimSizeSwitch task={task} onChange={(val) => editing.onSetImageSize(vi, ti, val)} />
      )}
      {editing.onSetFigurePlacement && (
        <KimPlacementSwitch task={task} onChange={(val) => editing.onSetFigurePlacement(vi, ti, val)} />
      )}
      {editing.onEditTask && (
        <Tooltip title="Редактировать задачу">
          <Button size="small" icon={<EditOutlined />} onClick={() => editing.onEditTask(task)} />
        </Tooltip>
      )}
      {editing.onReplaceTask && (
        <Tooltip title="Заменить задачу">
          <Button size="small" icon={<SwapOutlined />} onClick={() => editing.onReplaceTask(vi, ti, task)} />
        </Tooltip>
      )}
    </div>
  );
}
