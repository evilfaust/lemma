import { useSyncExternalStore } from 'react';

// Телефонная раскладка «Моего пространства»: всё уже планшетного md (768px).
// matchMedia синхронный — в отличие от Grid.useBreakpoint(), который на первом
// рендере отдаёт {} и заставил бы десктоп мигнуть мобильной версией.
const QUERY = '(max-width: 767.98px)';

function subscribe(cb) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}

const getSnapshot = () => (typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia(QUERY).matches
  : false);

export default function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
