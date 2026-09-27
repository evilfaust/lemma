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
import { evaluateScene, tryAppendOp } from './scene';
import { parseCommand, opToCommand } from './commands';
import { DEFAULT_CAMERA, clampCamera } from './camera';
import { renderStereo, stereoSvgString } from './render';

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
    let m = /^(?:вид|view)\s+(-?\d+(?:[.,]\d+)?)\s+(-?\d+(?:[.,]\d+)?)(?:\s+(\d+(?:[.,]\d+)?))?$/i.exec(cmd);
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
 * выражаются (ссылка на «параллельную» по id), уходят комментарием.
 */
export function buildStereoBlock(scene, camera = DEFAULT_CAMERA, { color = false } = {}) {
  const out = [bodyLine(scene?.body)];
  let skipped = 0;
  for (const op of scene?.ops || []) {
    const cmd = opToCommand(op);
    if (!cmd) { skipped += 1; out.push(`# шаг не выражается текстом: ${op.type}`); continue; }
    out.push(op.note ? `${cmd} // ${op.note}` : cmd);
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
  const svg = stereoSvgString(frame, {
    background: false, responsive: true, mono: !color, maxWidth: maxWidth || size.width,
  });
  if (!errors.length) return svg;
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const list = errors.slice(0, 3).map((e) => `строка ${e.line}: ${esc(e.message)}`).join('; ');
  return `${svg}<span class="stereo-svg-errors" style="display:block;color:#b91c1c;font-size:12px">${list}</span>`;
}
