// Задачи первой части на тела вращения: цилиндр, конус, шар. Ответ — число
// из бланка: объём и площадь — «делённые на π» (как в банке: «В ответе
// укажите V/π»), длины — числом (пифагоровы тройки).
//
// План задания — как в formulaTasks: тело, подписи длин на чертеже (радиус
// OA, высота SO, образующая AA1 / SA), искомый отрезок, вопрос, ответ.

const pickInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const numText = (x) => String(Math.round(x * 1000) / 1000).replace('.', ',');
const numTex = (x) => numText(x).replace(',', '{,}');
const G = (n) => ({ v: n, tex: numTex(n), label: numText(n) });

const TRIPLES = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [12, 16, 20]];
const shuffled = (rand, t) => (rand() < 0.5 ? t : [t[1], t[0], t[2]]);
const BYPI = (what) => `В ответе укажите $\\dfrac{${what}}{\\pi}$.`;

/** «в 2 раза», «в 5 раз». */
const times = (k) => `в $${k}$ ${k % 10 >= 2 && k % 10 <= 4 && !(k % 100 >= 12 && k % 100 <= 14) ? 'раза' : 'раз'}`;

function cylinder(type, rand, level) {
  const spec = (r, h) => ({ kind: 'cylinder', r, h });
  switch (type) {
    case 'fVolume': {
      if (level === 1) {
        const r = pickInt(rand, 1, 6);
        const h = pickInt(rand, 1, 9);
        return {
          spec: spec(r, h), labels: [{ ref: ['O', 'A'], g: G(r) }, { ref: ['A', 'A1'], g: G(h) }],
          question: `Радиус основания цилиндра равен $${r}$, высота равна $${h}$. Найдите объём цилиндра. ${BYPI('V')}`,
          answer: r * r * h, solution: [`$V = \\pi r^2 h = \\pi\\cdot ${r}^2\\cdot ${h} = ${r * r * h}\\pi$.`],
        };
      }
      // по диагонали осевого сечения
      const [d2, h, d] = shuffled(rand, pick(rand, TRIPLES));
      if (d2 % 2) return null;
      const r = d2 / 2;
      return {
        spec: spec(r, h), extra: [{ id: 'b', type: 'pointOnCircle', name: 'B', center: 'O', angle: 120 }, { id: 'bd', type: 'segment', ref: ['B', 'A1'] }],
        labels: [{ ref: ['A', 'A1'], g: G(h) }, { ref: ['B', 'A1'], g: G(d) }],
        question: `Осевое сечение цилиндра — прямоугольник с диагональю $${d}$, высота цилиндра равна $${h}$. Найдите объём цилиндра. ${BYPI('V')}`,
        answer: r * r * h,
        solution: [`Диаметр основания $2r = \\sqrt{${d * d} - ${h * h}} = ${d2}$, $r = ${r}$.`, `$V = \\pi r^2 h = ${r * r * h}\\pi$.`],
      };
    }
    case 'fSurface': {
      const r = pickInt(rand, 1, 6);
      const h = pickInt(rand, 1, 9);
      const side = level === 1 || rand() < 0.4;
      return {
        spec: spec(r, h), labels: [{ ref: ['O', 'A'], g: G(r) }, { ref: ['A', 'A1'], g: G(h) }],
        question: `Радиус основания цилиндра равен $${r}$, высота равна $${h}$. Найдите площадь ${side ? 'боковой' : 'полной'} поверхности цилиндра. ${BYPI('S')}`,
        answer: side ? 2 * r * h : 2 * r * (r + h),
        solution: [side
          ? `$S_{\\text{бок}} = 2\\pi r h = 2\\pi\\cdot ${r}\\cdot ${h} = ${2 * r * h}\\pi$.`
          : `$S = 2\\pi r^2 + 2\\pi r h = 2\\pi\\cdot ${r}(${r} + ${h}) = ${2 * r * (r + h)}\\pi$.`],
      };
    }
    case 'fLength':
    case 'fReverse': {
      if (type === 'fReverse' || level >= 2) {
        const r = pickInt(rand, 1, 5);
        const h = pickInt(rand, 2, 9);
        return {
          spec: spec(r, h), ask: ['A', 'A1'], labels: [{ ref: ['O', 'A'], g: G(r) }],
          question: `Объём цилиндра равен $${r * r * h}\\pi$, радиус основания равен $${r}$. Найдите высоту цилиндра.`,
          answer: h, solution: [`$V = \\pi r^2 h$, $h = \\dfrac{${r * r * h}\\pi}{${r * r}\\pi} = ${h}$.`],
        };
      }
      const [d2, h, d] = shuffled(rand, pick(rand, TRIPLES));
      if (d2 % 2) return null;
      return {
        spec: spec(d2 / 2, h), extra: [{ id: 'b', type: 'pointOnCircle', name: 'B', center: 'O', angle: 120 }], ask: ['B', 'A1'],
        labels: [{ ref: ['O', 'A'], g: G(d2 / 2) }, { ref: ['A', 'A1'], g: G(h) }],
        question: `Радиус основания цилиндра равен $${d2 / 2}$, высота равна $${h}$. Найдите диагональ осевого сечения цилиндра.`,
        answer: d, solution: [`Осевое сечение — прямоугольник $${d2}\\times ${h}$, его диагональ $\\sqrt{${d2 * d2} + ${h * h}} = ${d}$.`],
      };
    }
    default: return null;
  }
}

