import { Button, Tooltip } from 'antd';
import { CloseOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { MathText } from '../shared/MathText';
import { evaluateMeasure } from '../../utils/stereo/measure';

/**
 * Панель «Измерения» стереоредактора: длины, расстояния, углы. Видна только
 * учителю — в сцену, эфир и библиотеку измерения не попадают. Величины
 * пересчитываются по текущей модели (точку подвинули — число обновилось).
 * Наведение на строку подсвечивает её точки на чертеже.
 */
export default function StereoMeasures({
  model, measures, onRemove, onClear, onHover,
}) {
  return (
    <div className="stereo-measures" aria-label="Измерения">
      <div className="stereo-measures__head">
        <strong>Измерения</strong>
        <Tooltip title="Видно только вам — на чертёж и ученикам не попадает">
          <EyeInvisibleOutlined className="stereo-measures__private" aria-label="Видно только вам" />
        </Tooltip>
        {measures.length > 0 && (
          <Button size="small" type="text" onClick={onClear} style={{ marginLeft: 'auto' }}>Очистить</Button>
        )}
      </div>
      {measures.length === 0 ? (
        <div className="stereo-cmd-help">
          Кликните два объекта инструментом «Измерить» или напишите «измерить AB» / «измерить ABC».
        </div>
      ) : (
        <ul className="stereo-measures__list">
          {measures.map((m) => {
            const r = evaluateMeasure(model, m);
            return (
              <li
                key={m.id}
                className="stereo-measure"
                onMouseEnter={() => onHover?.(m.id)}
                onMouseLeave={() => onHover?.(null)}
              >
                <div className="stereo-measure__body">
                  <span className="stereo-measure__label">{r.label}</span>
                  {r.rows.map((row) => (
                    <span key={row.what} className="stereo-measure__row">
                      {r.rows.length > 1 && <span className="stereo-measure__what">{row.what}</span>}
                      {' = '}
                      {row.latex && <MathText text={`$${row.latex}$`} />}
                      {row.approx && <span className="stereo-measure__approx">{row.latex ? ' ≈ ' : ''}{row.approx}</span>}
                    </span>
                  ))}
                  {r.note && <span className="stereo-measure__note">{r.note}</span>}
                  {r.error && <span className="stereo-cmd-error">{r.error}</span>}
                </div>
                <Button
                  size="small"
                  type="text"
                  icon={<CloseOutlined />}
                  aria-label="Убрать измерение"
                  onClick={() => onRemove?.(m.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
