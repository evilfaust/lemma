// Текстовый формат стереочертежа — блок ```stereo в задачах и теории.
//
//   ```stereo
//   куб 4
//   M на AA1 1:2
//   N на CC1          // подпись к шагу — после двух косых
//   MN
//   X = MN ∩ AC
//   сечение MNB
//   вид 22 22
//   ```
//
// В статье теории блок крутится (components/stereo/TheoryStereoBlock); строка
// «статично» оставляет его картинкой. Печать и PDF — всегда картинка.
//
// Первая строка — тело, дальше — команды строки редактора (commands.js),
// служебные: «вид yaw pitch [масштаб]», «размер ширина [высота]», «цвет»
// (по умолчанию чертёж ч/б — печатный стек Lemma печатает только чёрным).
// Строки с «#» — комментарии. Ошибка строки не рушит чертёж: шаг пропускается,
// ошибка возвращается с номером строки.

import {
  normalizeBodySpec, DEFAULT_BODY, BASE_SHAPES, TILT_DIRS, DEFAULT_TILT_DIR, baseLetters,
} from './bodies';
import {
  evaluateScene, tryAppendOp, applyColorCommand, refOfLineColorKey,
} from './scene';
import { parseCommand, opToCommand, splitNames } from './commands';
import { buildBody } from './bodies';
import { DEFAULT_CAMERA, clampCamera } from './camera';
import {
  renderStereo, stereoSvgString, contentBox, POINT_COLORS, LABEL_SIZE,
} from './render';
import { stereoInlineFromSpec } from './inline';

const num = (s) => Number(String(s).replace(',', '.'));
const isNum = (s) => /^-?\d+(?:[.,]\d+)?$/.test(String(s));

const BODY_WORDS = {
  куб: 'cube', cube: 'cube',
  параллелепипед: 'box', box: 'box',
  призма: 'prism', prism: 'prism',
  пирамида: 'pyramid', pyramid: 'pyramid',
  тетраэдр: 'tetra', tetra: 'tetra',
  frustum: 'frustum',
};

// Слова-основания: «призма 4 4 5 трапеция», «пирамида 3 4 5 S прямоугольный».
const BASE_WORDS = [
  [/^произвольн/, 'free'],
  [/^прямоугольн(ый|ое|ая|ом)$/, 'right'],
  [/^прямоугольник/, 'rect'],
  [/^равнобедр/, 'isosceles'],
  [/^параллелограмм/, 'parallelogram'],
  [/^ромб/, 'rhombus'],
  [/^трапец/, 'trapezoid'],
];
const baseOfWord = (w) => BASE_WORDS.find(([re]) => re.test(w))?.[1] || null;
const DIR_WORDS = { ...TILT_DIRS, вперед: 270 };
// Полное число позиционных чисел: n a h (у усечённой ещё k).
const POSITIONAL = { prism: 3, pyramid: 3, frustum: 4 };

/** «(0 0) (4 0)» / «(0;0)» / «(0,0)» → [[0,0],[4,0]]; не точки — null. */
function parsePoint(text) {
  const t = String(text).trim();
  let parts = t.split(/[;\s]+/).filter(Boolean);
  if (parts.length === 1 && (t.match(/,/g) || []).length === 1) parts = t.split(',');
  if (parts.length !== 2 || !parts.every(isNum)) return null;
  return parts.map(num);
}

