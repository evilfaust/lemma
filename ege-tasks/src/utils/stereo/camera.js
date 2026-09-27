// Камера стереочертежа: ортогональная (параллельная) проекция — школьный
// «общепринятый» чертёж: параллельные прямые остаются параллельными,
// отношения отрезков на прямой сохраняются при любом ракурсе.
//
// yaw — поворот вокруг вертикали (градусы), pitch — наклон «сверху» (градусы).
// При yaw = 0, pitch = 0 зритель смотрит со стороны −y (спереди).

import { dot } from './vec3';

export const PITCH_MIN = -10;
export const PITCH_MAX = 90;
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;

/** Ракурс «как в учебнике»: видны передняя, правая боковая и верхняя грани. */
export const DEFAULT_CAMERA = Object.freeze({ yaw: 22, pitch: 22, zoom: 1 });

const RAD = Math.PI / 180;

/**
 * Ракурс, при котором взгляд перпендикулярен плоскости с нормалью n
 * (выносной чертёж: грань или сечение в натуральную величину).
 * Смотрим всегда сверху или сбоку, не снизу; у вертикальной плоскости — с
 * той стороны, откуда смотрели. Строго сверху (горизонтальная плоскость)
 * поворот yaw не меняется — чертёж не крутится в своей плоскости.
 */
export function cameraFacing(n, current = DEFAULT_CAMERA) {
  const nl = Math.hypot(n?.x || 0, n?.y || 0, n?.z || 0);
  const cur = clampCamera(current);
  if (!(nl > 0)) return cur;
  let v = { x: n.x / nl, y: n.y / nl, z: n.z / nl };
  const flip = () => { v = { x: -v.x, y: -v.y, z: -v.z }; };
  if (v.z < -1e-9) flip();
  else if (Math.abs(v.z) <= 1e-9 && dot(v, cameraBasis(cur).toViewer) < 0) flip();
  const pitch = Math.asin(Math.min(1, v.z)) / RAD;
  if (pitch > 90 - 1e-6) return { yaw: cur.yaw, pitch: 90, zoom: cur.zoom };
  const yaw = Math.atan2(v.x, -v.y) / RAD;
  return clampCamera({ yaw, pitch, zoom: cur.zoom });
}

export function clampCamera(cam) {
  const yaw = ((Number(cam?.yaw) || 0) % 360 + 360) % 360;
  const pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, Number(cam?.pitch) || 0));
  const zoomRaw = Number(cam?.zoom);
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(zoomRaw) && zoomRaw > 0 ? zoomRaw : 1));
  return { yaw, pitch, zoom };
}

/**
 * Базис камеры: right — вправо по экрану, up — вверх, toViewer — к зрителю.
 */
export function cameraBasis(cam) {
  const psi = (Number(cam?.yaw) || 0) * RAD;
  const th = (Number(cam?.pitch) || 0) * RAD;
  const fwd = { x: Math.sin(psi), y: -Math.cos(psi), z: 0 }; // горизонталь к зрителю
  return {
    right: { x: Math.cos(psi), y: Math.sin(psi), z: 0 },
    up: {
      x: -Math.sin(th) * fwd.x,
      y: -Math.sin(th) * fwd.y,
      z: Math.cos(th),
    },
    toViewer: {
      x: Math.cos(th) * fwd.x,
      y: Math.cos(th) * fwd.y,
      z: Math.sin(th),
    },
  };
}

/**
 * Проектор мир → экран (пиксели, y вниз). Масштаб считается от радиуса
 * описанной сферы (radius) — он не зависит от поворота, поэтому при вращении
 * чертёж не «дышит».
 */
export function makeProjector(cam, { width, height, center, radius, padding = 28 }) {
  const b = cameraBasis(cam);
  const zoom = Number(cam?.zoom) || 1;
  const avail = Math.max(40, Math.min(width, height) / 2 - padding);
  const scale = (avail / Math.max(radius, 1e-6)) * zoom;
  const cx = width / 2;
  const cy = height / 2;
  const c0 = { x: dot(center, b.right), y: dot(center, b.up) };
  const project = (P) => ({
    x: cx + (dot(P, b.right) - c0.x) * scale,
    y: cy - (dot(P, b.up) - c0.y) * scale,
    depth: dot(P, b.toViewer),
  });
  // Обратно: точка экрана → прямая в пространстве вдоль взгляда { p, u }.
  const unproject = (x, y) => {
    const r = (x - cx) / scale + c0.x;
    const u = -(y - cy) / scale + c0.y;
    return {
      p: {
        x: b.right.x * r + b.up.x * u,
        y: b.right.y * r + b.up.y * u,
        z: b.right.z * r + b.up.z * u,
      },
      u: b.toViewer,
    };
  };
  return { project, unproject, scale, basis: b, cx, cy };
}
