import { Modal, Tabs } from 'antd';
import {
  TOOLS, toolHint, COMMAND_HELP, KEY_HELP, LESSON_HELP, DSL_HELP,
} from '../../utils/stereo';

/**
 * Справка редактора стереочертежей (кнопка «?» и клавиша «?»). Текст — из
 * utils/stereo/help.js; клик по команде подставляет её в строку команд.
 */
export default function StereoHelpModal({ open, onClose, onInsert }) {
  const Rows = ({ rows, left }) => (
    <dl className="stereo-help__list">
      {rows.map((r) => (
        <div key={left(r).key || r.what} className="stereo-help__row">
          <dt>{left(r).node}</dt>
          <dd>{r.what}</dd>
        </div>
      ))}
    </dl>
  );

  const cmdNode = (cmd) => (onInsert ? (
    <button
      type="button"
      className="stereo-help__cmd"
      title="Вставить в строку команд"
      onClick={() => { onInsert(cmd); onClose(); }}
    >
      {cmd}
    </button>
  ) : <code className="stereo-help__cmd">{cmd}</code>);

  const items = [
    {
      key: 'tools',
      label: 'Инструменты',
      children: (
        <>
          <p className="stereo-help__lead">Кнопки справа от чертежа. Буква — горячая клавиша.</p>
          <dl className="stereo-help__list">
            {TOOLS.map((t) => (
              <div key={t.key} className="stereo-help__row">
                <dt>
                  <span className="stereo-help__glyph">{t.glyph}</span>
                  {t.label}
                  <kbd>{t.hot}</kbd>
                </dt>
                <dd>{t.key === 'rotate' ? 'Тянуть — вращать, колёсико — масштаб; точки на рёбрах можно перетаскивать' : toolHint(t.key, [])}</dd>
              </div>
            ))}
          </dl>
        </>
      ),
    },
    {
      key: 'commands',
      label: 'Команды',
      children: (
        <>
          <p className="stereo-help__lead">
            Пишутся в строке под инструментами, Enter — выполнить. Имена точек —
            латиницей (русские А, В, С… тоже понимаются), A1 = A₁.
            {onInsert && ' Клик по команде — вставить её в строку.'}
          </p>
          {COMMAND_HELP.map((sec) => (
            <section key={sec.title}>
              <h4 className="stereo-help__h">{sec.title}</h4>
              <Rows rows={sec.items} left={(r) => ({ key: r.cmd, node: cmdNode(r.cmd) })} />
            </section>
          ))}
        </>
      ),
    },
    {
      key: 'keys',
      label: 'Мышь и клавиши',
      children: KEY_HELP.map((sec) => (
        <section key={sec.title}>
          <h4 className="stereo-help__h">{sec.title}</h4>
          <Rows rows={sec.items} left={(r) => ({ key: r.keys, node: <b>{r.keys}</b> })} />
        </section>
      )),
    },
    {
      key: 'lesson',
      label: 'Урок и эфир',
      children: <Rows rows={LESSON_HELP} left={(r) => ({ key: r.keys, node: <b>{r.keys}</b> })} />,
    },
    {
      key: 'dsl',
      label: 'Блок ```stereo',
      children: (
        <>
          <p className="stereo-help__lead">
            Чертёж текстом — в условии задачи или в теории (кнопка «Текст» отдаёт
            готовый блок). Внутри — те же команды, по одной на строку, и ещё:
          </p>
          <Rows rows={DSL_HELP} left={(r) => ({ key: r.line, node: <code className="stereo-help__cmd">{r.line}</code> })} />
        </>
      ),
    },
  ];

  return (
    <Modal
      title="Справка: стереочертежи"
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnHidden
    >
      <Tabs items={items} defaultActiveKey="commands" size="small" className="stereo-help" />
    </Modal>
  );
}
