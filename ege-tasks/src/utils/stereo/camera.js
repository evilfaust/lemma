// Камера стереочертежа: ортогональная (параллельная) проекция — школьный
// «общепринятый» чертёж: параллельные прямые остаются параллельными,
// отношения отрезков на прямой сохраняются при любом ракурсе.
//
// yaw — поворот вокруг вертикали (градусы), pitch — наклон «сверху» (градусы).
// При yaw = 0, pitch = 0 зритель смотрит со стороны −y (спереди).

import { dot } from './vec3';

export const PITCH_MIN = -10;
export const PITCH_MAX = 75;
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;

/** Ракурс «как в учебнике»: видны передняя, правая боковая и верхняя грани. */
export const DEFAULT_CAMERA = Object.freeze({ yaw: 22, pitch: 22, zoom: 1 });

const RAD = Math.PI / 180;

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
