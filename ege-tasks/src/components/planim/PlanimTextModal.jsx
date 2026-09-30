import { useMemo, useState } from 'react';
import {
  Alert, App, Button, Checkbox, Input, Modal, Segmented, Space,
} from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { buildPlanimBlock, parsePlanimBlock, planimSvgFromSpec } from '../../utils/planim/dsl';

/**
 * Чертёж ⇄ текст блока ```planim.
 * «В текст» — вставить в условие задачи или статью теории (там он печатается
 * статичной картинкой, ч/б по умолчанию). «Из текста» — открыть построение в
 * редакторе (заменяет текущее).
 */
export default function PlanimTextModal({ open, onClose, scene, onLoad }) {
  const { message } = App.useApp();
  const [mode, setMode] = useState('export');
  const [color, setColor] = useState(false);
  const [grid, setGrid] = useState(false);
  const [input, setInput] = useState('');

  const exported = useMemo(() => buildPlanimBlock(scene, { color, grid }), [scene, color, grid]);
  const fenced = `\`\`\`planim\n${exported.text}\n\`\`\``;

  const parsed = useMemo(() => {
    const body = input.replace(/^\s*```planim\s*\n?/i, '').replace(/\n?```\s*$/, '');
    if (!body.trim()) return null;
    return { body, ...parsePlanimBlock(body) };
  }, [input]);
  const preview = useMemo(() => (parsed ? planimSvgFromSpec(parsed.body, { maxWidth: 300 }) : ''), [parsed]);
  const exportPreview = useMemo(() => planimSvgFromSpec(exported.text, { maxWidth: 300 }), [exported.text]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fenced);
      message.success('Блок скопирован — вставьте его в условие задачи или в статью');
    } catch {
      message.info('Выделите текст и скопируйте вручную');
    }
  };

  return (
    <Modal
      title="Чертёж текстом"
      open={open}
      onCancel={onClose}
      width={760}
      footer={mode === 'export'
        ? [<Button key="c" type="primary" icon={<CopyOutlined />} onClick={copy}>Скопировать блок</Button>]
        : [
          <Button key="x" onClick={onClose}>Отмена</Button>,
          <Button
            key="o"
            type="primary"
            disabled={!parsed}
            onClick={() => { onLoad(parsed.scene, { color: parsed.color, grid: parsed.grid }); onClose(); }}
          >
            Открыть в редакторе
          </Button>,
        ]}
      destroyOnHidden
    >
      <Segmented
        value={mode}
        onChange={setMode}
        options={[{ value: 'export', label: 'В текст' }, { value: 'import', label: 'Из текста' }]}
        style={{ marginBottom: 12 }}
      />
      {mode === 'export' ? (
        <div className="stereo-text">
          <div>
            <Input.TextArea value={fenced} readOnly autoSize={{ minRows: 8, maxRows: 18 }} className="stereo-text__code" />
            <Space direction="vertical" size={4} style={{ marginTop: 8 }}>
              <Checkbox checked={color} onChange={(e) => setColor(e.target.checked)}>
                Цветной (по умолчанию ч/б — для печати)
              </Checkbox>
              <Checkbox checked={grid} onChange={(e) => setGrid(e.target.checked)}>
                Клетчатый фон 1 × 1 («на клетчатой бумаге»)
              </Checkbox>
              {exported.skipped > 0 && (
                <Alert type="warning" showIcon message={`Шагов не выражается текстом: ${exported.skipped}`} />
              )}
              <span className="stereo-cmd-help">
                Вставьте блок в условие задачи или статью теории — там он станет картинкой.
              </span>
            </Space>
          </div>
          {/* eslint-disable-next-line react/no-danger */}
          <div className="stereo-text__preview" dangerouslySetInnerHTML={{ __html: exportPreview }} />
        </div>
      ) : (
        <div className="stereo-text">
          <div>
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoSize={{ minRows: 8, maxRows: 18 }}
              placeholder={'треугольник ABC 5 6 7\nH = высота B AC\nM = медиана B AC\nугол BAC 30\nпунктир BH'}
              className="stereo-text__code"
            />
            {parsed?.errors?.length > 0 && (
              <Alert
                style={{ marginTop: 8 }}
                type="warning"
                showIcon
                message={parsed.errors.slice(0, 4).map((e) => `строка ${e.line}: ${e.message}`).join('; ')}
              />
            )}
            <div className="stereo-cmd-help" style={{ marginTop: 6 }}>
              Текущие построения будут заменены (отменить — Ctrl+Z).
            </div>
          </div>
          {/* eslint-disable-next-line react/no-danger */}
          <div className="stereo-text__preview" dangerouslySetInnerHTML={{ __html: preview }} />
        </div>
      )}
    </Modal>
  );
}
