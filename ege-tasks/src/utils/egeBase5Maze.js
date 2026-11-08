import { rand, randInt } from './linearExpr';

function makeTree() {
  const root = { depth: 0 };
  const leaves = [root];
  const exitCount = randInt(5, 9);
  while (leaves.length < exitCount) {
    const leaf = rand(leaves.filter(node => node.depth < 4));
    leaf.children = [{ depth: leaf.depth + 1 }, { depth: leaf.depth + 1 }];
    leaves.splice(leaves.indexOf(leaf), 1, ...leaf.children);
  }
  return { root, leaves };
}

function mazeDrawing(root, leaves) {
  const points = new Map();
  const corridors = [];
  const labels = [];
  const exitX = 12;

  function point(x, y) {
    const coordinates = `(${x}; ${y})`;
    if (!points.has(coordinates)) points.set(coordinates, `P${points.size + 1}`);
    return points.get(coordinates);
  }

  function connect(x1, y1, x2, y2) {
    corridors.push(`отрезок ${point(x1, y1)}${point(x2, y2)}`);
  }

  leaves.forEach((leaf, index) => { leaf.y = (leaves.length - 1 - index) * 2; });
  function draw(node) {
    const x = 2 + node.depth * 2;
    if (!node.children) {
      connect(x, node.y, exitX, node.y);
      labels.push(`текст (${exitX + 1}; ${node.y}) ${node.label}`);
      return;
    }
    node.children.forEach(draw);
    const [upper, lower] = node.children;
    node.y = (upper.y + lower.y) / 2;
    for (const child of node.children) {
      connect(x, node.y, x, child.y);
      connect(x, child.y, x + 2, child.y);
    }
  }
  draw(root);
  connect(0, root.y, 2, root.y);
  return [
    'размер 440 290',
    ...Array.from(points, ([coordinates, id]) => `${id} = ${coordinates}`),
    ...corridors,
    ...Array.from(points.values(), id => `скрыть ${id}`),
    `текст (-1.4; ${root.y}) Вход`,
    ...labels,
  ].join('\n');
}

export function makeEgeBase5Maze() {
  const { root, leaves } = makeTree();
  leaves.forEach((leaf, index) => { leaf.label = 'ABCDEFGHI'[index]; });
  const target = rand(leaves.filter(leaf => leaf.depth >= 2));
  const encode = node => node.children ? node.children.map(encode) : Number(node === target);
  const statement = [
    `На схеме изображены коридоры лабиринта. Паук начинает путь у входа и не возвращается по коридору, из которого пришёл. На каждом разветвлении он с равной вероятностью выбирает один из путей вперёд. Какова вероятность, что паук доберётся до выхода ${target.label}?`,
    '',
    '```planim',
    mazeDrawing(root, leaves),
    '```',
  ].join('\n');
  return {
    statement,
    denominator: 2 ** target.depth,
    model: ['maze', encode(root)],
  };
}
