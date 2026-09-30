// Текстовый формат планиметрического чертежа — блок ```planim в задачах и теории.
//
//   ```planim
//   треугольник ABC 5 6 7
//   H = высота B AC        // подпись к шагу — после двух косых
//   M = медиана B AC
//   угол BAC 30
//   равны AM MC
//   пунктир BH
//   ```
//
// Строки — команды строки редактора (commands.js), служебные: «размер ширина
// [высота]», «сетка» (клетчатый фон 1×1 — задачи «на клетчатой бумаге»),
// «цвет» (по умолчанию чертёж ч/б — печатный стек Lemma печатает только
// чёрным). Строки с «#» — комментарии. Ошибка строки не рушит чертёж: шаг
// пропускается, ошибка возвращается с номером строки.

import { evaluateScene, tryAppendOps, applyAction } from './scene';
import { parseCommand, opToCommand } from './commands';
import { circleRefText } from './refs';
import {
  renderPlanim, planimSvgString, contentBox, fitView, POINT_COLORS,
} from './render';
import { planimInlineFromSpec } from './inline';

export const DEFAULT_SIZE = Object.freeze({ width: 300, height: 240 });

/**
 * Разбор блока.
 * @returns {{ scene, size: {width,height}, color: boolean, grid: boolean, errors: {line:number, message:string}[] }}
 */
export function parsePlanimBlock(text) {
  const lines = String(text || '').split(/\r?\n/);
  let scene = { ops: [] };
  let size = { ...DEFAULT_SIZE };
  let color = false;
  let grid = false;
  const errors = [];

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    const noComment = raw.replace(/^\s*#.*$/, '');
    const [cmdPart, ...noteParts] = noComment.split('//');
    const cmd = cmdPart.trim();
    const note = noteParts.join('//').trim();
    if (!cmd) return;
    const low = cmd.toLowerCase();

    const m = /^(?:размер|size)\s+(\d+)(?:\s+(\d+))?$/i.exec(cmd);
    if (m) {
      const w = Math.min(900, Math.max(100, Number(m[1])));
      const h = m[2] ? Math.min(900, Math.max(80, Number(m[2]))) : Math.round(w * 0.8);
      size = { width: w, height: h };
      return;
    }
    if (/^(цвет|цветной|color)$/.test(low)) { color = true; return; }
    if (/^(сетка|клетка|клетки|grid)$/.test(low)) { grid = true; return; }

    const r = parseCommand(cmd, evaluateScene(scene));
    if (r.error) { errors.push({ line: lineNo, message: r.error }); return; }
    if (r.action === 'undo') { errors.push({ line: lineNo, message: 'Эта команда в блоке не работает' }); return; }
    if (r.action) {
      const res = applyAction(scene, r);
      if (res.error) errors.push({ line: lineNo, message: res.error });
      else scene = res.scene;
      return;
    }
    const ops = r.ops || [r.op];
    if (note && ops.length) ops[0] = { ...ops[0], note };
    const res = tryAppendOps(scene, ops);
    if (!res.ok) { errors.push({ line: lineNo, message: res.error }); return; }
    scene = res.scene;
  });

  return { scene, size, color, grid, errors };
}

/**
 * Сцена → текст блока (без ограждения ```).
 * @returns {{ text, skipped }} skipped — сколько шагов текстом не выразились
 */
export function buildPlanimBlock(scene, { color = false, grid = false, size = null } = {}) {
  const out = [];
  let skipped = 0;
  const wordOf = (key) => POINT_COLORS.find((c) => c.key === key)?.label || key;
  for (const op of scene?.ops || []) {
    const cmd = opToCommand(op);
    if (!cmd) { skipped += 1; out.push(`# шаг не выражается текстом: ${op.type}`); continue; }
    out.push(op.note ? `${cmd} // ${op.note}` : cmd);
    // Оформление самой окружности живёт в её шаге.
    if (op.type === 'circle') {
      const ref = circleRefText(op.circle);
      if (ref && op.color) out.push(`цвет ${ref} ${wordOf(op.color)}`);
      if (ref && op.dash) out.push(`пунктир ${ref}`);
    }
  }
  // Цвета точек — одной строкой на цвет: «цвет MNB красный».
  const byColor = {};
  for (const [name, key] of Object.entries(scene?.colors || {})) {
    if (key) (byColor[key] = byColor[key] || []).push(name);
  }
  for (const [key, names] of Object.entries(byColor)) out.push(`цвет ${names.join('')} ${wordOf(key)}`);
  // Стиль отрезков: «цвет отрезков AB, CD красный», «пунктир CH, BK».
  const segByColor = {};
  const dashed = [];
  for (const [k, st] of Object.entries(scene?.segStyles || {})) {
    const seg = k.split('-').join('');
    if (st?.color) (segByColor[st.color] = segByColor[st.color] || []).push(seg);
    if (st?.dash) dashed.push(seg);
  }
  for (const [key, segs] of Object.entries(segByColor)) {
    out.push(`цвет ${segs.length > 1 ? 'отрезков' : 'отрезка'} ${segs.join(', ')} ${wordOf(key)}`);
  }
  if (dashed.length) out.push(`пунктир ${dashed.join(', ')}`);
  if (scene?.hidden?.length) out.push(`скрыть ${scene.hidden.join('')}`);
  for (const [name, a] of Object.entries(scene?.labelAngles || {})) out.push(`метка ${name} ${Math.round(a)}`);
  if (size && (size.width !== DEFAULT_SIZE.width || size.height !== DEFAULT_SIZE.height)) {
    out.push(`размер ${size.width} ${size.height}`);
  }
  if (grid) out.push('сетка');
  if (color) out.push('цвет');
  return { text: out.join('\n'), skipped };
}

