// Несколько тел на одном чертеже: «шар, вписанный в куб», «конус, вписанный
// в цилиндр», «две кружки», «два шара». Тело kind: 'group' — части, каждая
// строится своим кодом (bodies.js) и сдвигается на at.
//
// Видимость: часть закрывает и свои линии, и чужие — кроме части-«каркаса»
// (frame): у вписанной фигуры внешнее тело прозрачное, иначе всё вписанное
// ушло бы в пунктир. Свои рёбра каркас закрывает как обычно (задние рёбра
// куба — пунктиром).
//
// Имена: у второй части совпавшие имена получают номер части (O → O2).

import {
  v3, add, sub, mul, dist,
} from './vec3';

const NAME_RE = /^[A-Z][0-9]*$/;

/** Нормализация группы: части (без вложенных групп), сдвиги, каркас. */
export function normalizeGroupSpec(spec, normalizePart) {
  const parts = (Array.isArray(spec?.parts) ? spec.parts : []).slice(0, 4).map((p) => {
    const at = Array.isArray(p?.at) && p.at.length === 3 && p.at.every((x) => Number.isFinite(Number(x)))
      ? p.at.map(Number) : [0, 0, 0];
    const { at: _a, frame, ...rest } = p || {};
    void _a;
    if (rest.kind === 'group' || rest.kind === 'space') return null;
    const body = normalizePart(rest);
    return { ...body, at, ...(frame ? { frame: true } : {}) };
  }).filter(Boolean);
  if (parts.length < 2) return parts.length === 1 ? { single: parts[0] } : null;
  return { kind: 'group', parts };
}

const tr = (P, d) => add(P, d);

/**
 * Собирает группу из построенных частей.
 * @param built — [{ body, at, frame }] (body — результат buildBody части)
 */
export function buildGroupBody(spec, built) {
  const vertices = {};
  const order = [];
  const edges = [];
  const faces = [];
  const curves = [];
  const circles = {};
  const concealed = new Set();
  const vertexPart = {};
  const edgePart = {};
  const localName = {};
  const parts = [];
  const taken = new Set();
  // Центр габаритов всей группы — в начало координат
  const allPts = [];
  built.forEach(({ body, at }) => {
    const d = v3(...at);
    for (const p of body.extent || body.order.map((n) => body.vertices[n])) allPts.push(tr(p, d));
  });
  const lo = allPts.reduce((m, p) => v3(Math.min(m.x, p.x), Math.min(m.y, p.y), Math.min(m.z, p.z)), v3(Infinity, Infinity, Infinity));
  const hi = allPts.reduce((m, p) => v3(Math.max(m.x, p.x), Math.max(m.y, p.y), Math.max(m.z, p.z)), v3(-Infinity, -Infinity, -Infinity));
  const mid = mul(add(lo, hi), 0.5);

  built.forEach(({ body, at, frame }, i) => {
    const d = sub(v3(...at), mid);
    const map = {};
    for (const n of body.order) {
      let name = n;
      if (taken.has(name)) {
        let k = i + 1;
        name = `${n}${k}`;
        while (taken.has(name) || !NAME_RE.test(name)) { k += 1; name = `${n}${k}`; }
      }
      taken.add(name);
      map[n] = name;
      vertices[name] = tr(body.vertices[n], d);
      order.push(name);
      vertexPart[name] = i;
      localName[name] = { part: i, name: n };
    }
    for (const n of body.concealed || []) if (map[n]) concealed.add(map[n]);
    for (const [a, b] of body.edges) {
      const e = [map[a], map[b]];
      edges.push(e);
      edgePart[`${e[0]}-${e[1]}`] = i;
    }
    for (const f of body.faces) {
      const pts3 = (f.pts3 || f.verts.map((v) => body.vertices[v])).map((p) => tr(p, d));
      const verts = f.verts ? f.verts.map((v) => map[v]) : null;
      faces.push({
        ...f, id: verts ? verts.join('') : `p${i}${f.id}`, verts, pts3, d: f.d + (f.n.x * d.x + f.n.y * d.y + f.n.z * d.z), part: i,
        ...(f.center ? { center: map[f.center] || f.center } : {}),
      });
    }
    for (const cv of body.curves || []) curves.push({ ...cv, id: `${i}:${cv.id}`, pts: cv.pts.map((p) => tr(p, d)), part: i });
    for (const [k, c] of Object.entries(body.circles || {})) circles[map[k] || k] = { ...c, c: tr(c.c, d) };
    // Часть — для видимости: тело, сдвинутое на d
    parts.push({ body: shiftBody(body, d), frame: !!frame });
  });

  let size = 0;
  for (const p of allPts) for (const q of allPts) size = Math.max(size, dist(p, q));
  const extent = [sub(lo, mid), sub(hi, mid)];
  return {
    spec,
    vertices,
    order,
    edges,
    faces,
    curves,
    circles,
    concealed,
    center: v3(0, 0, 0),
    size,
    extent,
    parts,
    vertexPart,
    edgePart,
    localName,
    silhouette: (v) => parts.flatMap((p, i) => (p.body.silhouette ? p.body.silhouette(v).map((s) => ({ seg: s, part: i })) : [])),
    group: true,
  };
}

/** Тело части, сдвинутое на d (для видимости и сечений). */
function shiftBody(body, d) {
  const sh = (p) => add(p, d);
  const out = {
    ...body,
    vertices: Object.fromEntries(Object.entries(body.vertices).map(([k, p]) => [k, sh(p)])),
    faces: body.faces.map((f) => ({
      ...f,
      ...(f.pts3 ? { pts3: f.pts3.map(sh) } : {}),
      d: f.d + (f.n.x * d.x + f.n.y * d.y + f.n.z * d.z),
    })),
    center: sh(body.center),
  };
  if (body.meshEdges) out.meshEdges = body.meshEdges.map(([a, b]) => [sh(a), sh(b)]);
  if (body.cells) out.cells = body.cells.map((c) => ({ lo: sh(c.lo), hi: sh(c.hi) }));
  if (body.unitCells) out.unitCells = body.unitCells.map((c) => ({ lo: sh(c.lo), hi: sh(c.hi) }));
  if (body.sphere) out.sphere = { c: sh(body.sphere.c), r: body.sphere.r };
  if (body.silhouette) out.silhouette = (v) => body.silhouette(v).map(([a, b]) => [sh(a), sh(b)]);
  if (body.extent) out.extent = body.extent.map(sh);
  return out;
}

/**
 * Окклюдер для видимости в группе: owner — часть, чьи это линии (её каркас
 * тоже закрывает); exclude — часть, которая не закрывает (контур самой части).
 */
export function groupOccluder(group, { owner = -1, exclude = -1 } = {}) {
  return { ...group, occOwner: owner, occExclude: exclude };
}

/** Скрыта ли точка какой-нибудь частью группы. */
export function isPointHiddenGroup(group, P, v, hiddenIn) {
  return group.parts.some((p, i) => i !== group.occExclude
    && (!p.frame || i === group.occOwner)
    && hiddenIn(p.body, P, v));
}
