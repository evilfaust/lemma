import { api } from '../../shared/services/pocketbase';
import { sanitizeSvg } from '../../utils/sanitizeSvg';

/**
 * Миниатюра чертежа условия: SVG (в т.ч. стерео) или PNG. Чертёж к решению
 * (`image_role = 'solution'`, банк МЦНМО) не показывается — он не к условию.
 */
export default function GeometryTaskThumb({ task, height = 64, width = 88 }) {
  const box = {
    width, height, flexShrink: 0, border: '1px solid #f0f0f0', borderRadius: 6, background: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  };
  if (task?.drawing_view === 'svg' && task.drawing_svg) {
    return (
      <div style={box}>
        <div
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: sanitizeSvg(task.drawing_svg) }}
          style={{ width: '100%', maxHeight: height - 4, overflow: 'hidden', lineHeight: 0 }}
        />
      </div>
    );
  }
  const url = task?.image_role === 'solution' ? '' : api.getGeometryImageUrl(task);
  if (!url) return <div style={{ ...box, color: '#bfbfbf', fontSize: 11 }}>без чертежа</div>;
  return (
    <div style={box}>
      <img src={url} alt="" loading="lazy" style={{ maxWidth: '100%', maxHeight: height - 4, objectFit: 'contain' }} />
    </div>
  );
}