/** «призма 3 4 5» → { kind: 'prism', n: 3, a: 4, h: 5 }; не тело — null. */
export function parseBodyLine(line) {
  // Координаты своего основания — в скобках, заменяем их на метки «@0».
  const points = [];
  const src = String(line || '').trim().replace(/\(([^()]*)\)/g, (_, inner) => ` @${points.push(inner) - 1} `);
  const words = src.split(/\s+/).filter(Boolean);
  let i = 0;
  let tiltWord = false;
  let freeWord = false;
  let frustum = false;
  // Прилагательные перед телом: правильная, прямая, наклонная, усечённая, произвольный.
  while (i < words.length && !BODY_WORDS[words[i].toLowerCase()]) {
    const w = words[i].toLowerCase();
    if (/^наклонн/.test(w)) tiltWord = true;
    else if (/^усеч[её]нн/.test(w)) frustum = true;
    else if (/^произвольн/.test(w)) freeWord = true;
    else if (!/^(правильн|прям(ая|ой|ое)$)/.test(w)) return null;
    i += 1;
    if (i > 3) return null;
  }
  let kind = BODY_WORDS[words[i]?.toLowerCase()];
  if (!kind) return null;
  if (frustum) {
    if (kind !== 'pyramid') return null;
    kind = 'frustum';
  }
  const rest = words.slice(i + 1);
  const named = {};
  const nums = [];
  let apex = null;
  let base = freeWord ? 'free' : null;
  let poly = null;
  let tilt = null;
  let dir = null;
  let over = null;
  let shift = null;
  for (let j = 0; j < rest.length; j++) {
    const w = rest[j];
    const lw = w.toLowerCase();
    const m = /^([a-z])=(-?\d+(?:[.,]\d+)?)$/i.exec(w);
    if (m) named[m[1].toLowerCase()] = num(m[2]);
    else if (isNum(w)) nums.push(num(w));
    else if (lw === 'основание' || /^@\d+$/.test(w)) {
      const pts = [];
      let k = lw === 'основание' ? j + 1 : j;
      while (/^@\d+$/.test(rest[k] || '')) { pts.push(parsePoint(points[Number(rest[k].slice(1))])); k += 1; }
      if (pts.length && pts.every(Boolean)) poly = pts;
      j = k - 1;
    } else if (lw === 'наклон') {
      if (isNum(rest[j + 1])) { tilt = num(rest[j + 1]); j += 1; }
      else tilt = 60;
      const d = rest[j + 1]?.toLowerCase();
      if (d in DIR_WORDS) { dir = DIR_WORDS[d]; j += 1; }
    } else if (/^напр/.test(lw) && isNum(rest[j + 1])) {
      dir = num(rest[j + 1]); j += 1;
    } else if (lw === 'над' && /^[A-Z]{1,2}$/.test(rest[j + 1] || '')) {
      over = rest[j + 1]; j += 1;
    } else if (lw === 'сдвиг' && isNum(rest[j + 1]) && isNum(rest[j + 2])) {
      shift = [num(rest[j + 1]), num(rest[j + 2])]; j += 2;
    } else if (baseOfWord(lw)) base = baseOfWord(lw);
    else if (/^[A-ZА-Я]$/.test(w)) apex = w.replace('С', 'S').replace('Д', 'D');
  }
  if (tiltWord && tilt == null) tilt = 60;
  const spec = { kind };
  // «куб 4 по часовой» — буквы основания по часовой стрелке («против часовой» — как обычно).
  if (rest.some((w) => /^(часов\S*|cw)$/i.test(w)) && !rest.some((w) => /^против$/i.test(w))) spec.cw = true;
  if (kind === 'cube') spec.a = named.a ?? nums[0];
  if (kind === 'box') { spec.a = named.a ?? nums[0]; spec.b = named.b ?? nums[1]; spec.c = named.c ?? nums[2]; }
  if (POSITIONAL[kind]) {
    // У основания с заданным числом сторон (трапеция, прямоугольный…) n можно не писать.
    const fixedN = base && BASE_SHAPES[base]?.ns.length === 1;
    const p = fixedN && nums.length < POSITIONAL[kind] ? [null, ...nums] : nums;
    spec.n = named.n ?? p[0];
    spec.a = named.a ?? p[1];
    spec.h = named.h ?? p[2];
    if (kind === 'frustum') spec.k = named.k ?? p[3];
    if (named.b) spec.b = named.b;
  }
  if (kind === 'tetra') { spec.a = named.a ?? nums[0]; spec.h = named.h ?? nums[1]; }
  if (apex && (kind === 'pyramid' || kind === 'tetra')) spec.apex = apex;
  if (base) spec.base = base;
  if (poly) spec.poly = poly;
  if (tilt != null) { spec.tilt = tilt; if (dir != null) spec.dir = dir; }
  if (shift) spec.shift = shift;
  if (over) {
    // «над A» / «над AB» — по буквам основания по умолчанию (без имени вершины).
    const n0 = normalizeBodySpec({ ...spec, over: undefined });
    const letters = baseLetters(n0.kind === 'tetra' ? 3 : n0.n, n0.apex || null);
    const idx = over.split('').map((l) => letters.indexOf(l));
    if (idx.every((x) => x >= 0)) spec.over = idx;
  }
  return normalizeBodySpec(spec);
}

const fmt = (x) => String(Math.round(Number(x) * 100) / 100);

/** Тело → строка блока. */
export function bodyLine(specIn) {
  const s = normalizeBodySpec(specIn);
  const line = bodyShapeLine(s);
  return s.cw ? `${line} по часовой` : line;
}

