// Видимость на стереочертеже — точно, а не по пробам.
//
// Тело выпуклое, поэтому точка P скрыта ⇔ луч из P к зрителю проходит
// через тело на ненулевой длине (отсекаем луч полупространствами граней).
// Точки передней грани и силуэта видны: луч сразу выходит наружу.
//
// Для отрезка множество скрытых точек — ОДИН интервал: это пересечение
// отрезка с выпуклой «тенью» тела, вытянутой от зрителя. Поэтому хватает
// найти первую и последнюю скрытую пробу и уточнить границы бисекцией.

import { dot, lerp } from './vec3';

/** Точка скрыта телом при взгляде вдоль toViewer. */
export function isPointHidden(body, P, toViewer) {
  const epsLen = 1e-6 * body.size;
  let lo = 0;
  let hi = Infinity;
  for (const f of body.faces) {
    const nn = dot(f.n, toViewer);
    const room = f.d - dot(f.n, P); // ≥ 0 — точка по внутреннюю сторону грани
    if (Math.abs(nn) < 1e-12) {
      if (room < -epsLen) return false; // луч идёт вне этой грани параллельно ей
      continue;
    }
    const s = room / nn;
    if (nn > 0) hi = Math.min(hi, s);
    else lo = Math.max(lo, s);
    if (hi - lo <= epsLen) return false;
  }
  return hi - Math.max(lo, 0) > epsLen;
}

const SAMPLES = 48;
const BISECT = 22;

/**
 * Скрытая часть отрезка AB: [t1, t2] (доли от A) или null.
 */
export function hiddenInterval(body, A, B, toViewer) {
  const hidden = (t) => isPointHidden(body, lerp(A, B, t), toViewer);
  let first = -1;
  let last = -1;
  const flags = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const h = hidden(t);
    flags.push(h);
    if (h) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return null;
  const refine = (visT, hidT) => {
    let v = visT;
    let h = hidT;
    for (let k = 0; k < BISECT; k++) {
      const m = (v + h) / 2;
      if (hidden(m)) h = m; else v = m;
    }
    return h;
  };
  const t1 = first === 0 ? 0 : refine((first - 1) / SAMPLES, first / SAMPLES);
  const t2 = last === SAMPLES ? 1 : refine((last + 1) / SAMPLES, last / SAMPLES);
  const snap = (t) => (t < 1e-4 ? 0 : t > 1 - 1e-4 ? 1 : t);
  const a = snap(t1);
  const b = snap(t2);
  return b - a > 1e-4 ? [a, b] : null;
}

/**
 * Куски отрезка: [{ t0, t1, hidden }] по порядку от A к B.
 */
export function splitByVisibility(body, A, B, toViewer) {
  const iv = hiddenInterval(body, A, B, toViewer);
  if (!iv) return [{ t0: 0, t1: 1, hidden: false }];
  const out = [];
  if (iv[0] > 0) out.push({ t0: 0, t1: iv[0], hidden: false });
  out.push({ t0: iv[0], t1: iv[1], hidden: true });
  if (iv[1] < 1) out.push({ t0: iv[1], t1: 1, hidden: false });
  return out;
}

/** Передняя ли грань (смотрит на зрителя). */
export function isFaceFront(face, toViewer) {
  return dot(face.n, toViewer) > 1e-9;
}

