import { strToU8, zipSync } from 'fflate';

/**
 * Маленький писатель .xlsx (Office Open XML) без внешних библиотек — только
 * zip из `fflate`. Нужен для выгрузки результатов работы в деканат: CSV
 * Excel открывает с кодировкой и разделителем «как повезёт», а здесь —
 * настоящая книга с шапкой, ширинами колонок и закреплённой строкой.
 *
 * Лист: { name, rows, cols?, freeze?, merges?, autoFilter? }
 *   rows  — массив строк, строка — массив ячеек. Ячейка: строка | число |
 *           null/'' (пусто) | { v, s } где s — имя стиля из STYLE_IDS.
 *   cols  — ширины колонок в символах (как в Excel).
 *   freeze — { row, col }: сколько строк сверху и колонок слева закрепить.
 *   merges — диапазоны вида 'A1:F1'.
 *   autoFilter — диапазон фильтра, например 'A3:H30'.
 *
 * Строки пишутся inline (`t="inlineStr"`) — без sharedStrings, Excel,
 * LibreOffice и Google Таблицы читают такое одинаково.
 */

/** Стили ячеек — индексы cellXfs в styles.xml ниже. */
export const STYLE_IDS = Object.freeze({
  normal: 0,
  bold: 1,
  header: 2, // шапка таблицы: жирный, рамка, по центру, перенос, серый фон
  cell: 3, // ячейка таблицы с рамкой
  cellCenter: 4,
  title: 5, // заголовок листа: жирный 14 pt
  total: 6, // итог: жирный с рамкой
  totalCenter: 7,
  muted: 8, // пояснение: курсив серым
});

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4">
<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="14"/><name val="Calibri"/><family val="2"/></font>
<font><i/><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="3">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFEDEFF2"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FF9A9A9A"/></left><right style="thin"><color rgb="FF9A9A9A"/></right><top style="thin"><color rgb="FF9A9A9A"/></top><bottom style="thin"><color rgb="FF9A9A9A"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** Номер колонки (0 → A, 25 → Z, 26 → AA). */
export function columnLetter(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Адрес ячейки: (0, 0) → A1. */
export function cellRef(row, col) {
  return `${columnLetter(col)}${row + 1}`;
}

// Управляющие символы XML 1.0 не допускает вовсе — Excel откажется открыть файл.
// eslint-disable-next-line no-control-regex
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

export function escapeXml(text) {
  return String(text)
    .replace(INVALID_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Имя листа по правилам Excel: до 31 символа, без []:*?/\ и без апострофа по
 * краям; повтор в книге получает « (2)».
 */
export function safeSheetName(name, taken = new Set()) {
  let base = String(name || 'Лист').replace(/[[\]:*?/\\]/g, ' ').replace(/^'+|'+$/g, '').trim() || 'Лист';
  base = base.slice(0, 31);
  let candidate = base;
  for (let i = 2; taken.has(candidate.toLowerCase()); i++) {
    const suffix = ` (${i})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

function normalizeCell(cell) {
  if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
    return { v: cell.v, s: STYLE_IDS[cell.s] ?? 0 };
  }
  return { v: cell, s: 0 };
}

function cellXml(cell, row, col) {
  const { v, s } = normalizeCell(cell);
  const ref = cellRef(row, col);
  const style = s ? ` s="${s}"` : '';
  if (v === null || v === undefined || v === '') {
    return s ? `<c r="${ref}"${style}/>` : '';
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return `<c r="${ref}"${style}><v>${v}</v></c>`;
  }
  if (typeof v === 'boolean') {
    return `<c r="${ref}"${style} t="b"><v>${v ? 1 : 0}</v></c>`;
  }
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
}

export function sheetXml(sheet) {
  const rows = sheet.rows || [];
  const parts = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
      + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
  ];

  const freeze = sheet.freeze;
  if (freeze && (freeze.row > 0 || freeze.col > 0)) {
    const r = freeze.row || 0;
    const c = freeze.col || 0;
    const pane = r > 0 && c > 0 ? 'bottomRight' : r > 0 ? 'bottomLeft' : 'topRight';
    parts.push(
      '<sheetViews><sheetView workbookViewId="0">'
      + `<pane${c ? ` xSplit="${c}"` : ''}${r ? ` ySplit="${r}"` : ''} topLeftCell="${cellRef(r, c)}" activePane="${pane}" state="frozen"/>`
      + `<selection pane="${pane}" activeCell="${cellRef(r, c)}" sqref="${cellRef(r, c)}"/>`
      + '</sheetView></sheetViews>',
    );
  }

  if (Array.isArray(sheet.cols) && sheet.cols.length) {
    parts.push('<cols>');
    sheet.cols.forEach((w, i) => {
      if (w) parts.push(`<col min="${i + 1}" max="${i + 1}" width="${Number(w)}" customWidth="1"/>`);
    });
    parts.push('</cols>');
  }

  parts.push('<sheetData>');
  rows.forEach((row, r) => {
    const cells = (row || []).map((cell, c) => cellXml(cell, r, c)).join('');
    parts.push(cells ? `<row r="${r + 1}">${cells}</row>` : `<row r="${r + 1}"/>`);
  });
  parts.push('</sheetData>');

  if (sheet.autoFilter) parts.push(`<autoFilter ref="${sheet.autoFilter}"/>`);

  if (Array.isArray(sheet.merges) && sheet.merges.length) {
    parts.push(`<mergeCells count="${sheet.merges.length}">`);
    sheet.merges.forEach((m) => parts.push(`<mergeCell ref="${m}"/>`));
    parts.push('</mergeCells>');
  }

  parts.push('<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>');
  parts.push('</worksheet>');
  return parts.join('');
}

/** Части книги как { путь: строка XML } — удобно и для zip, и для тестов. */
export function workbookParts(sheets) {
  const taken = new Set();
  const named = (sheets || []).map((s) => ({ ...s, name: safeSheetName(s.name, taken) }));
  if (!named.length) named.push({ name: 'Лист1', rows: [] });

  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + named.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
      + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
      + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
      + '</Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
      + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
      + '</Relationships>',
    'docProps/core.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
      + 'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
      + 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
      + '<dc:creator>Lemma</dc:creator></cp:coreProperties>',
    'docProps/app.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">'
      + '<Application>Lemma</Application></Properties>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
      + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
      + '<sheets>'
      + named.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
      + '</sheets>'
      + (named.some((s) => s.autoFilter)
        ? `<definedNames>${named.map((s, i) => (s.autoFilter
          ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${escapeXml(s.name).replace(/'/g, "''")}'!${absRange(s.autoFilter)}</definedName>`
          : '')).join('')}</definedNames>`
        : '')
      + '</workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + named.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
      + '</Relationships>',
    'xl/styles.xml': STYLES_XML,
  };
  named.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s); });
  return files;
}

function absRange(range) {
  return String(range).split(':').map((ref) => ref.replace(/^([A-Z]+)(\d+)$/, '$$$1$$$2')).join(':');
}

/** Книга целиком → байты .xlsx. */
export function buildXlsx(sheets) {
  const parts = workbookParts(sheets);
  const zipInput = {};
  for (const [path, xml] of Object.entries(parts)) zipInput[path] = strToU8(xml);
  return zipSync(zipInput, { level: 6 });
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Имя файла без запрещённых в Windows/macOS символов. */
export function safeFileName(name, ext = 'xlsx') {
  const base = String(name || 'таблица').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'таблица';
  return `${base}.${ext}`;
}

/** Скачать книгу в браузере. */
export function downloadXlsx(sheets, fileName) {
  const bytes = buildXlsx(sheets);
  const blob = new Blob([bytes], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeFileName(fileName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
