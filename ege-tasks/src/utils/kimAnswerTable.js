// Таблица-бланк «А Б В Г» в КИМ-буклете.
//
// Задания на соответствие несут в условии таблицу для ответа — шапка из букв
// и пустая строка под ней (так их отдаёт «Решу ЕГЭ», так их собирает заготовка
// «Соответствие + бланк ответа»). А буклет КИМ под каждым заданием печатает
// ещё и строку «Ответ: ____», — места для ответа выходило два. В бланке ФИПИ
// таблица стоит прямо после слова «Ответ:», поэтому буклет вынимает её из
// условия и печатает на месте черты (KimAnswer в worksheet/KimTaskContent).
//
// Модуль чистый — разбор покрыт юнит-тестами.

// Строка-директива оформления таблицы: «{бланк}», «{без линий}»…
const DIRECTIVE_LINE = /^\s*\{\s*[^{}]+\s*\}\s*$/;

const isTableish = (line) => {
  const t = (line || '').trim();
  return t.length > 1 && t.startsWith('|') && t.endsWith('|');
};

const cellsOf = (line) => line.trim().slice(1, -1).split('|').map((c) => c.trim());

const isDelimiter = (line) => isTableish(line) && cellsOf(line).every((c) => /^:?-+:?$/.test(c));

// Буква бланка: «А», «Б», «A» (латиница из импорта «Решу»), «А)» тоже годится.
const LETTER = /^[А-ЯЁA-Z]\)?$/;

/**
 * Находит в условии ЕДИНСТВЕННУЮ таблицу-бланк (шапка — буквы, тело — только
 * пустые клетки) и вынимает её вместе с директивой перед ней.
 *
 * @param {string} md — условие задачи
 * @returns {null | { text: string, letters: string[] }} — null, если бланка нет
 *   или их несколько (тогда задача печатается как есть).
 */
export function splitAnswerTable(md) {
  if (typeof md !== 'string' || md.indexOf('|') === -1) return null;
  const lines = md.split('\n');
  const found = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!isTableish(lines[i]) || (i > 0 && isTableish(lines[i - 1]))) continue;
    let end = i;
    while (end + 1 < lines.length && isTableish(lines[end + 1])) end += 1;

    const header = cellsOf(lines[i]);
    const body = lines.slice(i + 2, end + 1);
    const blank = isDelimiter(lines[i + 1] || '')
      && body.length > 0
      && body.every((row) => cellsOf(row).every((c) => c === ''))
      && header.length >= 2
      && header.every((c) => LETTER.test(c));

    if (blank) {
      // Директива «{бланк}» над таблицей уходит вместе с ней — иначе осталась
      // бы в тексте голой строкой в фигурных скобках.
      let start = i;
      let j = i - 1;
      while (j >= 0 && lines[j].trim() === '') j -= 1;
      while (j >= 0 && DIRECTIVE_LINE.test(lines[j])) {
        start = j;
        j -= 1;
        while (j >= 0 && lines[j].trim() === '') j -= 1;
      }
      found.push({ start, end, letters: header.map((c) => c.replace(/\)$/, '')) });
    }
    i = end;
  }

  if (found.length !== 1) return null;
  const [{ start, end, letters }] = found;
  const text = [...lines.slice(0, start), ...lines.slice(end + 1)]
    .join('\n')
    // хвост из пустых строк и неразрывных пробелов на месте таблицы не нужен
    .replace(/[\s ]+$/, '');
  return { text, letters };
}
