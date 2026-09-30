import { useEffect, useMemo, useState } from 'react';
import { Modal, Segmented, Tooltip } from 'antd';
import PlanimEditor from './PlanimEditor';
import { parsePlanimBlock } from '../../utils/planim/dsl';

/**
 * Планиметрический редактор в окне — для задач и теории.
 * initialSpec — текст блока ```planim на правку (без ограды) или null.
 * defaultFormat — 'block' (```planim) | 'inline' (`planim: …` в ячейку таблицы).
 * showFormat — показывать выбор вида (чертёж геометрической задачи — картинка, ему не нужно).
 * onApply({ scene, color, grid, size, format }) — вставить/обновить чертёж.
 */
export default function PlanimModal({
  open, onClose, initialSpec = null, onApply, applyLabel, defaultFormat = 'block', showFormat = true,
}) {
  const initial = useMemo(
    () => (open && initialSpec ? parsePlanimBlock(initialSpec) : null),
    [open, initialSpec],
  );
  const [format, setFormat] = useState(defaultFormat);
  useEffect(() => { if (open) setFormat(defaultFormat); }, [open, defaultFormat]);

  return (
    <Modal
      title={(
        <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {initialSpec ? 'Планиметрический чертёж — правка' : 'Планиметрический чертёж'}
          {showFormat && (
            <Tooltip title="«В строку» — компактный код `planim: …`, который можно вставлять прямо в ячейку markdown-таблицы. «Блоком» — картинка на отдельной строке.">
              <Segmented
                size="small"
                value={format}
                onChange={setFormat}
                options={[
                  { value: 'block', label: 'Отдельным блоком' },
                  { value: 'inline', label: 'В строку (для таблиц)' },
                ]}
              />
            </Tooltip>
          )}
        </span>
      )}
      open={open}
      onCancel={onClose}
      footer={null}
      width="min(1280px, 96vw)"
      style={{ top: 20 }}
      keyboard={false}
      maskClosable={false}
      destroyOnHidden
    >
      {open && (
        <PlanimEditor
          embedded
          initialScene={initial?.scene || null}
          initialColor={!!initial?.color}
          initialGrid={!!initial?.grid}
          applyLabel={applyLabel || (initialSpec ? 'Обновить чертёж' : 'Вставить чертёж')}
          onApply={(scene, { color, grid }) => onApply?.({
            scene, color, grid, size: initial?.size || null, format,
          })}
        />
      )}
    </Modal>
  );
}