function baseWord(s) {
  if (s.base === 'poly') return `основание ${s.poly.map(([x, y]) => `(${fmt(x)} ${fmt(y)})`).join(' ')}`;
  if (!s.base) return '';
  const word = BASE_SHAPES[s.base]?.word || '';
  const out = s.kind === 'tetra' && s.base === 'free' ? 'произвольный' : word;
  return (s.base === 'rect' || s.base === 'parallelogram') && s.kind !== 'box' ? `${out} b=${fmt(s.b)}` : out;
}

function tiltWords(s) {
  if (!s.tilt) return '';
  const word = Object.entries(TILT_DIRS).find(([, v]) => v === s.dir)?.[0];
  const d = s.dir === DEFAULT_TILT_DIR ? '' : word ? ` ${word}` : ` напр ${s.dir}`;
  return `наклон ${fmt(s.tilt)}${d}`;
}

function apexWords(s) {
  const out = [];
  if (s.over) {
    const letters = baseLetters(s.kind === 'tetra' ? 3 : s.n, s.apex || null);
    out.push(`над ${s.over.map((i) => letters[i]).join('')}`);
  }
  if (s.shift) out.push(`сдвиг ${fmt(s.shift[0])} ${fmt(s.shift[1])}`);
  return out.join(' ');
}

const join = (...parts) => parts.filter(Boolean).join(' ');

function bodyShapeLine(s) {
  switch (s.kind) {
    case 'cube': return `куб ${fmt(s.a)}`;
    case 'box': return join(`параллелепипед ${fmt(s.a)} ${fmt(s.b)} ${fmt(s.c)}`, baseWord(s), tiltWords(s));
    case 'prism': return join(`призма ${s.n} ${fmt(s.a)} ${fmt(s.h)}`, baseWord(s), tiltWords(s));
    case 'pyramid': return join(`пирамида ${s.n} ${fmt(s.a)} ${fmt(s.h)} ${s.apex}`, baseWord(s), apexWords(s));
    case 'frustum': return join(`усечённая пирамида ${s.n} ${fmt(s.a)} ${fmt(s.h)} ${fmt(s.k)}`, baseWord(s), apexWords(s));
    case 'tetra': return s.h
      ? join(`тетраэдр ${fmt(s.a)} ${fmt(s.h)} ${s.apex}`, baseWord(s), apexWords(s))
      : `тетраэдр ${fmt(s.a)} ${s.apex}`;
    default: return 'куб 4';
  }
}

const STILL_RE = /^(статично|статичный|static|без вращения)$/;

/** Блок помечен «статично» — в статье теории его не крутят. */
export function isStillStereoSpec(text) {
  return String(text || '').split(/\r?\n/).some((l) => STILL_RE.test(l.replace(/\/\/.*$/, '').trim().toLowerCase()));
}

/**
 * Разбор блока.
 * @returns {{ scene, camera, size: {width,height}, color: boolean, errors: {line:number, message:string}[] }}
 */