function cone(type, rand, level) {
  const spec = (r, h) => ({ kind: 'cone', r, h });
  const [r, h, l] = shuffled(rand, pick(rand, TRIPLES.filter((t) => t[2] <= 17)));
  switch (type) {
    case 'fVolume': {
      if (level === 1) {
        const R = pickInt(rand, 1, 6);
        const H = 3 * pickInt(rand, 1, 4);
        return {
          spec: spec(R, H), labels: [{ ref: ['O', 'A'], g: G(R) }, { ref: ['S', 'O'], g: G(H) }],
          question: `Радиус основания конуса равен $${R}$, высота равна $${H}$. Найдите объём конуса. ${BYPI('V')}`,
          answer: (R * R * H) / 3, solution: [`$V = \\dfrac13\\pi r^2 h = \\dfrac13\\pi\\cdot ${R}^2\\cdot ${H} = ${numTex((R * R * H) / 3)}\\pi$.`],
        };
      }
      return {
        spec: spec(r, h), labels: [{ ref: ['O', 'A'], g: G(r) }, { ref: ['S', 'A'], g: G(l) }],
        question: `Радиус основания конуса равен $${r}$, образующая равна $${l}$. Найдите объём конуса. ${BYPI('V')}`,
        answer: (r * r * h) / 3,
        solution: [`Высота $SO = \\sqrt{${l * l} - ${r * r}} = ${h}$.`, `$V = \\dfrac13\\pi r^2 h = ${numTex((r * r * h) / 3)}\\pi$.`],
      };
    }
    case 'fSurface': {
      const side = rand() < 0.5;
      const viaH = level >= 2;
      return {
        spec: spec(r, h),
        labels: viaH ? [{ ref: ['O', 'A'], g: G(r) }, { ref: ['S', 'O'], g: G(h) }] : [{ ref: ['O', 'A'], g: G(r) }, { ref: ['S', 'A'], g: G(l) }],
        question: `Радиус основания конуса равен $${r}$, ${viaH ? `высота равна $${h}$` : `образующая равна $${l}$`}. Найдите площадь ${side ? 'боковой' : 'полной'} поверхности конуса. ${BYPI('S')}`,
        answer: side ? r * l : r * (r + l),
        solution: [
          ...(viaH ? [`Образующая $l = \\sqrt{${r * r} + ${h * h}} = ${l}$.`] : []),
          side ? `$S_{\\text{бок}} = \\pi r l = ${r * l}\\pi$.` : `$S = \\pi r^2 + \\pi r l = \\pi\\cdot ${r}(${r} + ${l}) = ${r * (r + l)}\\pi$.`,
        ],
      };
    }
    case 'fLength': {
      if (level === 1) {
        return {
          spec: spec(r, h), ask: ['S', 'A'], labels: [{ ref: ['O', 'A'], g: G(r) }, { ref: ['S', 'O'], g: G(h) }],
          question: `Радиус основания конуса равен $${r}$, высота равна $${h}$. Найдите образующую конуса.`,
          answer: l, solution: [`$l = \\sqrt{r^2 + h^2} = \\sqrt{${r * r} + ${h * h}} = ${l}$.`],
        };
      }
      return {
        spec: spec(r, h), ask: ['S', 'O'], labels: [{ ref: ['O', 'A'], g: G(r) }, { ref: ['S', 'A'], g: G(l) }],
        question: `Радиус основания конуса равен $${r}$, образующая равна $${l}$. Найдите высоту конуса.`,
        answer: h, solution: [`$h = \\sqrt{l^2 - r^2} = \\sqrt{${l * l} - ${r * r}} = ${h}$.`],
      };
    }
    case 'fReverse': {
      const R = pickInt(rand, 1, 5);
      const H = pickInt(rand, 1, 9);
      const V = (R * R * H) / 3;
      return {
        spec: spec(R, H), ask: ['S', 'O'], labels: [{ ref: ['O', 'A'], g: G(R) }],
        question: `Объём конуса равен $${numTex(V)}\\pi$, радиус основания равен $${R}$. Найдите высоту конуса.`,
        answer: H, solution: [`$V = \\dfrac13\\pi r^2 h$, $h = \\dfrac{3V}{\\pi r^2} = \\dfrac{${numTex(3 * V)}}{${R * R}} = ${H}$.`],
      };
    }
    default: return null;
  }
}

