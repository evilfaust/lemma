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
import { isPointHiddenBlocks } from './blocks';

/** Точка скрыта телом при взгляде вдоль toViewer. */
export function isPointHidden(body, P, toViewer) {
  if (body.cells) return isPointHiddenBlocks(body, P, toViewer);
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
  if (body.cells) return splitMany(body, A, B, toViewer);
  const iv = hiddenInterval(body, A, B, toViewer);
  if (!iv) return [{ t0: 0, t1: 1, hidden: false }];
  const out = [];
  if (iv[0] > 0) out.push({ t0: 0, t1: iv[0], hidden: false });
  out.push({ t0: iv[0], t1: iv[1], hidden: true });
  if (iv[1] < 1) out.push({ t0: iv[1], t1: 1, hidden: false });
  return out;
}

/**
 * Невыпуклое тело: скрытых кусков у отрезка может быть несколько — пробы
 * по всей длине, каждая смена «видно/скрыто» уточняется бисекцией.
 */
function splitMany(body, A, B, toViewer) {
  const N = 96;
  const hidden = (t) => isPointHidden(body, lerp(A, B, t), toViewer);
  const flags = [];
  for (let i = 0; i <= N; i += 1) flags.push(hidden(i / N));
  const cuts = [0];
  for (let i = 0; i < N; i += 1) {
    if (flags[i] === flags[i + 1]) continue;
    let lo = i / N;
    let hi = (i + 1) / N;
    const a = flags[i];
    for (let k = 0; k < BISECT; k += 1) {
      const m = (lo + hi) / 2;
      if (hidden(m) === a) lo = m; else hi = m;
    }
    cuts.push((lo + hi) / 2);
  }
  cuts.push(1);
  const out = [];
  for (let i = 0; i + 1 < cuts.length; i += 1) {
    const t0 = cuts[i];
    const t1 = cuts[i + 1];
    if (t1 - t0 <= 1e-4) continue;
    const h = hidden((t0 + t1) / 2);
    const last = out[out.length - 1];
    if (last && last.hidden === h) last.t1 = t1;
    else out.push({ t0, t1, hidden: h });
  }
  return out.length ? out : [{ t0: 0, t1: 1, hidden: false }];
}

/** Передняя ли грань (смотрит на зрителя). */
export function isFaceFront(face, toViewer) {
  return dot(face.n, toViewer) > 1e-9;
}

