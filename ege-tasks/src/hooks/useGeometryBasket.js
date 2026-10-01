import { useSyncExternalStore } from 'react';
import { geometryBasket } from '../utils/geometryBasket';

/** Подборка геометрических задач: [{ id, code }] + методы хранилища. */
export function useGeometryBasket() {
  const items = useSyncExternalStore(geometryBasket.subscribe, geometryBasket.getSnapshot);
  return { items, ...geometryBasket };
}

export default useGeometryBasket;