function sphere(type, rand, level) {
  const spec = (r) => ({ kind: 'sphere', r });
  switch (type) {
    case 'fVolume': {
      const r = pick(rand, [1.5, 3, 4.5, 6]);
      return {
        spec: spec(r), labels: [{ ref: ['O', 'A'], g: G(r) }],
        question: `Радиус шара равен $${numTex(r)}$. Найдите объём шара. ${BYPI('V')}`,
        answer: (4 * r ** 3) / 3, solution: [`$V = \\dfrac43\\pi r^3 = \\dfrac43\\pi\\cdot ${numTex(r)}^3 = ${numTex((4 * r ** 3) / 3)}\\pi$.`],
      };
    }
    case 'fSurface': {
      const r = pickInt(rand, 1, 9);
      if (level >= 2) {
        return {
          spec: spec(r), labels: [],
          question: `Площадь большого круга шара равна $${r * r}\\pi$. Найдите площадь поверхности шара. ${BYPI('S')}`,
          answer: 4 * r * r, solution: [`Площадь большого круга $\\pi r^2$, поверхность шара $4\\pi r^2$ — в 4 раза больше: $${4 * r * r}\\pi$.`],
        };
      }
      return {
        spec: spec(r), labels: [{ ref: ['O', 'A'], g: G(r) }],
        question: `Радиус шара равен $${r}$. Найдите площадь его поверхности. ${BYPI('S')}`,
        answer: 4 * r * r, solution: [`$S = 4\\pi r^2 = 4\\pi\\cdot ${r}^2 = ${4 * r * r}\\pi$.`],
      };
    }
    case 'fLength':
    case 'fReverse': {
      if (type === 'fReverse' || level >= 2) {
        const r = pick(rand, [1.5, 3, 4.5, 6]);
        return {
          spec: spec(r), ask: ['O', 'A'], labels: [],
          question: `Объём шара равен $${numTex((4 * r ** 3) / 3)}\\pi$. Найдите его радиус.`,
          answer: r, solution: [`$\\dfrac43\\pi r^3 = ${numTex((4 * r ** 3) / 3)}\\pi$, $r^3 = ${numTex(r ** 3)}$, $r = ${numTex(r)}$.`],
        };
      }
      const r = pickInt(rand, 1, 9);
      return {
        spec: spec(r), ask: ['O', 'A'], labels: [],
        question: `Площадь поверхности шара равна $${4 * r * r}\\pi$. Найдите радиус шара.`,
        answer: r, solution: [`$4\\pi r^2 = ${4 * r * r}\\pi$, $r^2 = ${r * r}$, $r = ${r}$.`],
      };
    }
    default: return null;
  }
}

const WORD = {
  cylinder: { gen: 'цилиндра', its: 'его' },
  cone: { gen: 'конуса', its: 'его' },
  sphere: { gen: 'шара', its: 'его' },
};

