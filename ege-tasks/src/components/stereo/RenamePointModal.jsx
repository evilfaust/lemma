import { useEffect, useMemo, useState } from 'react';
import { Input, Modal } from 'antd';
import { renamePoint, normalizePointName, prettyName } from '../../utils/stereo';

/**
 * Переименование точки (и вершины тела). Проверка — на лету: той же
 * renamePoint, что и применение, поэтому окно и результат не разойдутся.
 */
export default function RenamePointModal({ name, scene, onApply, onClose }) {
  const [value, setValue] = useState('');
  useEffect(() => { setValue(name || ''); }, [name]);
  const target = normalizePointName(value);
  const check = useMemo(
    () => (name && target ? renamePoint(scene, name, target) : { error: 'Введите имя' }),
    [scene, name, target],
  );
  const apply = () => {
    if (check.error) return;
    onApply(check.scene, target);
  };
  return (
    <Modal
      title={name ? `Переименовать ${prettyName(name)}` : ''}
      open={!!name}
      onOk={apply}
      onCancel={onClose}
      okText="Переименовать"
      cancelText="Отмена"
      okButtonProps={{ disabled: !!check.error || target === name }}
      width={360}
      destroyOnHidden
    >
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPressEnter={apply}
        maxLength={4}
        placeholder="K, M1"
        status={check.error && value ? 'error' : undefined}
        aria-label="Новое имя точки"
        style={{ fontFamily: "'Times New Roman', serif", fontStyle: 'italic', fontSize: 20 }}
        onFocus={(e) => e.target.select()}
      />
      <div className={check.error && value ? 'stereo-cmd-error' : 'stereo-cmd-help'} style={{ marginTop: 6 }}>
        {check.error && value && target !== name
          ? check.error
          : target && target !== value.trim() ? `Будет: ${prettyName(target)}` : 'Латинская буква, можно с цифрами. Русская раскладка тоже подойдёт.'}
      </div>
    </Modal>
  );
}
