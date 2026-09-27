import { useMemo } from 'react';
import { Modal } from 'antd';
import StereoEditor from './StereoEditor';
import { parseStereoBlock } from '../../utils/stereo/dsl';

/**
 * Стереоредактор в окне — для задач и теории.
 * initialSpec — текст блока ```stereo на правку (без ограды) или null.
 * onApply({ scene, camera, color, size }) — вставить/обновить чертёж.
 */
export default function StereoModal({ open, onClose, initialSpec = null, onApply, applyLabel }) {
  const initial = useMemo(
    () => (open && initialSpec ? parseStereoBlock(initialSpec) : null),
    [open, initialSpec],
  );
  return (
    <Modal
      title={initialSpec ? 'Стереочертёж — правка' : 'Стереочертёж'}
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
          onApply={(scene, camera, { color }) => onApply?.({ scene, camera, color, size: initial?.size || null })}
        />
      )}
    </Modal>
  );
}