function scale(key, rand, level) {
  const k = pickInt(rand, 2, level === 1 ? 3 : 5);
  const w = WORD[key];
  const spec = key === 'sphere' ? { kind: 'sphere', r: 2 } : { kind: key, r: 2, h: 4 };
  if (key === 'sphere') {
    const vol = rand() < 0.6;
    return {
      spec, labels: [],
      question: `Во сколько раз увеличится ${vol ? 'объём' : 'площадь поверхности'} шара, если его радиус увеличить ${times(k)}?`,
      answer: vol ? k ** 3 : k * k,
      solution: [vol ? `$V = \\dfrac43\\pi r^3$ — объём увеличится в $${k}^3 = ${k ** 3}$ раз.` : `$S = 4\\pi r^2$ — площадь увеличится в $${k}^2 = ${k * k}$ раз.`],
    };
  }
  if (level >= 2) {
    const kr = pickInt(rand, 2, 3);
    const kh = pickInt(rand, 2, 4);
    const ans = level === 3 ? (kr * kr) / kh : kr * kr * kh;
    if (level === 3) {
      return {
        spec, labels: [],
        question: `Радиус основания ${w.gen} увеличили ${times(kr)}, а высоту уменьшили ${times(kh)}. Во сколько раз увеличился объём ${w.gen}?`,
        answer: ans, solution: [`Объём пропорционален $r^2 h$: $\\dfrac{${kr}^2}{${kh}} = ${numTex(ans)}$.`],
      };
    }
    return {
      spec, labels: [],
      question: `Во сколько раз увеличится объём ${w.gen}, если радиус основания увеличить ${times(kr)}, а высоту — ${times(kh)}?`,
      answer: ans, solution: [`Объём пропорционален $r^2 h$: $${kr}^2\\cdot ${kh} = ${ans}$.`],
    };
  }
  return {
    spec, labels: [],
    question: `Во сколько раз увеличится объём ${w.gen}, если радиус основания увеличить ${times(k)}, а высоту оставить прежней?`,
    answer: k * k, solution: [`Объём пропорционален квадрату радиуса: в $${k}^2 = ${k * k}$ раз.`],
  };
}

/**
 * План задачи на тело вращения.
 * @param key — cylinder | cone | sphere
 */
export function revTask(key, type, rand, level) {
  if (type === 'fScale') return scale(key, rand, level);
  const fn = { cylinder, cone, sphere }[key];
  if (!fn) return null;
  const plan = fn(type, rand, level);
  // Вспомогательные точки (B на окружности) в условии не названы — не подписываем
  if (plan) plan.hide = (plan.extra || []).map((o) => o.name).filter(Boolean);
  return plan;
}

// ─── комбинации тел ─────────────────────────────────────────────────────────

const group = (...parts) => ({ kind: 'group', parts });

/**
 * Задача на комбинацию тел: шар в цилиндре, конус и цилиндр с общим
 * основанием, две кружки, шар в кубе. meta — какие величины частей
 * сравниваются (для проверки в тестах).
 */
