import { Modal, Tabs } from 'antd';
import {
  TOOLS, toolHint, COMMAND_HELP, KEY_HELP, DSL_HELP,
} from '../../utils/planim';

/**
 * Справка планиметрического редактора (кнопка «?» и клавиша «?»). Текст — из
 * utils/planim/help.js; клик по команде подставляет её в строку команд.
 */
export default function PlanimHelpModal({ open, onClose, onInsert }) {
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
          <p className="stereo-help__lead">
            Кнопки справа от чертежа. Буква — горячая клавиша. Инструментам, которым
            нужна точка, можно кликать по пустому месту — точка появится сама.
          </p>
          <dl className="stereo-help__list">
            {TOOLS.map((t) => (
              <div key={t.key} className="stereo-help__row">
                <dt>
                  <span className="stereo-help__glyph">{t.glyph}</span>
                  {t.label}
                  <kbd>{t.hot}</kbd>
                </dt>
                <dd>{toolHint(t.key, [])}</dd>
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
      key: 'dsl',
      label: 'Блок ```planim',
      children: (
        <>
          <p className="stereo-help__lead">
            Чертёж текстом — в условии задачи или в теории (кнопка «Текст» отдаёт
            готовый блок). Внутри — те же команды, по одной на строку, и ещё:
          </p>
          <Rows rows={DSL_HELP} left={(r) => ({ key: r.line, node: <code className="stereo-help__cmd">{r.line}</code> })} />
          <p className="stereo-help__lead" style={{ marginTop: 12 }}>
            <b>В ячейку таблицы</b> — одной строкой, команды через «;»:{' '}
            <code className="stereo-help__cmd">`planim: треугольник ABC 5 6 7; H = высота B AC`</code>.
            В окне редактора (задача, теория) — переключатель «В строку (для таблиц)».
          </p>
        </>
      ),
    },
  ];

  return (
    <Modal
      title="Справка: планиметрические чертежи"
      open={open}
      onCancel={onClose}
      footer={null}
      width={780}
      destroyOnHidden
    >
      <Tabs items={items} defaultActiveKey="commands" size="small" className="stereo-help" />
    </Modal>
  );
}
