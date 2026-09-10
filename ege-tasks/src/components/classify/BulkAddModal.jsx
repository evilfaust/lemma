import { useMemo, useState } from 'react';
import { Modal, Input, Alert } from 'antd';
import MathInline from '../shared/MathInline';

const { TextArea } = Input;

/**
 * Быстрый ввод банка: одно уравнение — одна строка.
 *
 * Учитель обычно уже держит список в тетради или в файле, и вбивать его по
 * одному полю — самая дорогая часть работы. Типы расставляются потом, в
 * списке: разметка идёт быстрее, когда все уравнения уже видны рядом.
 *
 * Ответ для ключа можно дописать через «|»: «x^2-5x=0 | 0; 5».
 */
export function parseBulkEquations(text = '') {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [latex, answer] = line.split('|').map(s => s.trim());
      return { latex, answerLatex: answer || '' };
    })
    .filter(row => row.latex);
}

export function BulkAddModal({ open, onClose, onAdd }) {
  const [text, setText] = useState('');
  const rows = useMemo(() => parseBulkEquations(text), [text]);

  const handleOk = () => {
    onAdd(rows);
    setText('');
    onClose();
  };

  return (
    <Modal
      title="Вставить уравнения списком"
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText={rows.length ? `Добавить ${rows.length}` : 'Добавить'}
      okButtonProps={{ disabled: rows.length === 0 }}
      width={680}
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="По одному уравнению в строке, в LaTeX. Ответ для ключа — после «|»."
        description="Например: (6 + x)^2 = 4 | -8; -4"
      />

      <TextArea
        value={text}
        onChange={e => setText(e.target.value)}
        autoSize={{ minRows: 8, maxRows: 16 }}
        placeholder={'x^2 - 5x = 0\n3x^2 - 27 = 0 | -3; 3\n(2x - 1)^2 = -1 | корней нет'}
        style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
      />

      {rows.length > 0 && (
        <div style={{
          marginTop: 12, maxHeight: 200, overflowY: 'auto',
          border: '1px solid var(--rule-soft)', borderRadius: 'var(--radius)',
          padding: '8px 10px',
        }}>
          {rows.map((row, i) => (
            <div key={i} style={{ padding: '3px 0', display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)', minWidth: 24,
              }}>
                {i + 1})
              </span>
              <MathInline latex={row.latex} />
              {row.answerLatex && (
                <>
                  <span style={{ color: 'var(--ink-4)' }}>→</span>
                  <MathInline latex={row.answerLatex} />
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default BulkAddModal;
