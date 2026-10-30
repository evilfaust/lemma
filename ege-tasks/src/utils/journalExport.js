import { blockKindLabel, columnScale, columnView, formatAvg, shortDay, SCALE_LABELS } from './classJournal';
import { columnLetter } from './xlsxWriter';

const cell = (v, s = 'cellCenter') => ({ v, s });

// Только обычные числа: «4+», «.4−», «w», «н», проценты и пересдачи
// остаются текстом. Подсказка пустого итога не является оценкой.
function valueOf(entry) {
  if (!entry || entry.kind === 'hint') return '';
  const text = String(entry.text || '');
  return /^\d+(?:[.,]\d+)?$/.test(text) ? Number(text.replace(',', '.')) : text;
}

const average = (value) => (value == null ? '' : Number(formatAvg(value).replace(',', '.')));

/** Вид журнала или отдельный блок → лист настоящей книги Excel. */
export function journalSheets(grid, columns, { groupName = '', block = null, blocks = [], mode = 'raw' } = {}) {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const title = block ? `${blockKindLabel(block)} · ${block.title || ''}` : 'Журнал класса';
  const withAverage = !block;
  const width = columns.length + 2 + (withAverage ? 1 : 0);
  const last = columnLetter(width - 1);
  const rows = [
    [cell(title, 'title')],
    [cell([groupName, block && shortDay(String(block.date_from || '').slice(0, 10))].filter(Boolean).join(' · '), 'muted')],
    [],
    ['№', 'Ученик', ...columns.map((col) => {
      const owner = byId.get(col.blockId);
      const label = !block && owner ? `${blockKindLabel(owner)} · ${owner.title}\n` : '';
      const view = columnView(col, mode) || columnScale(col);
      const scale = view === 'points' ? `Баллы из ${col.max_score ?? col.max ?? ''}`
        : view === 'percent' ? 'Проценты' : SCALE_LABELS[view] || '';
      return `${label}${col.title}${col.day ? ` (${shortDay(col.day)})` : ''}\n${scale}`;
    }), ...(withAverage ? ['Средний'] : [])].map((v) => cell(v, 'header')),
  ];
  const headerRow = rows.length;
  grid.rows.forEach((row, index) => {
    rows.push([
      cell(index + 1),
      cell(`${row.student.name || ''}${row.student.former ? ' (выбыл)' : ''}`, 'cell'),
      ...row.cells.map((entry, i) => cell(valueOf(entry), columns[i].role === 'total' ? 'totalCenter' : 'cellCenter')),
      ...(withAverage ? [cell(average(row.summary.avg))] : []),
    ]);
  });
  const endRow = rows.length;
  rows.push([
    cell('', 'total'), cell('Средняя оценка', 'total'),
    ...grid.colStats.map((stat) => cell(average(stat.avg), 'totalCenter')),
    ...(withAverage ? [cell('', 'totalCenter')] : []),
  ]);
  return [{
    name: block ? blockKindLabel(block) : 'Журнал', rows,
    cols: [5, 34, ...columns.map(() => 24), ...(withAverage ? [12] : [])],
    freeze: { row: headerRow, col: 2 },
    merges: [`A1:${last}1`, `A2:${last}2`],
    autoFilter: `A${headerRow}:${last}${endRow}`,
  }];
}
