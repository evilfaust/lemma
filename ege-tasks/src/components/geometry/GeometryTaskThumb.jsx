import { api } from '../../shared/services/pocketbase';
import { sanitizeSvg } from '../../utils/sanitizeSvg';
import './geometryThumb.css';

/**
 * Миниатюра чертежа условия: SVG (в т.ч. стерео) или PNG. Чертёж к решению
 * (`image_role = 'solution'`, банк МЦНМО) не показывается — он не к условию.
 * Чертёж вписывается в рамку целиком (`.geo-svg-fit`), а не обрезается.
 */
export default function GeometryTaskThumb({ task, height = 64, width = 88, padding = 2, style }) {
  const box = {
    width, height, flexShrink: 0, border: '1px solid #f0f0f0', borderRadius: 6, background: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    padding, boxSizing: 'border-box', ...style,
  };
  if (task?.drawing_view === 'svg' && task.drawing_svg) {
    return (
      <div style={box}>
        <div
          className="geo-svg-fit"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: sanitizeSvg(task.drawing_svg) }}
        />
      </div>
    );
  }
  const url = task?.image_role === 'solution' ? '' : api.getGeometryImageUrl(task);
  if (!url) return <div style={{ ...box, color: '#bfbfbf', fontSize: 11 }}>без чертежа</div>;
  return (
    <div style={box}>
      <img
        src={url}
        alt=""
        loading="lazy"
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}
