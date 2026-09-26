import { useEffect, useRef, useState } from 'react';
import { Button, Drawer, Input, Tooltip, Typography } from 'antd';
import { MessageOutlined } from '@ant-design/icons';
import {
  ABSENT, SKIP, WAIT, columnScale, editText, formatNumber, shortDay,
} from '../../../utils/classJournal';

const { Text } = Typography;

// Быстрые кнопки под шкалу колонки: на телефоне набирать цифры неудобно.
// «w» — вейтинг (болел, ждём пересдачи), «—» — не писал по уважительной.
// Плюсы и минусы у оценки набираются в поле: «4+», «4-», «4=».
function quickValues(col) {
  const scale = columnScale(col);
  const tail = [[ABSENT, ABSENT], [WAIT, WAIT], [SKIP, SKIP]];
  if (scale === 'grade') return [['5', '5'], ['4', '4'], ['3', '3'], ['2', '2'], ...tail];
  if (scale === 'pass') return [['з', 'зач'], ['нз', 'н/з'], [ABSENT, ABSENT], [WAIT, WAIT]];
  if (scale === 'points' && col.max_score) return [[String(col.max_score), String(formatNumber(col.max_score))], ...tail];
  return tail;
}

function EntryRow({ col, row, colIndex, canEdit, onSave, inputRef, onNext }) {
  const cell = row.cells[colIndex];
  const initial = cell.stored ? editText(col, cell.stored) : '';
  const [text, setText] = useState(initial);
  const [comment, setComment] = useState(cell.comment || '');
  const [showComment, setShowComment] = useState(!!cell.comment);
  const [error, setError] = useState('');
  const savedRef = useRef({ text: initial, comment: cell.comment || '' });

  const save = (nextText = text, nextComment = comment) => {
    if (nextText === savedRef.current.text && nextComment === savedRef.current.comment) return true;
    const err = onSave(row.student, nextText, nextComment);
    if (err) {
      setError(err);
      return false;
    }
    savedRef.current = { text: nextText, comment: nextComment };
    setError('');
    return true;
  };

  const quick = (value) => {
    setText(value);
    save(value, comment);
  };

  const fromAttempts = col.online && cell.kind === 'online' && cell.text ? cell.text : '';
  const missed = cell.kind === 'absent';

  return (
    <div className={`cj-entry__row${row.student.former ? ' is-former' : ''}`}>
      <span className="cj-entry__name" title={row.student.name}>{row.student.name}</span>
      {fromAttempts && <span className="cj-entry__online" title={cell.tip}>из попыток: {fromAttempts}</span>}
      {missed && (
        <span className="cj-entry__online" title={cell.tip}>
          {cell.excused ? 'не был, уважительная' : 'не был на уроке'}
        </span>
      )}
      <Tooltip open={!!error} title={error} placement="topRight">
        <Input
          ref={inputRef}
          className="cj-entry__input"
          value={text}
          disabled={!canEdit}
          status={error ? 'error' : undefined}
          placeholder={missed ? 'н' : '·'}
          inputMode={columnScale(col) === 'pass' ? 'text' : 'decimal'}
          aria-label={row.student.name}
          onChange={(e) => { setText(e.target.value); setError(''); }}
          onBlur={() => save()}
          onPressEnter={() => { if (save()) onNext(); }}
        />
      </Tooltip>
      {canEdit && (
        <span className="cj-entry__quick">
          {quickValues(col).map(([value, label]) => (
            <Button
              key={value}
              size="small"
              type={text === value || (value === 'з' && text === 'зач') ? 'primary' : 'default'}
              onClick={() => quick(value)}
            >
              {label}
            </Button>
          ))}
          <Button
            size="small"
            type={comment ? 'primary' : 'text'}
            ghost={!!comment}
            icon={<MessageOutlined />}
            aria-label="Комментарий"
            onClick={() => setShowComment((v) => !v)}
          />
        </span>
      )}
      {showComment && (
        <Input.TextArea
          className="cj-entry__comment"
          autoSize={{ minRows: 1, maxRows: 4 }}
          value={comment}
          disabled={!canEdit}
          maxLength={1000}
          placeholder="Комментарий к клетке: «болел», «пересдаст», «ошибка в знаке»"
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => save(text, comment)}
        />
      )}
    </div>
  );
}

/**
 * «Ввод списком»: одна колонка, весь класс строками. Для телефона (быстрые
 * кнопки оценок) и для комментариев к клеткам. Запись — тем же onSave, что и
 * в сетке: родитель разбирает ввод и возвращает ошибку или null.
 */
export default function JournalColumnEntry({
  open, column, colIndex, rows, canEdit, isMobile, onClose, onSave,
}) {
  const inputs = useRef([]);

  useEffect(() => {
    if (!open) return undefined;
    // Первое пустое поле — туда и ставим курсор.
    const t = setTimeout(() => {
      const first = rows.findIndex((r) => !r.cells[colIndex]?.stored);
      inputs.current[first >= 0 ? first : 0]?.focus?.();
    }, 150);
    return () => clearTimeout(t);
  // Только на открытие: иначе курсор прыгал бы после каждой записи.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, column?.key]);

  if (!column) return null;
  const filled = rows.filter((r) => {
    const cell = r.cells[colIndex];
    return cell && (cell.stored || cell.kind === 'absent'
      || (cell.kind === 'online' && !['overdue', 'in_progress'].includes(cell.status?.kind)));
  }).length;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement={isMobile ? 'bottom' : 'right'}
      height={isMobile ? '88%' : undefined}
      width={isMobile ? undefined : 460}
      destroyOnHidden
      title={(
        <div style={{ minWidth: 0 }}>
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{column.title}</div>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            {[shortDay(column.day), column.category].filter(Boolean).join(' · ')}
          </Text>
        </div>
      )}
    >
      <div className="cj-entry__head">
        Внесено {filled} из {rows.length}. Enter — к следующему ученику, «н» — не был,
        «w» — вейтинг, «—» — не писал.{columnScale(column) === 'grade' && ' Оценку можно с «+», «−», «=»: «4+», «4-».'}
        {column.online && ' Значение в поле заменяет результат из попыток.'}
      </div>
      {rows.map((row, i) => (
        <EntryRow
          key={`${column.key}-${row.student.id}`}
          col={column}
          row={row}
          colIndex={colIndex}
          canEdit={canEdit}
          onSave={onSave}
          inputRef={(el) => { inputs.current[i] = el; }}
          onNext={() => inputs.current[i + 1]?.focus?.()}
        />
      ))}
    </Drawer>
  );
}