/** Кадр сцены, вписанный в рамку size (для статичной картинки). */
export function planimFrame(scene, { size = DEFAULT_SIZE, grid = false } = {}) {
  const model = evaluateScene(scene);
  const view = fitView(model, size, { padding: Math.min(26, size.width * 0.1), maxScale: 400 });
  return renderPlanim(model, view, size, { grid, gridStep: 1 });
}

/** Блок → SVG-строка для текста задачи/теории (ошибки — подписью под чертежом). */
export function planimSvgFromSpec(text, { maxWidth } = {}) {
  const { scene, size: full, color, grid, errors } = parsePlanimBlock(text);
  // Узкое место (ячейка таблицы) — чертёж строится сразу в меньшей рамке, а не
  // ужимается картинкой: буквы и пометки остаются своего размера.
  const size = maxWidth && maxWidth < full.width
    ? { width: maxWidth, height: Math.round((full.height * maxWidth) / full.width) }
    : full;
  const frame = planimFrame(scene, { size, grid });
  const box = contentBox(frame);
  const svg = planimSvgString(frame, {
    background: false, responsive: true, mono: !color, crop: true,
    maxWidth: box ? Math.max(box.w, 40) : size.width,
  });
  if (!errors.length) return svg;
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const list = errors.slice(0, 3).map((e) => `строка ${e.line}: ${esc(e.message)}`).join('; ');
  return `${svg}<span class="stereo-svg-errors" style="display:block;color:#b91c1c;font-size:12px">${list}</span>`;
}

// --- чертёж как чертёж геометрической задачи ------------------------------------
//
// У геометрической задачи чертёж живёт отдельно от текста (drawing_svg + макет
// печати). Планиметрический чертёж кладётся туда SVG-картинкой, а исходник
// блока — комментарием внутри SVG: по нему чертёж снова открывается в
// редакторе. Комментарий при показе вырезает санитайзер.

const SPEC_RE = /<!--planim:([A-Za-z0-9+/=]+)-->/;

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
export function planimDrawingSvg(scene, { color = false, grid = false, width = 520, height = 440 } = {}) {
  const frame = planimFrame(scene, { size: { width, height }, grid });
  // Резиновый и обрезанный по содержимому — как SVG из GeoGebra: размер на
  // листе задаёт макет задачи.
  const svg = planimSvgString(frame, { background: false, mono: !color, crop: true, responsive: true })
    .replace(/style="max-width:[^"]*"/, 'style="width:100%;height:auto;display:block;"');
  const spec = buildPlanimBlock(scene, { color, grid }).text;
  return svg.replace(/^(<svg[^>]*>)/, `$1<!--planim:${toBase64(spec)}-->`);
}

/** Исходник чертежа из SVG задачи; null — это не планиметрический чертёж. */
export function planimSpecFromSvg(svg) {
  const m = SPEC_RE.exec(String(svg || ''));
  if (!m) return null;
  try { return fromBase64(m[1]); } catch { return null; }
}

/** Блок для вставки в текст: с оградой и пустыми строками вокруг. */
export function planimBlockMarkdown(scene, { color = false, grid = false, size = null, format = 'block' } = {}) {
  const { text } = buildPlanimBlock(scene, { color, grid, size });
  // В строку — для ячейки таблицы: `planim: …` (см. inline.js).
  if (format === 'inline') return `\`planim: ${planimInlineFromSpec(text)}\``;
  return `\n\`\`\`planim\n${text}\n\`\`\`\n`;
}
