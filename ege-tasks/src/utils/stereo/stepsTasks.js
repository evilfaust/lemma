// Задачи первой части на ступенчатые многогранники («все двугранные углы
// прямые»): объём, площадь поверхности, расстояние между вершинами.
//
// Тело — случайная форма из блоков на целочисленной сетке (ступенька,
// лестница, вырез угла, паз сверху). На рисунке подписаны длины рёбер —
// ровно столько, чтобы восстановить все размеры: по каждой оси интервалы
// сетки выражаются через подписанные рёбра (иначе форма отбраковывается).
// Подписи — по видимым рёбрам, как на рисунках банка.

import { buildBody } from './bodies';
import { blocksVolume } from './blocks';
import { isPointHidden } from './visibility';
import { makeProjector } from './camera';
import { evaluateScene } from './scene';
import { dist, lerp, sub, cross, len } from './vec3';

const pickInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

/** Случайная ступенчатая форма: { boxes, minus? } на целой сетке. */
function randomShape(rand) {
  const W = pickInt(rand, 3, 6);
  const D = pickInt(rand, 2, 5);
  const H = pickInt(rand, 1, 3);
  const kind = Math.floor(rand() * 4);
  if (kind === 0) {
    // ступенька: на основании — блок у левого края во всю глубину
    const w = pickInt(rand, 1, W - 1);
    const h = pickInt(rand, 1, 3);
    return { boxes: [[0, 0, 0, W, D, H], [0, 0, H, w, D, h]] };
  }
  if (kind === 1) {
    // лестница из трёх ступеней
    const s = pickInt(rand, 1, 2);
    const h = pickInt(rand, 1, 2);
    return { boxes: [[0, 0, 0, 3 * s, D, h], [0, 0, h, 2 * s, D, h], [0, 0, 2 * h, s, D, h]] };
  }
  if (kind === 2) {
    // вырезан угол (спереди справа сверху)
    const a = pickInt(rand, 1, W - 1);
    const b = pickInt(rand, 1, D - 1);
    const H2 = pickInt(rand, 2, 4);
    const c = pickInt(rand, 1, H2 - 1);
    return { boxes: [[0, 0, 0, W, D, H2]], minus: [[W - a, 0, H2 - c, a, b, c]] };
  }
  // паз сверху во всю глубину
  if (W < 3) return null;
  const g = pickInt(rand, 1, W - 2);
  const x = pickInt(rand, 1, W - 1 - g);
  const H2 = pickInt(rand, 2, 4);
  const c = pickInt(rand, 1, H2 - 1);
  return { boxes: [[0, 0, 0, W, D, H2]], minus: [[x, 0, H2 - c, g, D, c]] };
}

/** Площадь поверхности ступенчатого тела (сумма прямоугольников граней). */
export function blocksSurface(body) {
  return body.faces.reduce((acc, f) => {
    const [a, b, , d] = f.pts3;
    return acc + len(cross(sub(b, a), sub(d, a)));
  }, 0);
}

const AXIS = ['x', 'y', 'z'];

/**
 * Рёбра для подписей: по каждой оси все интервалы сетки должны выражаться
 * через подписанные длины. Видимые рёбра — первыми.
 * @returns {[string, string][] | null}
 */
