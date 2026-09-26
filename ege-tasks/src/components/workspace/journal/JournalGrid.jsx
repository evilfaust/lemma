import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dropdown } from 'antd';
import {
  CalendarOutlined, ClockCircleOutlined, DownOutlined, EditOutlined, EyeInvisibleOutlined, MobileOutlined,
} from '@ant-design/icons';
import {
  shortDay, headerSpans, formatAvg, formatNumber, GRADE_TONE, columnWeight, editText,
  startsBlockSection, ROLE_LABELS,
} from '../../../utils/classJournal';
import { groupHex } from '../ui';

/**
 * Сетка журнала: ученики × колонки, ввод как в таблице.
 *
 *   клик — выбрать клетку, двойной клик / Enter / F2 — править;
 *   цифра или буква — сразу ввод поверх; Enter — записать и вниз,
 *   Tab — вправо, Esc — отмена, Delete — очистить; Ctrl+V — вставить блок
 *   из Google Таблиц/Excel начиная с выбранной клетки; Ctrl+C — значение.
 *
 * Запись — через `onCommit(c, r, raw)`: родитель разбирает ввод по шкале
 * колонки и возвращает текст ошибки (редактор остаётся открытым) или null.
 */

// Ширины продублированы в journal.css (scroll-padding, right у итогов).
const NAME_W = 190;
const COL_W = 84;
const SUM_W = 56;

function scaleLabel(col) {
  if (col.online) return 'онлайн';
  switch (col.scale) {
    case 'points': return col.max_score ? `из ${formatNumber(col.max_score)}` : 'баллы';
    case 'grade': return '2–5';
    case 'pass': return 'зачёт';
    case 'percent': return '%';
    default: return '';
  }
}

function columnTip(col, block) {
  return [
    col.title,
    col.day ? `дата ${shortDay(col.day)}` : null,
    block ? `интенсив «${block.title}» · ${(ROLE_LABELS[col.role] || '').toLowerCase()}` : null,
    block && col.role !== 'total' ? 'в средний за год интенсив идёт итогом' : null,
    col.category || null,
    col.lessonLabel ? `урок: ${col.lessonLabel} — «н» из посещаемости` : null,
    col.ref?.type === 'sheet' ? `лист генератора: «${col.ref.title || ''}»` : null,
    col.online ? (col.virtual ? 'онлайн-работа: результаты из попыток учеников' : 'онлайн-работа') : null,
    columnWeight(col) === 0 ? 'не входит в средний' : columnWeight(col) !== 1 ? `вес ×${formatNumber(columnWeight(col))}` : null,
    col.note || null,
  ].filter(Boolean).join('\n');
}

// Границы интенсива в сетке: начало/конец интенсива и новый день внутри него.
function boundaryClass(columns, c) {
  const col = columns[c];
  const prev = columns[c - 1];
  if (startsBlockSection(columns, c)) return 'cj-sec';
  if (prev && (col.blockId || prev.blockId) && col.blockId !== prev.blockId) return 'cj-edge';
  return '';
}

function cellClass(cell, selected, error, extra) {
  const cls = ['cj-cell'];
  if (extra) cls.push(extra);
  if (cell.tone) cls.push(`cj-t-${cell.tone}`);
  if (cell.textTone) cls.push(`cj-x-${cell.textTone}`);
  if (selected) cls.push(error ? 'is-err' : 'is-sel');
  return cls.join(' ');
}

const Row = memo(function Row({
  r, row, columns, colClass, selC, edit, onOpenStudent, editorProps,
}) {
  const { student, cells, summary } = row;
  const avgTone = summary.avg != null ? GRADE_TONE[Math.round(summary.avg)] : null;
  return (
    <tr className={student.former ? 'cj-row--former' : undefined}>
      <td className="cj-name" title={student.name}>
        <button type="button" className="cj-name__link" onClick={() => onOpenStudent?.(student)}>
          {student.name || '—'}
        </button>
        {student.former && <span className="cj-name__tag">выбыл</span>}
      </td>
      {columns.map((col, c) => {
        const cell = cells[c];
        const editing = edit && edit.c === c;
        return (
          <td
            key={col.key}
            data-r={r}
            data-c={c}
            className={cellClass(cell, selC === c || editing, editing && edit.error, colClass[c])}
            title={editing ? edit.error || undefined : cell.tip || undefined}
          >
            {editing ? (
              <input
                {...editorProps}
                className={`cj-editor${edit.error ? ' is-err' : ''}`}
                value={edit.text}
                aria-label={`${student.name}, ${col.title}`}
                aria-invalid={!!edit.error}
              />
            ) : (
              <>
                {cell.text}
                {cell.late && <ClockCircleOutlined className="cj-late" aria-label="после срока" />}
              </>
            )}
            {cell.kind === 'override' && <i className="cj-flag cj-flag--override" />}
            {cell.comment && <i className="cj-flag cj-flag--comment" />}
          </td>
        );
      })}
      <td className={`cj-sum cj-sum--avg${avgTone ? ` cj-t-${avgTone}` : ''}`}>
        {summary.avg != null ? formatAvg(summary.avg) : <span className="cj-none">—</span>}
      </td>
      <td
        className="cj-sum"
        title={summary.debts
          ? [`не писал: ${summary.absences}`, summary.waits ? `вейтинг: ${summary.waits}` : null, `не сдал онлайн в срок: ${summary.overdue}`].filter(Boolean).join(', ')
          : undefined}
      >
        {summary.debts ? <span className="cj-debt">{summary.debts}</span> : <span className="cj-none">—</span>}
      </td>
    </tr>
  );
});

