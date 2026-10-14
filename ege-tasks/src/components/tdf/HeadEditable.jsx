import { useEffect, useRef, useState } from 'react';

/**
 * Текст шапки листа, который правится прямо на листе: щелчок — поле ввода,
 * Enter / уход фокуса — сохранить, Esc — отменить.
 *
 * Без `onCommit` (measure-зона, печать) — просто текст: вёрстка шапки в зоне
 * измерения и на листе одна и та же, иначе пагинация разъедется.
 */
export default function HeadEditable({ value, onCommit, multiline = false, edited = false, placeholder }) {
  const [draft, setDraft] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (draft !== null && ref.current) {
      ref.current.focus();
      ref.current.select();
    }
    // Фокус — только при входе в правку, не на каждую букву.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft !== null]);

  if (!onCommit) return value;

  if (draft !== null) {
    const finish = (save) => {
      if (save) onCommit(draft);
      setDraft(null);
    };
    const common = {
      ref,
      className: 'tdfp-edit-input',
      value: draft,
      placeholder,
      onChange: e => setDraft(e.target.value),
      onBlur: () => finish(true),
      onKeyDown: (e) => {
        if (e.key === 'Escape') { e.preventDefault(); finish(false); }
        if (e.key === 'Enter' && (!multiline || !e.shiftKey)) { e.preventDefault(); finish(true); }
      },
    };
    return multiline
      ? <textarea {...common} rows={Math.max(1, draft.split('\n').length)} />
      : <input {...common} type="text" />;
  }

  return (
    <span
      className={`tdfp-edit${edited ? ' tdfp-edit--edited' : ''}`}
      role="button"
      tabIndex={0}
      title="Щёлкните, чтобы изменить"
      onClick={() => setDraft(value || '')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); setDraft(value || ''); }
      }}
    >
      {value}
    </span>
  );
}