function chooseLabelEdges(body, toViewer) {
  const visible = (a, b) => !isPointHidden(body, lerp(body.vertices[a], body.vertices[b], 0.5), toViewer);
  const out = [];
  for (const ax of AXIS) {
    const along = body.edges.filter(([a, b]) => {
      const d = sub(body.vertices[b], body.vertices[a]);
      return AXIS.filter((o) => o !== ax).every((o) => Math.abs(d[o]) < 1e-9);
    });
    const grid = [...new Set(along.flatMap(([a, b]) => [body.vertices[a][ax], body.vertices[b][ax]]).map((x) => Math.round(x * 1e6) / 1e6))].sort((p, q) => p - q);
    const known = new Array(grid.length - 1).fill(false);
    const range = ([a, b]) => {
      const lo = Math.min(body.vertices[a][ax], body.vertices[b][ax]);
      const hi = Math.max(body.vertices[a][ax], body.vertices[b][ax]);
      const i0 = grid.findIndex((g) => Math.abs(g - lo) < 1e-6);
      const i1 = grid.findIndex((g) => Math.abs(g - hi) < 1e-6);
      return [i0, i1];
    };
    const cands = along
      .map((e) => ({ e, r: range(e), vis: visible(...e) }))
      .sort((p, q) => (q.vis - p.vis) || ((p.r[1] - p.r[0]) - (q.r[1] - q.r[0])));
    let progress = true;
    while (known.some((k) => !k) && progress) {
      progress = false;
      for (const c of cands) {
        const unknown = [];
        for (let i = c.r[0]; i < c.r[1]; i += 1) if (!known[i]) unknown.push(i);
        if (unknown.length !== 1) continue;
        known[unknown[0]] = true;
        out.push(c.e);
        progress = true;
        break;
      }
    }
    if (known.some((k) => !k)) return null;
  }
  return out;
}

const numTex = (x) => String(Math.round(x * 1000) / 1000).replace('.', '{,}');
const tex = (n) => String(n).replace(/(\d+)/, '_{$1}').replace(/_\{(\d)\}/, '_$1');

/**
 * Задача на ступенчатый многогранник.
 * @param type — fVolume | fSurface | fLength | fScale
 * @returns план задания (как у formulaTasks) или null
 */
