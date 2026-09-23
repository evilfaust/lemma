import { useRef } from 'react';

/**
 * Горизонтальный свайп пальцем: onLeft — палец ушёл влево (листаем вперёд),
 * onRight — вправо (назад). Срабатывает только на явно горизонтальный жест,
 * чтобы не мешать вертикальной прокрутке страницы. Возвращает пропсы для div.
 */
export default function useSwipe({ onLeft, onRight, threshold = 60 }) {
  const start = useRef(null);
  return {
    onTouchStart: (e) => {
      const t = e.touches[0];
      start.current = t ? { x: t.clientX, y: t.clientY } : null;
    },
    onTouchEnd: (e) => {
      const s = start.current;
      start.current = null;
      const t = e.changedTouches[0];
      if (!s || !t) return;
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 2) return;
      if (dx < 0) onLeft?.();
      else onRight?.();
    },
  };
}