export default function JournalGrid({
  rows,
  columns,
  colStats,
  canEdit,
  menuFor,
  onMenu,
  onCommit,
  onPaste,
  onOpenStudent,
  blocks = new Map(),
  blockMenuFor,
  onBlockMenu,
}) {
  const scrollRef = useRef(null);
  const [sel, setSel] = useState(null); // { r, c }
  const [edit, setEdit] = useState(null); // { r, c, text, replace, error }
  const editRef = useRef(null);
  const [status, setStatus] = useState('');

  const nRows = rows.length;
  const nCols = columns.length;

  // Состояние правки дублируется в ref: blur редактора приходит синхронно
  // посреди нашего же focus() — по state он ещё «открыт», по ref уже нет.
  const setEditBoth = useCallback((next) => {
    editRef.current = typeof next === 'function' ? next(editRef.current) : next;
    setEdit(editRef.current);
  }, []);

  // Сменился набор колонок/учеников (период, скрытые) — выбор мог уехать.
  useEffect(() => {
    setSel((s) => (s && (s.r >= nRows || s.c >= nCols) ? null : s));
    setEditBoth(null);
  }, [nRows, nCols, setEditBoth]);

  useEffect(() => {
    if (!sel) return;
    const td = scrollRef.current?.querySelector(`td[data-r="${sel.r}"][data-c="${sel.c}"]`);
    td?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [sel]);

  const focusGrid = () => scrollRef.current?.focus({ preventScroll: true });

  const initialText = (r, c) => {
    const cell = rows[r]?.cells[c];
    return cell?.stored ? editText(columns[c], cell.stored) : '';
  };

  const moveFrom = (from, dir) => {
    if (!from) return;
    let { r, c } = from;
    if (dir === 'down') r = Math.min(nRows - 1, r + 1);
    if (dir === 'up') r = Math.max(0, r - 1);
    if (dir === 'right') c = Math.min(nCols - 1, c + 1);
    if (dir === 'left') c = Math.max(0, c - 1);
    setSel({ r, c });
  };

  const startEdit = (r, c, text, replace) => {
    if (!canEdit || !rows[r] || !columns[c]) return;
    setSel({ r, c });
    setStatus('');
    setEditBoth({ r, c, text, replace, error: '' });
  };

  const describe = (r, c) => `${rows[r]?.student?.name || 'Ученик'}, «${columns[c]?.title || ''}»`;

  // Записать правку. move — куда перейти после (или null). false = ошибка ввода.
  const commitEdit = (move) => {
    const cur = editRef.current;
    if (!cur) return true;
    const err = onCommit(cur.c, cur.r, cur.text);
    if (err) {
      setEditBoth({ ...cur, error: err });
      setStatus(`${describe(cur.r, cur.c)}: ${err}`);
      return false;
    }
    setEditBoth(null);
    setStatus('');
    if (move) moveFrom({ r: cur.r, c: cur.c }, move);
    focusGrid();
    return true;
  };

  const onEditorKeyDown = (e) => {
    e.stopPropagation();
    const cur = editRef.current;
    if (!cur) return;
    const arrows = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit(e.shiftKey ? 'up' : 'down');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditBoth(null);
      setStatus('');
      focusGrid();
    } else if (cur.replace && arrows[e.key]) {
      // Ввод «поверх» (начат с буквы/цифры) — стрелки записывают и идут дальше,
      // как в таблицах; правка через Enter/F2 оставляет стрелкам курсор.
      e.preventDefault();
      commitEdit(arrows[e.key]);
    }
  };

  const onEditorBlur = () => {
    const cur = editRef.current;
    if (!cur) return;
    // Ушли мышью — пишем без перехода; с ошибкой правку не держим (фокуса уже
    // нет), но причину показываем.
    const err = onCommit(cur.c, cur.r, cur.text);
    setEditBoth(null);
    setStatus(err ? `${describe(cur.r, cur.c)}: ${err} — не записано` : '');
  };

  const onEditorPaste = (e) => {
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (!/[\t\n]/.test(text.replace(/\r?\n$/, ''))) return; // одно значение — обычная вставка
    e.preventDefault();
    const cur = editRef.current;
    setEditBoth(null);
    focusGrid();
    if (cur) onPaste(cur.r, cur.c, text);
  };

  const editorProps = useMemo(() => ({
    autoFocus: true,
    onChange: (e) => {
      const text = e.target.value;
      setEditBoth((cur) => (cur ? { ...cur, text, error: '' } : cur));
    },
    onKeyDown: onEditorKeyDown,
    onBlur: onEditorBlur,
    onPaste: onEditorPaste,
    // Правка стоящего значения — выделить целиком (набор заменит); ввод поверх
    // начат с символа — курсор за ним.
    onFocus: (e) => {
      const el = e.target;
      if (editRef.current?.replace) el.setSelectionRange(el.value.length, el.value.length);
      else el.select();
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rows, columns, onCommit, onPaste]);

  const onKeyDown = (e) => {
    // Клавиши с кнопок внутри сетки (шапка колонки, имя ученика) — их собственные.
    if (e.target !== e.currentTarget) return;
    if (editRef.current || !nRows || !nCols) return;
    const { key } = e;
    if (!sel) {
      if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) {
        e.preventDefault();
        setSel({ r: 0, c: 0 });
      }
      return;
    }
    switch (key) {
      case 'ArrowDown': e.preventDefault(); moveFrom(sel, 'down'); return;
      case 'ArrowUp': e.preventDefault(); moveFrom(sel, 'up'); return;
      case 'ArrowLeft': e.preventDefault(); moveFrom(sel, 'left'); return;
      case 'ArrowRight': e.preventDefault(); moveFrom(sel, 'right'); return;
      case 'Tab': e.preventDefault(); moveFrom(sel, e.shiftKey ? 'left' : 'right'); return;
      case 'Enter':
      case 'F2':
        e.preventDefault();
        startEdit(sel.r, sel.c, initialText(sel.r, sel.c), false);
        return;
      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        if (!canEdit) return;
        const err = onCommit(sel.c, sel.r, '');
        setStatus(err ? `${describe(sel.r, sel.c)}: ${err}` : '');
        return;
      }
      case 'Escape':
        setSel(null);
        setStatus('');
        return;
      default:
        if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          startEdit(sel.r, sel.c, key, true);
        }
    }
  };

  const cellFromEvent = (e) => {
    const td = e.target.closest?.('td[data-c]');
    return td ? { r: Number(td.dataset.r), c: Number(td.dataset.c) } : null;
  };

  const onMouseDown = (e) => {
    const pos = cellFromEvent(e);
    if (!pos) return;
    const cur = editRef.current;
    if (cur && cur.r === pos.r && cur.c === pos.c) return; // клик в свой редактор
    setSel(pos);
  };

  const onDoubleClick = (e) => {
    const pos = cellFromEvent(e);
    if (pos) startEdit(pos.r, pos.c, initialText(pos.r, pos.c), false);
  };

  const onPasteGrid = (e) => {
    if (e.target !== e.currentTarget || editRef.current || !sel || !canEdit) return;
    const text = e.clipboardData?.getData('text/plain');
    if (text == null) return;
    e.preventDefault();
    onPaste(sel.r, sel.c, text);
  };

  const onCopy = (e) => {
    if (editRef.current || !sel) return;
    const cell = rows[sel.r]?.cells[sel.c];
    e.clipboardData?.setData('text/plain', cell?.text || '');
    e.preventDefault();
  };

  const spans = useMemo(() => headerSpans(columns, blocks), [columns, blocks]);
  const colClass = useMemo(() => columns.map((col, c) => [
    boundaryClass(columns, c),
    col.blockId ? 'cj-inblock' : '',
    col.role === 'total' ? 'cj-role-total' : '',
  ].filter(Boolean).join(' ')), [columns]);
  const tableWidth = NAME_W + nCols * COL_W + 2 * SUM_W;

  // Итоги класса — без выбывших (их строки видны, но класс уже не их).
  const classAvg = useMemo(() => {
    const avgs = rows.filter((r) => !r.student.former).map((r) => r.summary.avg).filter((x) => x != null);
    return avgs.length ? avgs.reduce((s, x) => s + x, 0) / avgs.length : null;
  }, [rows]);
  const totalDebts = rows.reduce((s, r) => s + (r.student.former ? 0 : r.summary.debts), 0);

  return (
    <>
      <div
        ref={scrollRef}
        className="cj-scroll"
        tabIndex={0}
        role="region"
        aria-label="Журнал класса. Стрелки — переход по клеткам, Enter — ввод, Ctrl+V — вставка из таблицы"
        onKeyDown={onKeyDown}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        onPaste={onPasteGrid}
        onCopy={onCopy}
      >
        <table className="cj-table" lang="ru" style={{ width: tableWidth }}>
          <colgroup>
            <col style={{ width: NAME_W }} />
            {columns.map((col) => <col key={col.key} style={{ width: COL_W }} />)}
            <col style={{ width: SUM_W }} />
            <col style={{ width: SUM_W }} />
          </colgroup>
          <thead>
            <tr className="cj-months">
              <th className="cj-corner" rowSpan={2}>Ученик</th>
              {spans.map((s, i) => {
                if (!s.blockId) return <th key={`${s.key}-${i}`} colSpan={s.span}>{s.label}</th>;
                const block = blocks.get(s.blockId);
                const items = blockMenuFor ? blockMenuFor(block) : [];
                const label = (
                  <button type="button" className="cj-blockh__btn" title={s.label}>
                    <span className="cj-blockh__label">{s.label}</span>
                    {items.length > 0 && <DownOutlined className="cj-blockh__caret" />}
                  </button>
                );
                return (
                  <th key={`${s.key}-${i}`} colSpan={s.span} className={`cj-blockh${i > 0 ? ' cj-edge' : ''}`}>
                    {items.length ? (
                      <Dropdown trigger={['click']} menu={{ items, onClick: ({ key }) => onBlockMenu(key, block) }}>
                        {label}
                      </Dropdown>
                    ) : label}
                  </th>
                );
              })}
              <th className="cj-sumh cj-sum--avg" rowSpan={2} title="Средняя оценка: взвешенная по весам колонок, зачёт и «н» не входят">Ср.</th>
              <th className="cj-sumh" rowSpan={2} title="Долги: «н» (не писал) и онлайн-работы, не сданные в срок">Долги</th>
            </tr>
            <tr className="cj-cols">
              {columns.map((col, c) => {
                const items = menuFor(col);
                const cat = col.category ? groupHex(col.category).base : 'transparent';
                const w = columnWeight(col);
                const head = (
                  <button type="button" className="cj-colh__btn" title={columnTip(col, col.blockId ? blocks.get(col.blockId) : null)}>
                    <span className="cj-colh__date">{shortDay(col.day) || '—'}</span>
                    <span className="cj-colh__title">{col.title}</span>
                    <span className="cj-colh__meta">
                      {col.online ? <MobileOutlined /> : <EditOutlined />}
                      {scaleLabel(col)}
                      {col.lessonId && <CalendarOutlined aria-label="колонка урока" />}
                      {w === 0 && <span>· вне ср.</span>}
                      {w > 0 && w !== 1 && <span>· ×{formatNumber(w)}</span>}
                      {col.hidden && <EyeInvisibleOutlined />}
                    </span>
                  </button>
                );
                return (
                  <th
                    key={col.key}
                    className={`cj-colh${col.hidden ? ' cj-colh--hidden' : ''}${col.virtual ? ' cj-colh--virtual' : ''}${colClass[c] ? ` ${colClass[c]}` : ''}`}
                    style={{ '--cj-cat': cat }}
                  >
                    {items.length ? (
                      <Dropdown
                        trigger={['click']}
                        menu={{ items, onClick: ({ key }) => onMenu(key, col) }}
                      >
                        {head}
                      </Dropdown>
                    ) : head}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <Row
                key={row.student.id}
                r={r}
                row={row}
                columns={columns}
                colClass={colClass}
                selC={sel && sel.r === r ? sel.c : -1}
                edit={edit && edit.r === r ? edit : null}
                onOpenStudent={onOpenStudent}
                editorProps={editorProps}
              />
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="cj-name">Средний по классу</td>
              {columns.map((col, c) => {
                const st = colStats[c];
                const gap = st.total - st.filled;
                return (
                  <td key={col.key} className={colClass[c] || undefined} title={gap ? `не внесено: ${gap}` : 'внесено у всех'}>
                    <span className="cj-foot__avg">{st.avg != null ? formatAvg(st.avg) : '—'}</span>
                    <span className={`cj-foot__fill${gap && !col.online ? ' is-gap' : ''}`}>{st.filled}/{st.total}</span>
                  </td>
                );
              })}
              <td className="cj-sum cj-sum--avg">{classAvg != null ? formatAvg(classAvg) : '—'}</td>
              <td className="cj-sum">{totalDebts || '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="cj-status" role="status" aria-live="polite">{status}</div>
    </>
  );
}