export function stepsTask(type, rand, camera) {
  const shape = randomShape(rand);
  if (!shape) return null;
  const spec = { kind: 'blocks', ...shape };
  const body = buildBody(spec);
  if (body.spec.kind !== 'blocks') return null;
  const toViewer = makeProjector(camera, { width: 400, height: 360, center: body.center, radius: body.size / 2 }).basis.toViewer;
  const intro = 'На рисунке изображён многогранник, все двугранные углы которого прямые.';

  if (type === 'fScale') {
    const k = pickInt(rand, 2, 4);
    return {
      spec, labels: [],
      question: `${intro} Во сколько раз увеличится его объём, если все рёбра увеличить в $${k}$ раза?`,
      answer: k ** 3, solution: [`Подобные тела: объём увеличится в $${k}^3 = ${k ** 3}$ раз.`],
    };
  }

  const edges = chooseLabelEdges(body, toViewer);
  if (!edges || edges.length > 7) return null;
  const labels = edges.map((e) => ({
    ref: e, g: { v: dist(body.vertices[e[0]], body.vertices[e[1]]), label: String(Math.round(dist(body.vertices[e[0]], body.vertices[e[1]]))) },
  }));

  const prod = (b) => `${b[3]}\\cdot ${b[4]}\\cdot ${b[5]}`;
  const volumeLine = () => {
    const V = blocksVolume(body);
    const plus = shape.boxes.map(prod).join(' + ');
    const minus = (shape.minus || []).map((b) => ` - ${prod(b)}`).join('');
    return `$V = ${plus}${minus} = ${numTex(V)}$.`;
  };
  const howV = shape.minus
    ? 'Дополним многогранник до прямоугольного параллелепипеда и вычтем вырезанную часть.'
    : 'Разобьём многогранник на прямоугольные параллелепипеды.';
  if (type === 'fVolume') {
    return {
      spec, labels,
      question: `${intro} Найдите объём этого многогранника.`,
      answer: blocksVolume(body),
      solution: [howV, volumeLine()],
    };
  }
  if (type === 'fReverse') {
    // Одно ребро — «x», дан объём: объём линеен по каждому размеру, x находится однозначно.
    const i = Math.floor(rand() * labels.length);
    const x = labels[i].g.v;
    const lbl = labels.map((l, k) => (k === i ? { ...l, g: { ...l.g, label: 'x' } } : l));
    return {
      spec, labels: lbl, ask: labels[i].ref,
      question: `${intro} Его объём равен $${numTex(blocksVolume(body))}$. Найдите длину ребра, обозначенного на рисунке буквой $x$.`,
      answer: x,
      solution: [howV, `Объём, выраженный через $x$, равен $${numTex(blocksVolume(body))}$: ${volumeLine()} Значит, $x = ${numTex(x)}$.`],
    };
  }
  if (type === 'fSurface') {
    const S = blocksSurface(body);
    const part = (ax) => body.faces.filter((f) => f.n[ax] > 0.5).reduce((acc, f) => {
      const [a, b, , d] = f.pts3;
      return acc + len(cross(sub(b, a), sub(d, a)));
    }, 0);
    const [sx, sy, sz] = AXIS.map(part).map((v) => Math.round(v * 1000) / 1000);
    return {
      spec, labels,
      question: `${intro} Найдите площадь поверхности этого многогранника.`,
      answer: S,
      solution: [
        'Все грани параллельны трём плоскостям. Грани, видные спереди, вместе равны по площади граням, видным сзади (то же — сверху и снизу, слева и справа), а их сумма — площадь «вида» с этой стороны.',
        `Вид спереди: $${numTex(sy)}$, сверху: $${numTex(sz)}$, сбоку: $${numTex(sx)}$. $S = 2(${numTex(sy)} + ${numTex(sz)} + ${numTex(sx)}) = ${numTex(S)}$.`,
      ],
    };
  }
  if (type === 'fLength') {
    // Две вершины не на одном ребре; расстояние — целое, иначе спросим квадрат.
    const names = body.order;
    const pairs = [];
    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        const [a, b] = [names[i], names[j]];
        const d = sub(body.vertices[b], body.vertices[a]);
        const nz = AXIS.filter((o) => Math.abs(d[o]) > 1e-9).length;
        if (nz < 2) continue;
        const d2 = Math.round(d.x * d.x + d.y * d.y + d.z * d.z);
        pairs.push({ a, b, d2, whole: Number.isInteger(Math.sqrt(d2)) });
      }
    }
    if (!pairs.length) return null;
    const pool = pairs.filter((q) => q.whole);
    const list = pool.length && rand() < 0.7 ? pool : pairs;
    const p = list[Math.floor(rand() * list.length)];
    const A = 'A';
    const B = 'B';
    const coord = (n) => body.coordOf[n];
    const named = { ...(spec.labels || {}), [coord(p.a)]: A, [coord(p.b)]: B };
    const spec2 = { ...spec, labels: named };
    const body2 = buildBody(spec2);
    const lbl = labels.map((l) => ({ ...l, ref: l.ref.map((n) => (n === p.a ? A : n === p.b ? B : nameAt(body2, body.coordOf[n]))) }));
    const whole = p.whole;
    const ans = whole ? Math.sqrt(p.d2) : p.d2;
    return {
      spec: spec2, labels: lbl, extra: [{ id: 'ab', type: 'segment', ref: [A, B] }], ask: [A, B],
      question: `${intro} Найдите ${whole ? 'расстояние' : 'квадрат расстояния'} между вершинами $${tex(A)}$ и $${tex(B)}$.`,
      answer: ans,
      solution: [
        'Введём координаты вдоль рёбер (все углы прямые): разности координат вершин — суммы подписанных длин.',
        `$${tex(A)}${tex(B)}^2 = \\Delta x^2 + \\Delta y^2 + \\Delta z^2 = ${p.d2}$${whole ? `, $${tex(A)}${tex(B)} = ${ans}$` : ''}.`,
      ],
    };
  }
  return null;
}

/** Имя вершины по координате «x y z» в построенном теле. */
function nameAt(body, ck) {
  return Object.entries(body.coordOf).find(([, k]) => k === ck)?.[0] || null;
}

/** Модель для проверки ответа (тесты, отладка). */
export function stepsModel(spec) {
  return evaluateScene({ body: spec, ops: [] });
}