export function comboTask(type, rand, level) {
  switch (type) {
    case 'fVolume': {
      // Цилиндр описан около шара: V_ц = 3/2 V_ш
      const Vs = 2 * pickInt(rand, 2, 30);
      return {
        spec: group({ kind: 'cylinder', r: 2, h: 4, frame: true, at: [0, 0, 0] }, { kind: 'sphere', r: 2, at: [0, 0, 0] }),
        labels: [],
        question: `Цилиндр описан около шара. Объём шара равен $${Vs}$. Найдите объём цилиндра.`,
        answer: (3 * Vs) / 2,
        solution: [
          'У цилиндра, описанного около шара радиуса $r$, радиус основания $r$ и высота $2r$.',
          `$V_{\\text{ц}} = \\pi r^2\\cdot 2r = 2\\pi r^3$, $V_{\\text{ш}} = \\dfrac43\\pi r^3$, $\\dfrac{V_{\\text{ц}}}{V_{\\text{ш}}} = \\dfrac32$; $V_{\\text{ц}} = \\dfrac32\\cdot ${Vs} = ${numTex((3 * Vs) / 2)}$.`,
        ],
        meta: { given: Vs, of: [1, 'V'], find: [0, 'V'] },
      };
    }
    case 'fSurface': {
      // Шар вписан в цилиндр: S_ц(полная) = 6πr², S_ш = 4πr²
      const Ss = 2 * pickInt(rand, 2, 30);
      return {
        spec: group({ kind: 'cylinder', r: 2, h: 4, frame: true, at: [0, 0, 0] }, { kind: 'sphere', r: 2, at: [0, 0, 0] }),
        labels: [],
        question: `Шар вписан в цилиндр. Площадь поверхности шара равна $${Ss}$. Найдите площадь полной поверхности цилиндра.`,
        answer: (3 * Ss) / 2,
        solution: [
          'Радиус основания цилиндра равен радиусу шара $r$, высота — $2r$.',
          `$S_{\\text{ц}} = 2\\pi r^2 + 2\\pi r\\cdot 2r = 6\\pi r^2$, $S_{\\text{ш}} = 4\\pi r^2$; $S_{\\text{ц}} = \\dfrac32\\cdot ${Ss} = ${numTex((3 * Ss) / 2)}$.`,
        ],
        meta: { given: Ss, of: [1, 'S'], find: [0, 'S'] },
      };
    }
    case 'fReverse': {
      // Конус и цилиндр с общим основанием и высотой: V_к = V_ц / 3
      const Vc = 3 * pickInt(rand, 2, 40);
      const coneInside = rand() < 0.5;
      return {
        spec: group({ kind: 'cylinder', r: 2, h: 4, frame: true, at: [0, 0, 0] }, { kind: 'cone', r: 2, h: 4, at: [0, 0, 0] }),
        labels: [],
        question: coneInside
          ? `Цилиндр и конус имеют общие основание и высоту. Объём цилиндра равен $${Vc}$. Найдите объём конуса.`
          : `Цилиндр и конус имеют общие основание и высоту. Объём конуса равен $${Vc / 3}$. Найдите объём цилиндра.`,
        answer: coneInside ? Vc / 3 : Vc,
        solution: [`$V_{\\text{к}} = \\dfrac13\\pi r^2 h = \\dfrac13 V_{\\text{ц}}$.`, `Ответ: $${coneInside ? Vc / 3 : Vc}$.`],
        meta: coneInside ? { given: Vc, of: [0, 'V'], find: [1, 'V'] } : { given: Vc / 3, of: [1, 'V'], find: [0, 'V'] },
      };
    }
    case 'fScale': {
      // Две кружки: первая в k раз выше, вторая в m раз шире
      const k = pickInt(rand, 2, 4);
      const m = pickInt(rand, 2, 3);
      if ((m * m) % k && level === 1) return null;
      const ans = (m * m) / k;
      return {
        spec: group({ kind: 'cylinder', r: 1, h: 1.2 * k, at: [0, 0, 0] }, { kind: 'cylinder', r: m, h: 1.2, at: [1 + m + 1.2, 0, 0.6 * (1 - k)] }),
        labels: [],
        question: `Даны две кружки цилиндрической формы. Первая кружка ${times(k)} выше второй, а вторая ${times(m)} шире первой. Во сколько раз объём второй кружки больше объёма первой?`,
        answer: ans,
        solution: [`Объём цилиндра $V = \\pi r^2 h$: $\\dfrac{V_2}{V_1} = \\dfrac{${m}^2\\cdot 1}{1\\cdot ${k}} = ${numTex(ans)}$.`],
        meta: { ratio: [1, 0, 'V'] },
      };
    }
    case 'fLength': {
      // Шар вписан в куб: радиус — половина ребра
      const a = 2 * pickInt(rand, 1, 6);
      return {
        spec: group({ kind: 'cube', a, frame: true, at: [0, 0, 0] }, { kind: 'sphere', r: a / 2, at: [0, 0, 0] }),
        labels: [{ ref: ['A', 'B'], g: G(a) }],
        question: `Шар вписан в куб с ребром $${a}$. Найдите радиус шара.`,
        answer: a / 2,
        solution: ['Шар касается всех граней куба, его диаметр равен ребру куба.', `$r = \\dfrac{${a}}{2} = ${numTex(a / 2)}$.`],
        meta: { sphereR: 1 },
      };
    }
    default: return null;
  }
}
