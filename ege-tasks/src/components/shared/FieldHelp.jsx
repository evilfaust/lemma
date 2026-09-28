import { useState } from 'react';
import { Button, Modal, Tabs, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import MathRenderer from '../../shared/components/MathRenderer';
import { FIELD_HELP, FIELD_TIPS } from '../../utils/fieldHelp';
import './fieldHelp.css';

/**
 * Кнопка «?» у панели вставки: справка по полю (формулы, таблицы, числовая
 * прямая, график, клетка, стерео). Текст — utils/fieldHelp.js; пример
 * показан кодом и живым превью, «Вставить» кладёт его в поле по курсору.
 * @param onInsert — (markdown) => void; без него примеры только показываются
 */
export default function FieldHelp({ onInsert, label = null }) {
  const [open, setOpen] = useState(false);

  const items = [
    ...FIELD_HELP.map((sec) => ({
      key: sec.key,
      label: sec.title,
      children: (
        <div className="field-help__sec">
          <p className="field-help__lead">{sec.lead}</p>
          {sec.items.map((it) => (
            <div key={it.md} className="field-help__item">
              <div className="field-help__head">
                <span className="field-help__what">{it.what}</span>
                {onInsert && (
                  <Button size="small" onClick={() => { onInsert(`\n${it.md}\n`); setOpen(false); }}>
                    Вставить
                  </Button>
                )}
              </div>
              <div className="field-help__body">
                <pre className="field-help__code">{it.md}</pre>
                <div className="field-help__preview">
                  <MathRenderer text={it.md} />
                </div>
              </div>
            </div>
          ))}
          {sec.note && <p className="field-help__note">{sec.note}</p>}
        </div>
      ),
    })),
    {
      key: 'tips',
      label: 'Приёмы',
      children: (
        <dl className="field-help__tips">
          {FIELD_TIPS.map((t) => (
            <div key={t.title}>
              <dt>{t.title}</dt>
              <dd>{t.text}</dd>
            </div>
          ))}
        </dl>
      ),
    },
  ];

  return (
    <>
      <Tooltip title="Справка: формулы, таблицы, чертежи — что можно вставить в поле">
        <Button
          size="small"
          type="text"
          icon={<QuestionCircleOutlined />}
          aria-label="Справка по вставке"
          onClick={() => setOpen(true)}
        >
          {label}
        </Button>
      </Tooltip>
      <Modal
        title="Справка: что можно вставить в поле"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={860}
        destroyOnHidden
      >
        <Tabs items={items} size="small" className="field-help" />
      </Modal>
    </>
  );
}