export function parseStereoBlock(text) {
  const lines = String(text || '').split(/\r?\n/);
  let scene = { body: DEFAULT_BODY, ops: [] };
  let camera = { ...DEFAULT_CAMERA };
  let size = { width: 360, height: 300 };
  let color = false;
  let still = false;
  let bodySet = false;
  const errors = [];

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const noComment = raw.replace(/^\s*#.*$/, '');
    const [cmdPart, ...noteParts] = noComment.split('//');
    const cmd = cmdPart.trim();
    const note = noteParts.join('//').trim();
    if (!cmd) return;
    const low = cmd.toLowerCase();

    if (!bodySet || !scene.ops.length) {
      const body = parseBodyLine(cmd);
      if (body) {
        if (bodySet) errors.push({ line: lineNo, message: 'Тело уже задано — оставлено первое' });
        else { scene = { body, ops: [] }; bodySet = true; }
        return;
      }
    }
    // «вершины KLMNK1L1M1N1» — свои имена вершин тела (до построений).
    let m = /^(?:вершины|vertices)\s+(.+)$/i.exec(cmd);
    if (m) {
      const names = splitNames(m[1].replace(/\s+/g, ''));
      const need = buildBody({ ...scene.body, names: undefined }).order.length;
      if (scene.ops.length) errors.push({ line: lineNo, message: 'Имена вершин — сразу после тела, до построений' });
      else if (!names || names.length !== need || new Set(names).size !== names.length) {
        errors.push({ line: lineNo, message: `Нужно ${need} разных имён вершин` });
      } else scene = { ...scene, body: normalizeBodySpec({ ...scene.body, names }) };
      return;
    }
    m = /^(?:вид|view)\s+(-?\d+(?:[.,]\d+)?)\s+(-?\d+(?:[.,]\d+)?)(?:\s+(\d+(?:[.,]\d+)?))?$/i.exec(cmd);
    if (m) {
      camera = clampCamera({ yaw: num(m[1]), pitch: num(m[2]), zoom: m[3] ? num(m[3]) : 1 });
      return;
    }
    m = /^(?:размер|size)\s+(\d+)(?:\s+(\d+))?$/i.exec(cmd);
    if (m) {
      const w = Math.min(900, Math.max(160, Number(m[1])));
      const h = m[2] ? Math.min(900, Math.max(120, Number(m[2]))) : Math.round(w * 0.83);
      size = { width: w, height: h };
      return;
    }
    if (/^(цвет|цветной|color)$/.test(low)) { color = true; return; }
    // «статично» — в статье теории блок остаётся картинкой (не крутится)
    if (STILL_RE.test(low)) { still = true; return; }

    const r = parseCommand(cmd, evaluateScene(scene));
    if (r.error) { errors.push({ line: lineNo, message: r.error }); return; }
    if (r.action === 'color') {
      const res = applyColorCommand(scene, r);
      if (res.error) errors.push({ line: lineNo, message: res.error });
      else scene = res.scene;
      return;
    }
    if (!r.op) { errors.push({ line: lineNo, message: 'Эта команда в блоке не работает' }); return; }
    const op = note ? { ...r.op, note } : r.op;
    const res = tryAppendOp(scene, op);
    if (!res.ok) { errors.push({ line: lineNo, message: res.error }); return; }
    scene = res.scene;
  });

  return { scene, camera, size, color, still, errors };
}

/**
 * Сцена → текст блока (без ограждения ```). Шаги, которые текстом не
 * выражаются, уходят комментарием. Параллельная пишется «(P||AB)».
 */
export function buildStereoBlock(scene, camera = DEFAULT_CAMERA, { color = false } = {}) {
  const out = [bodyLine(scene?.body)];
  if (scene?.body?.names?.length) out.push(`вершины ${scene.body.names.join('')}`);
  let skipped = 0;
  const opsById = {};
  for (const op of scene?.ops || []) {
    const cmd = opToCommand(op, opsById);
    opsById[op.id] = op;
    if (!cmd) { skipped += 1; out.push(`# шаг не выражается текстом: ${op.type}`); continue; }
    out.push(op.note ? `${cmd} // ${op.note}` : cmd);
  }
  // Цвета точек — одной строкой на цвет: «цвет MNB красный».
  const byColor = {};
  for (const [name, key] of Object.entries(scene?.colors || {})) {
    if (!key) continue;
    (byColor[key] = byColor[key] || []).push(name);
  }
  const wordOf = (key) => POINT_COLORS.find((c) => c.key === key)?.label || key;
  for (const [key, names] of Object.entries(byColor)) {
    out.push(`цвет ${names.join('')} ${wordOf(key)}`);
  }
  // Цвета прямых: «цвет прямых AB, CD синий». Параллельная (ссылка на шаг)
  // текстом не выражается — её цвет в блок не попадает.
  const linesByColor = {};
  for (const [k, key] of Object.entries(scene?.lineColors || {})) {
    const ref = refOfLineColorKey(k);
    if (!key || !Array.isArray(ref)) continue;
    (linesByColor[key] = linesByColor[key] || []).push(ref.join(''));
  }
  for (const [key, lines] of Object.entries(linesByColor)) {
    out.push(`цвет ${lines.length > 1 ? 'прямых' : 'прямой'} ${lines.join(', ')} ${wordOf(key)}`);
  }
  // Цвета отрезков: «цвет отрезков AM, BK красный».
  const segsByColor = {};
  for (const [k, key] of Object.entries(scene?.segmentColors || {})) {
    const ref = refOfLineColorKey(k);
    if (!key || !Array.isArray(ref)) continue;
    (segsByColor[key] = segsByColor[key] || []).push(ref.join(''));
  }
  for (const [key, segs] of Object.entries(segsByColor)) {
    out.push(`цвет ${segs.length > 1 ? 'отрезков' : 'отрезка'} ${segs.join(', ')} ${wordOf(key)}`);
  }
  // Цвета сечений/плоскостей: «цвет сечений MNB, KLP зелёный» — по точкам
  // шага. Плоскость без своих точек (⊥ прямой) текстом не выражается.
  const polysByColor = {};
  const opById = Object.fromEntries((scene?.ops || []).map((op) => [op.id, op]));
  for (const [id, key] of Object.entries(scene?.polyColors || {})) {
    const pts = opById[id]?.pts;
    if (!key || !Array.isArray(pts) || pts.length < 3) continue;
    (polysByColor[key] = polysByColor[key] || []).push(pts.join(''));
  }
  for (const [key, polys] of Object.entries(polysByColor)) {
    out.push(`цвет ${polys.length > 1 ? 'сечений' : 'сечения'} ${polys.join(', ')} ${wordOf(key)}`);
  }
  const c = clampCamera(camera);
  out.push(`вид ${fmt(c.yaw)} ${fmt(c.pitch)}${Math.abs(c.zoom - 1) > 0.01 ? ` ${fmt(c.zoom)}` : ''}`);
  if (color) out.push('цвет');
  return { text: out.join('\n'), skipped };
}

