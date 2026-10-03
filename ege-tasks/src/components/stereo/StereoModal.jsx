import { useEffect, useMemo, useState } from 'react';
import { Modal, Segmented, Tooltip } from 'antd';
import StereoEditor from './StereoEditor';
import { parseStereoBlock } from '../../utils/stereo/dsl';

/**
 * Стереоредактор в окне — для задач и теории.
 * initialSpec — текст блока ```stereo на правку (без ограды) или null.
 * defaultFormat — 'block' (```stereo) | 'inline' (`stereo: …` в ячейку таблицы).
 * showFormat — показывать выбор вида (чертёж геометрической задачи — картинка, ему не нужно).
 * onApply({ scene, camera, color, size, format, still }) — вставить/обновить чертёж
 *   (size и still — из правимого блока, чтобы правка их не теряла).
 */
export default function StereoModal({
  open, onClose, initialSpec = null, onApply, applyLabel, defaultFormat = 'block', showFormat = true,
}) {
  const initial = useMemo(
    () => (open && initialSpec ? parseStereoBlock(initialSpec) : null),
    [open, initialSpec],
  );
  const [format, setFormat] = useState(defaultFormat);
  useEffect(() => { if (open) setFormat(defaultFormat); }, [open, defaultFormat]);

  return (
    <Modal
      title={(
        <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {initialSpec ? 'Стереочертёж — правка' : 'Стереочертёж'}
          {showFormat && (
          <Tooltip title="«В строку» — компактный код `stereo: …`, который можно вставлять прямо в ячейку markdown-таблицы. «Блоком» — картинка на отдельной строке.">
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
        <StereoEditor
          embedded
          initialScene={initial?.scene || null}
          initialCamera={initial?.camera || null}
          initialColor={!!initial?.color}
          applyLabel={applyLabel || (initialSpec ? 'Обновить чертёж' : 'Вставить чертёж')}
          onApply={(scene, camera, { color }) => onApply?.({
            scene, camera, color, size: initial?.size || null, format, still: !!initial?.still,
          })}
        />
      )}
    </Modal>
  );
}
