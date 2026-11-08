// Формулы для соосных пар. Внутреннее тело и внешнее имеют собственные
// координаты с началом на середине высоты. z — сдвиг внутреннего от внешнего.
const sideAngle = (s) => Math.PI / s.n;
const orientation = (cone) => (cone.down ? -1 : 1);
const incircle = (r, h) => r * (h / (r + Math.hypot(r, h)));

const PAIRS = {
  'sphere:cube': {
    inside: (_, cube) => ({ inner: { r: cube.a / 2 } }),
    outside: (sphere) => ({ outer: { a: 2 * sphere.r } }),
  },
  'cube:sphere': {
    inside: (_, sphere) => ({ inner: { a: 2 * sphere.r / Math.sqrt(3) } }),
    outside: (cube) => ({ outer: { r: cube.a * Math.sqrt(3) / 2 } }),
  },
  'sphere:cylinder': {
    inside: (_, cylinder) => ({ inner: { r: cylinder.r }, outer: { h: 2 * cylinder.r } }),
    outside: (sphere) => ({ outer: { r: sphere.r, h: 2 * sphere.r } }),
  },
  'cone:cylinder': {
    inside: (_, cylinder) => ({ inner: { r: cylinder.r, h: cylinder.h } }),
    outside: (cone) => ({ outer: { r: cone.r, h: cone.h } }),
  },
  'sphere:cone': {
    inside: (_, cone) => {
      const r = incircle(cone.r, cone.h);
      return { inner: { r }, z: orientation(cone) * (r - cone.h / 2) };
    },
    outside: (sphere, cone) => {
      const size = sphere.r * (1 + Math.sqrt(2));
      return {
        outer: { r: size, h: size },
        z: orientation(cone) * (sphere.r - size / 2),
        hint: 'У описанного конуса высота равна радиусу основания.',
      };
    },
  },
  'cone:sphere': {
    inside: (cone, sphere) => ({
      inner: { r: sphere.r, h: sphere.r },
      z: orientation(cone) * sphere.r / 2,
      hint: 'Вершина конуса лежит на полюсе шара, основание — на экваторе.',
    }),
    outside: (cone) => {
      const z = (cone.r / cone.h) * (cone.r / 2);
      return { outer: { r: cone.h / 2 + z }, z: orientation(cone) * z };
    },
  },
  'cylinder:prism': {
    inside: (_, prism) => ({ inner: { r: prism.a / (2 * Math.tan(sideAngle(prism))), h: prism.h } }),
    outside: (cylinder, prism) => ({ outer: { a: 2 * cylinder.r * Math.tan(sideAngle(prism)), h: cylinder.h } }),
  },
  'prism:cylinder': {
    inside: (prism, cylinder) => ({ inner: { a: 2 * cylinder.r * Math.sin(sideAngle(prism)), h: cylinder.h } }),
    outside: (prism) => ({ outer: { r: prism.a / (2 * Math.sin(sideAngle(prism))), h: prism.h } }),
  },
  'pyramid:cone': {
    inside: (pyramid, cone) => ({ inner: { a: 2 * cone.r * Math.sin(sideAngle(pyramid)), h: cone.h } }),
    outside: (pyramid) => ({ outer: { r: pyramid.a / (2 * Math.sin(sideAngle(pyramid))), h: pyramid.h } }),
  },
};

export const isInscription = (kind) => kind === 'inscribed' || kind === 'circumscribed';

/** Первое тело задаёт размеры, второе подстраивается. */
export function fitBodyPair(first, second, kind) {
  const inside = kind === 'inscribed';
  const [inner, outer] = inside ? [second, first] : [first, second];
  const pair = PAIRS[`${inner.kind}:${outer.kind}`];
  if (!pair || [inner, outer].some((s) => s.base || s.tilt || s.over || s.shift || s.roof || s.cut)) return null;
  if (inner.kind === 'pyramid' && outer.down) return null;
  const result = pair[inside ? 'inside' : 'outside'](inner, outer);
  const { inner: innerSizes = {}, outer: outerSizes = {}, z = 0, hint } = result;
  if (!Number.isFinite(z) || [...Object.values(innerSizes), ...Object.values(outerSizes)]
    .some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return {
    sizes: inside ? [outerSizes, innerSizes] : [innerSizes, outerSizes],
    at: [0, 0, (inside ? z : -z) || 0],
    hint,
  };
}
