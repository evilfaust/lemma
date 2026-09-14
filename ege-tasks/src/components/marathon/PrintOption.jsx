import './PrintOption.css';

/**
 * Карточка печатного листа: схема раскладки, что это за лист, что внутри и
 * кнопка. Один вид на все вкладки печати марафона — раньше там лежали голая
 * кнопка и абзац текста, и вкладки читались как набор случайных кнопок.
 */
export default function PrintOption({
  thumb, title, desc, bullets = [], actions, disabled = false, tone = 'default',
}) {
  return (
    <div className={`mg-opt${disabled ? ' is-disabled' : ''}${tone === 'quiet' ? ' mg-opt--quiet' : ''}`}>
      {thumb && <div className="mg-opt-thumb">{thumb}</div>}

      <div className="mg-opt-main">
        <div className="mg-opt-title">{title}</div>
        {desc && <div className="mg-opt-desc">{desc}</div>}
        {bullets.length > 0 && (
          <ul className="mg-opt-bullets">
            {bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        )}
      </div>

      {actions && <div className="mg-opt-actions">{actions}</div>}
    </div>
  );
}
