// Размер картинки в условии задачи — тот же синтаксис, что в теории:
// ![подпись](адрес){S|M|L|XL}. Токен сразу за картинкой (пробелы допустимы)
// убирается из текста, картинка получает классы `mr-img mr-img--<размер>`;
// ширины — в shared/components/imageSize.css (30/50/70/100 % колонки или
// ячейки таблицы). Без токена картинка остаётся как была — размер ей задаёт
// место вставки (карточка, печатный лист).

export const IMAGE_SIZES = ['S', 'M', 'L', 'XL'];

const SIZE_TOKEN = /^[ \t]*\{(s|m|l|xl)\}/i;

function addClass(node, ...classes) {
  node.data = node.data || {};
  node.data.hProperties = node.data.hProperties || {};
  const cur = node.data.hProperties.className;
  const list = Array.isArray(cur) ? cur : (cur ? String(cur).split(/\s+/) : []);
  classes.forEach((c) => { if (!list.includes(c)) list.push(c); });
  node.data.hProperties.className = list;
}

function walk(node) {
  const kids = node?.children;
  if (!Array.isArray(kids)) return;
  for (let i = 0; i < kids.length; i += 1) {
    const child = kids[i];
    const next = kids[i + 1];
    if (child.type === 'image' && next?.type === 'text') {
      const m = SIZE_TOKEN.exec(next.value);
      if (m) {
        addClass(child, 'mr-img', `mr-img--${m[1].toLowerCase()}`);
        next.value = next.value.slice(m[0].length);
        if (!next.value) kids.splice(i + 1, 1);
      }
    }
    walk(child);
  }
}

export default function remarkImageSize() {
  return (tree) => { walk(tree); };
}
