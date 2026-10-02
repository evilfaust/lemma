import { useEffect, useState } from 'react';
import { Button, Input, Modal, Space } from 'antd';
import { formatMarkText } from '../../utils/planim';

const KIND_TITLE = {
  text: 'Надпись',
  measure: 'Подпись отрезка',
  angle: 'Подпись угла',
};

const QUICK = ['°', 'α', 'β', 'γ', 'φ', '√', '∥', '⊥', '?'];

/**
 * Подпись на чертеже: новая надпись или правка готовой (надпись, «длина»,
 * подпись угла).
 *
 * @param target — { kind: 'text'|'measure'|'angle', text, create?, moved? } или null
 * @param onApply — (text) => void; пустой текст значит «убрать подпись»
 * @param onDelete — убрать шаг целиком (у правки)
 * @param onReset — вернуть подписи место по умолчанию (у «длины» и угла, сдвинутых мышью)
 */
export default function PlanimMarkTextModal({
  target, onApply, onDelete, onReset, onClose,
}) {
  const [value, setValue] = useState('');
  useEffect(() => { setValue(target?.text || ''); }, [target]);

  const kind = target?.kind || 'text';
  const create = !!target?.create;
  const preview = formatMarkText(value);
  // Пустая подпись у угла — просто дуга без текста; у надписи и «длины» —
  // такого шага нет, поэтому пустое поле при правке означает «удалить».
  const emptyRemoves = !create && kind !== 'angle';
  const apply = () => {
    if (create && !value.trim()) return;
    onApply(value);
  };

  return (
    <Modal
      title={create ? 'Новая надпись' : KIND_TITLE[kind]}
      open={!!target}
      onOk={apply}
      onCancel={onClose}
      okText={create ? 'Поставить' : 'Готово'}
      cancelText="Отмена"
      okButtonProps={{ disabled: create && !value.trim() }}
      width={420}
      destroyOnHidden
      footer={(_, { OkBtn, CancelBtn }) => (
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            {!create && onDelete && <Button danger onClick={onDelete}>Удалить</Button>}
            {!create && target?.moved && onReset && (
              <Button onClick={onReset}>Место по умолчанию</Button>
            )}
          </Space>
          <Space>
            <CancelBtn />
            <OkBtn />
          </Space>
        </Space>
      )}
    >
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onPressEnter={apply}
        maxLength={40}
        placeholder={kind === 'angle' ? '60, α, ?' : '6, x, sqrt(3), 60°, a ∥ b'}
        aria-label="Текст подписи"
        style={{ fontFamily: "'Times New Roman', serif", fontSize: 18 }}
        onFocus={(e) => e.target.select()}
      />
      <Space size={4} wrap style={{ marginTop: 8 }}>
        {QUICK.map((ch) => (
          <Button key={ch} size="small" onClick={() => setValue((v) => `${v}${ch}`)}>{ch}</Button>
        ))}
      </Space>
      <div className="stereo-cmd-help" style={{ marginTop: 8 }}>
        {value.trim()
          ? <>На чертеже: <b style={{ fontFamily: "'Times New Roman', serif", fontSize: 16 }}>{preview}</b></>
          : emptyRemoves
            ? 'Пустая подпись — шаг удалится'
            : '«sqrt(3)» станет √3, «альфа» — α; число у угла получит знак градуса.'}
      </div>
      <div className="stereo-cmd-help" style={{ marginTop: 4 }}>
        Подпись на чертеже можно перетащить мышью.
      </div>
    </Modal>
  );
}