/** Блок → SVG-строка для текста задачи/теории (ошибки — подписью под чертежом). */
export function stereoSvgFromSpec(text, { maxWidth } = {}) {
  const { scene, camera, size, color, errors } = parseStereoBlock(text);
  const frame = renderStereo(evaluateScene(scene), camera, size);
  const box = contentBox(frame);
  const svg = stereoSvgString(frame, {
    background: false, responsive: true, mono: !color, crop: true,
    maxWidth: Math.min(maxWidth || size.width, box ? box.w : size.width),
  });
  if (!errors.length) return svg;
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const list = errors.slice(0, 3).map((e) => `строка ${e.line}: ${esc(e.message)}`).join('; ');
  return `${svg}<span class="stereo-svg-errors" style="display:block;color:#b91c1c;font-size:12px">${list}</span>`;
}

/**
 * Стереочертёж для печати — построенный под своё место на бумаге, а не
 * ужатый картинкой (как planimPrintFrame). Буквы и линии у рендера постоянного
 * размера в единицах кадра, кадр берётся в единицах «буква = letterMm»
 * (k = 17 / letterMm на мм), а масштаб тела подбирается так, чтобы тело вместе
 * с подписями влезло в место widthMm × heightMm. Ракурс — из чертежа.
 *
 * @returns {{ svg: string, widthMm: number, heightMm: number }}
 */
export function stereoPrintFrame(scene, camera, { widthMm, heightMm, letterMm, color = false }) {
  const k = LABEL_SIZE / letterMm;
  const W = widthMm * k;
  const H = heightMm * k;
  const model = evaluateScene(scene);
  const cam = clampCamera(camera);
  const radius = Math.max(model.radius || model.body.size / 2, 1e-6);
  const zoom = cam.zoom || 1;
  // Масштаб проектора = (min(сторона)/2 − 28) / radius · zoom: квадратная рамка
  // нужной стороны даёт ровно нужный масштаб, лишнее срезает обрезка.
  const PAD = 28;
  const minScale = (41 * zoom) / radius;
  const at = (scale) => {
    const v = 2 * ((Math.max(scale, minScale) * radius) / zoom + PAD);
    const frame = renderStereo(model, cam, { width: v, height: v });
    return { frame, box: contentBox(frame), scale };
  };
  // Габарит ≈ поля (подписи, постоянные) + тело (растёт с масштабом): два
  // замера дают обе части, третий — сам чертёж, дальше — уточнение.
  const a = at(minScale * 1.2);
  const b = at(minScale * 4);
  let cur = b;
  if (a.box && b.box) {
    const dw = (b.box.w - a.box.w) / (b.scale - a.scale);
    const dh = (b.box.h - a.box.h) / (b.scale - a.scale);
    const ow = a.box.w - dw * a.scale;
    const oh = a.box.h - dh * a.scale;
    let s = Math.min((W - ow) / Math.max(dw, 1e-9), (H - oh) / Math.max(dh, 1e-9));
    cur = at(Math.max(minScale, s));
    for (let i = 0; i < 6 && cur.box && (cur.box.w > W + 0.5 || cur.box.h > H + 0.5); i++) {
      s = cur.scale * Math.min(W / cur.box.w, H / cur.box.h) * 0.99;
      if (s <= minScale) { cur = at(minScale); break; }
      cur = at(s);
    }
  }
  const svg = stereoSvgString(cur.frame, { background: false, mono: !color, crop: true, unitsPerMm: k });
  return { svg, widthMm: cur.box ? cur.box.w / k : 0, heightMm: cur.box ? cur.box.h / k : 0 };
}

