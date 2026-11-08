import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Input, Modal } from 'antd';
import { createReactInlineContentSpec, useBlockNoteEditor } from '@blocknote/react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

export const InlineMathEditContext = createContext(false);

export function renderInlineFormula(formula) {
  try {
    return { html: katex.renderToString(formula || '\\,', { displayMode: false, throwOnError: true, trust: false }) };
  } catch (error) {
    return { error: error.message };
  }
}

export function InlineFormulaDialog({ open, formula = '', onCancel, onConfirm }) {
  const [value, setValue] = useState(formula);
  useEffect(() => { if (open) setValue(formula); }, [open, formula]);
  const preview = useMemo(() => renderInlineFormula(value), [value]);
  const submit = () => { if (value.trim() && !preview.error) onConfirm(value.trim()); };
  return (
    <Modal open={open} title="Формула в строке" okText="Вставить" cancelText="Отмена"
      onCancel={onCancel} onOk={submit} okButtonProps={{ disabled: !value.trim() || !!preview.error }}
      destroyOnHidden>
      <Input.TextArea autoFocus value={value} aria-label="Формула LaTeX"
        placeholder="Например: x^2 или \frac{a}{b}"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        rows={2} />
      <div className="notes-formula-preview" aria-live="polite">
        {preview.error ? <Alert type="error" message="Проверьте запись формулы" description={preview.error} />
          : <span dangerouslySetInnerHTML={{ __html: preview.html }} />}
      </div>
      <p className="notes-dialog-hint">Введите LaTeX без знаков $ вокруг формулы. Enter — вставить.</p>
    </Modal>
  );
}

function InlineMathView({ inlineContent, updateInlineContent }) {
  const editor = useBlockNoteEditor();
  const [open, setOpen] = useState(false);
  const formula = inlineContent.props.formula || '';
  const preview = useMemo(() => renderInlineFormula(formula), [formula]);
  const editable = useContext(InlineMathEditContext);
  return (
    <span className="bn-inline-math" contentEditable={false}>
      <span role={editable ? 'button' : undefined} tabIndex={editable ? 0 : undefined}
        aria-label={editable ? `Редактировать формулу ${formula}` : undefined}
        title={editable ? 'Нажмите, чтобы изменить формулу' : undefined}
        onClick={editable ? () => setOpen(true) : undefined}
        onKeyDown={editable ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); }
        } : undefined}>
        {preview.error ? formula : <span dangerouslySetInnerHTML={{ __html: preview.html }} />}
      </span>
      {open && <InlineFormulaDialog open formula={formula} onCancel={() => setOpen(false)}
        onConfirm={(next) => {
          if (!editor.isEditable) { setOpen(false); return; }
          updateInlineContent({ type: 'inlineMath', props: { formula: next } });
          setOpen(false);
          editor.focus();
        }} />}
    </span>
  );
}

export const InlineMath = createReactInlineContentSpec(
  { type: 'inlineMath', propSchema: { formula: { default: '' } }, content: 'none' },
  { render: InlineMathView },
);
