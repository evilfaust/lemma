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
// Первая строка — тело, дальше — команды строки редактора (commands.js),
// служебные: «вид yaw pitch [масштаб]», «размер ширина [высота]», «цвет»
// (по умолчанию чертёж ч/б — печатный стек Lemma печатает только чёрным).
// Строки с «#» — комментарии. Ошибка строки не рушит чертёж: шаг пропускается,
// ошибка возвращается с номером строки.

import { normalizeBodySpec, DEFAULT_BODY } from './bodies';
import {
  evaluateScene, tryAppendOp, applyColorCommand, refOfLineColorKey,
} from './scene';
import { parseCommand, opToCommand, splitNames } from './commands';
import { buildBody } from './bodies';
import { DEFAULT_CAMERA, clampCamera } from './camera';
import { renderStereo, stereoSvgString, contentBox, POINT_COLORS } from './render';
import { stereoInlineFromSpec } from './inline';

const num = (s) => Number(String(s).replace(',', '.'));
const isNum = (s) => /^-?\d+(?:[.,]\d+)?$/.test(String(s));

const BODY_WORDS = {
  куб: 'cube', cube: 'cube',
  параллелепипед: 'box', box: 'box',
  призма: 'prism', prism: 'prism',
  пирамида: 'pyramid', pyramid: 'pyramid',
  тетраэдр: 'tetra', tetra: 'tetra',
};

/** «призма 3 4 5» → { kind: 'prism', n: 3, a: 4, h: 5 }; не тело — null. */
export function parseBodyLine(line) {
  const words = String(line || '').trim().split(/\s+/);
  const kind = BODY_WORDS[words[0]?.toLowerCase()];
  if (!kind) return null;
  const rest = words.slice(1);
  const named = {};
  const nums = [];
  let apex = null;
  for (const w of rest) {
    const m = /^([a-z])=(-?\d+(?:[.,]\d+)?)$/i.exec(w);
    if (m) named[m[1].toLowerCase()] = num(m[2]);
    else if (isNum(w)) nums.push(num(w));
    else if (/^[A-ZА-Я]$/.test(w)) apex = w.replace('С', 'S').replace('Д', 'D');
  }
  const spec = { kind };
  // «куб 4 по часовой» — буквы основания по часовой стрелке («против часовой» — как обычно).
  if (rest.some((w) => /^(часов\S*|cw)$/i.test(w)) && !rest.some((w) => /^против$/i.test(w))) spec.cw = true;
  if (kind === 'cube') spec.a = named.a ?? nums[0];
  if (kind === 'box') { spec.a = named.a ?? nums[0]; spec.b = named.b ?? nums[1]; spec.c = named.c ?? nums[2]; }
  if (kind === 'prism' || kind === 'pyramid') {
    spec.n = named.n ?? nums[0];
    spec.a = named.a ?? nums[1];
    spec.h = named.h ?? nums[2];
  }
  if (kind === 'tetra') spec.a = named.a ?? nums[0];
  if (apex && (kind === 'pyramid' || kind === 'tetra')) spec.apex = apex;
  return normalizeBodySpec(spec);
}

const fmt = (x) => String(Math.round(Number(x) * 100) / 100);

/** Тело → строка блока. */
export function bodyLine(specIn) {
  const s = normalizeBodySpec(specIn);
  const line = bodyShapeLine(s);
  return s.cw ? `${line} по часовой` : line;
}

function bodyShapeLine(s) {
  switch (s.kind) {
    case 'cube': return `куб ${fmt(s.a)}`;
    case 'box': return `параллелепипед ${fmt(s.a)} ${fmt(s.b)} ${fmt(s.c)}`;
    case 'prism': return `призма ${s.n} ${fmt(s.a)} ${fmt(s.h)}`;
    case 'pyramid': return `пирамида ${s.n} ${fmt(s.a)} ${fmt(s.h)} ${s.apex}`;
    case 'tetra': return `тетраэдр ${fmt(s.a)} ${s.apex}`;
    default: return 'куб 4';
  }
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

  return { scene, camera, size, color, errors };
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
export function stereoBlockMarkdown(scene, camera, { color = false, size = null, format = 'block' } = {}) {
  let { text } = buildStereoBlock(scene, camera, { color });
  if (size && (size.width !== 360 || size.height !== 300)) text += `\nразмер ${size.width} ${size.height}`;
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
