import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Input, Modal } from 'antd';
import {
  renamePoint, normalizePointName, prettyName, setHidden, setLabelAngle,
} from '../../utils/planim';

/**
 * Точка: имя, «скрыть», место буквы. Проверка имени — на лету той же
 * renamePoint, что и применение, поэтому окно и результат не разойдутся.
 */
export default function PlanimPointModal({ name, scene, onApply, onClose }) {
  const [value, setValue] = useState('');
  const [hidden, setHiddenFlag] = useState(false);
  useEffect(() => {
    setValue(name || '');
    setHiddenFlag(!!name && (scene?.hidden || []).includes(name));
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps
  const target = normalizePointName(value);
  const check = useMemo(
    () => (name && target ? renamePoint(scene, name, target) : { error: 'Введите имя' }),
    [scene, name, target],
  );
  const hasManualLabel = !!name && scene?.labelAngles?.[name] != null;
  const apply = () => {
    if (check.error) return;
    onApply(setHidden(check.scene, [target], hidden));
  };
  return (
    <Modal
      title={name ? `Точка ${prettyName(name)}` : ''}
      open={!!name}
      onOk={apply}
      onCancel={onClose}
      okText="Готово"
      cancelText="Отмена"
      okButtonProps={{ disabled: !!check.error }}
      width={380}
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
        aria-label="Имя точки"
        style={{ fontFamily: "'Times New Roman', serif", fontStyle: 'italic', fontSize: 20 }}
        onFocus={(e) => e.target.select()}
      />
      <div className={check.error && value ? 'stereo-cmd-error' : 'stereo-cmd-help'} style={{ marginTop: 6 }}>
        {check.error && value && target !== name
          ? check.error
          : target && target !== value.trim() ? `Будет: ${prettyName(target)}` : 'Латинская буква, можно с цифрами. Русская раскладка тоже подойдёт.'}
      </div>
      <Checkbox
        checked={hidden}
        onChange={(e) => setHiddenFlag(e.target.checked)}
        style={{ marginTop: 12 }}
      >
        Скрыть точку (не рисовать её и букву; построения остаются)
      </Checkbox>
      {hasManualLabel && (
        <div style={{ marginTop: 8 }}>
          <Button size="small" onClick={() => onApply(setLabelAngle(scene, name, null))}>
            Вернуть букве место по умолчанию
          </Button>
        </div>
      )}
    </Modal>
  );
}
