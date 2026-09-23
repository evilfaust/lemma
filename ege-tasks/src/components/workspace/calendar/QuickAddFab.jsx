import { useState } from 'react';
import { Drawer } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import './mobile.css';

/**
 * Плавающая кнопка «+» для телефона: тап открывает шторку с крупными
 * пунктами (урок, дело, мысль…). actions: [{ key, label, hint, icon, onClick }].
 */
export default function QuickAddFab({ actions }) {
  const [open, setOpen] = useState(false);
  if (!actions?.length) return null;
  return (
    <>
      <button type="button" className="qa-fab" aria-label="Добавить" onClick={() => setOpen(true)}>
        <PlusOutlined />
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        placement="bottom"
        height="auto"
        closable={false}
        rootClassName="lesson-sheet lesson-sheet--mobile"
        styles={{ body: { padding: '8px 12px 16px' } }}
      >
        <div className="ls-grab" onClick={() => setOpen(false)} role="presentation" />
        <div className="qa-list">
          {actions.map((a) => (
            <button type="button" key={a.key} className="qa-item"
              onClick={() => { setOpen(false); a.onClick(); }}>
              <span className="qa-item__icon" style={{ color: a.color, background: a.soft }}>{a.icon}</span>
              <span className="qa-item__text">
                <span className="qa-item__label">{a.label}</span>
                {a.hint && <span className="qa-item__hint">{a.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      </Drawer>
    </>
  );
}
