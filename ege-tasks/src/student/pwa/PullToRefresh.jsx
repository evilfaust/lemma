import { useEffect, useRef, useState } from 'react';
import { ArrowDownOutlined } from '@ant-design/icons';
import { isStandalone } from './install';
import { isAppReloadBlocked } from './useAppUpdate';
import {
  PULL_SLOP, pullOffset, pullReady, pullProgress, canStartPull,
} from './pullGesture';
import './pwa.css';

const pageScrollTop = () => (
  window.scrollY || document.scrollingElement?.scrollTop || document.documentElement.scrollTop || 0
);

/**
 * «Потяни вниз — обновить» (v3.9.373). Работает только в установленном
 * приложении: в браузере у телефона есть свой такой жест. Пока идёт тест или
 * ввод пароля (`useBlockAppReload`), жест не срабатывает — иначе ученик
 * случайным свайпом перезапустил бы тест.
 */
export default function PullToRefresh({
  enabled = isStandalone(),
  onRefresh = () => window.location.reload(),
}) {
  const [offset, setOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return undefined;
    // null — жеста нет; { x, y, pulling } — палец на экране.
    let touch = null;
    let current = 0;
    let busy = false;
    const show = (v) => { current = v; setOffset(v); };

    const onStart = (e) => {
      touch = null;
      if (busy || e.touches.length !== 1 || isAppReloadBlocked()) return;
      if (!canStartPull(e.target, { scrollTop: pageScrollTop() })) return;
      const t = e.touches[0];
      touch = { x: t.clientX, y: t.clientY, pulling: false };
    };

    const onMove = (e) => {
      if (!touch) return;
      if (e.touches.length !== 1) { touch = null; show(0); return; }
      const t = e.touches[0];
      const dy = t.clientY - touch.y;
      const dx = t.clientX - touch.x;
      if (!touch.pulling) {
        if (Math.abs(dx) < PULL_SLOP && Math.abs(dy) < PULL_SLOP) return;
        // Вверх или вбок — это прокрутка/листание, не наш жест.
        if (dy <= 0 || Math.abs(dx) > dy || pageScrollTop() > 0) { touch = null; return; }
        touch.pulling = true;
        touch.y = t.clientY - PULL_SLOP; // без рывка на величину порога
      }
      if (e.cancelable) e.preventDefault(); // не даём странице пружинить вместе с индикатором
      show(pullOffset(t.clientY - touch.y));
    };

    const onEnd = () => {
      const wasPulling = touch?.pulling;
      touch = null;
      if (!wasPulling) return;
      if (pullReady(current) && !isAppReloadBlocked()) {
        busy = true;
        setRefreshing(true);
        // Дать крутилке показаться, иначе перезагрузка выглядит как моргание.
        setTimeout(() => refreshRef.current(), 250);
      } else {
        show(0);
      }
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);

  if (!enabled || (!offset && !refreshing)) return null;
  const ready = refreshing || pullReady(offset);
  const y = refreshing ? 64 : offset;
  return (
    <div
      className={`pwa-ptr${ready ? ' is-ready' : ''}${refreshing ? ' is-refreshing' : ''}`}
      style={{ transform: `translate(-50%, ${y - 48}px)`, opacity: refreshing ? 1 : Math.min(1, offset / 30) }}
      role="status"
      aria-label={refreshing ? 'Обновляем' : ready ? 'Отпустите, чтобы обновить' : 'Потяните, чтобы обновить'}
    >
      {refreshing
        ? <span className="pwa-ptr-spin" />
        : <ArrowDownOutlined style={{ transform: `rotate(${ready ? 180 : pullProgress(offset) * 150}deg)` }} />}
    </div>
  );
}