/** Блок → SVG для печати под место widthMm × heightMm с буквой letterMm. */
export function stereoPrintSvgFromSpec(text, { widthMm, heightMm, letterMm }) {
  const { scene, camera, color, errors } = parseStereoBlock(text);
  const { svg } = stereoPrintFrame(scene, camera, { widthMm, heightMm, letterMm, color });
  if (!errors.length) return svg;
  const esc = (x) => String(x).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const list = errors.slice(0, 3).map((e) => `строка ${e.line}: ${esc(e.message)}`).join('; ');
  return `${svg}<span class="stereo-svg-errors" style="display:block;color:#b91c1c;font-size:12px">${list}</span>`;
}

// --- стереочертёж как чертёж геометрической задачи ------------------------------
//
// У геометрической задачи чертёж живёт отдельно от текста (drawing_svg +
// макет печати). Стереочертёж кладётся туда SVG-картинкой, а исходник блока —
// комментарием внутри SVG: по нему чертёж снова открывается в конструкторе.
// Комментарий при показе вырезает санитайзер — на картинку он не влияет.

const SPEC_RE = /<!--stereo:([A-Za-z0-9+/=]+)-->/;

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** SVG-чертёж для задачи с исходником внутри. */
export function stereoDrawingSvg(scene, camera, { color = false, width = 520, height = 440 } = {}) {
  const frame = renderStereo(evaluateScene(scene), clampCamera(camera), { width, height });
  // Резиновый и обрезанный по содержимому — как SVG из GeoGebra: размер на
  // листе задаёт макет задачи.
  const svg = stereoSvgString(frame, { background: false, mono: !color, crop: true, responsive: true })
    .replace(/style="max-width:[^"]*"/, 'style="width:100%;height:auto;display:block;"');
  const spec = buildStereoBlock(scene, camera, { color }).text;
  return svg.replace(/^(<svg[^>]*>)/, `$1<!--stereo:${toBase64(spec)}-->`);
}

/** Исходник стереочертежа из SVG задачи; null — это не стереочертёж. */
export function stereoSpecFromSvg(svg) {
  const m = SPEC_RE.exec(String(svg || ''));
  if (!m) return null;
  try { return fromBase64(m[1]); } catch { return null; }
}

/** Блок для вставки в текст: с оградой и пустыми строками вокруг. */
export function stereoBlockMarkdown(scene, camera, {
  color = false, size = null, format = 'block', still = false,
} = {}) {
  let { text } = buildStereoBlock(scene, camera, { color });
  if (size && (size.width !== 360 || size.height !== 300)) text += `\nразмер ${size.width} ${size.height}`;
  if (still) text += '\nстатично';
  // В строку — для ячейки таблицы: `stereo: куб 4; …` (см. inline.js).
  if (format === 'inline') return `\`stereo: ${stereoInlineFromSpec(text)}\``;
  return `\n\`\`\`stereo\n${text}\n\`\`\`\n`;
}

/** Исходник первого блока ```stereo в markdown (решение задачи); null — блока нет. */
export function stereoSpecFromMarkdown(md) {
  const m = /```stereo[ \t]*\r?\n([\s\S]*?)\r?\n```/.exec(String(md || ''));
  return m ? m[1] : null;
}

// --- «Открыть в стереоредакторе» -------------------------------------------
//
// Карточка задачи кладёт построение в sessionStorage и переходит в редактор;
// редактор при открытии забирает его (с переспросом, если в черновике есть
// несохранённое). Через sessionStorage, а не состояние роутера: редактор
// живёт и без роутера (окно задачи, тесты).

export const STEREO_OPEN_KEY = 'stereo.editor.open';

/** Положить сцену «на вход» стереоредактору. */
export function requestOpenInStereoEditor(scene, camera = null) {
  try {
    sessionStorage.setItem(STEREO_OPEN_KEY, JSON.stringify({ scene, camera }));
    return true;
  } catch {
    return false;
  }
}

/** Забрать сцену «со входа» (один раз); null — ничего не просили. */
export function takeStereoOpenRequest() {
  try {
    const raw = sessionStorage.getItem(STEREO_OPEN_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STEREO_OPEN_KEY);
    const req = JSON.parse(raw);
    return req?.scene?.body && Array.isArray(req.scene.ops) ? req : null;
  } catch {
    return null;
  }
}
