import { useMemo, useState } from 'react';
import {
  Alert, App, Button, Checkbox, Input, Modal, Segmented, Space,
} from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { buildStereoBlock, parseStereoBlock, stereoSvgFromSpec } from '../../utils/stereo/dsl';

/**
 * Чертёж ⇄ текст блока ```stereo.
 * «В текст» — вставить в условие задачи или статью теории (там он печатается
 * статичной картинкой, ч/б по умолчанию). «Из текста» — открыть построение
 * в редакторе (заменяет текущее).
 */
export default function StereoTextModal({ open, onClose, scene, camera, onLoad }) {
  const { message } = App.useApp();
  const [mode, setMode] = useState('export');
  const [color, setColor] = useState(false);
  const [input, setInput] = useState('');

  const exported = useMemo(() => buildStereoBlock(scene, camera, { color }), [scene, camera, color]);
  const fenced = `\`\`\`stereo\n${exported.text}\n\`\`\``;

  const parsed = useMemo(() => {
    const body = input.replace(/^\s*```stereo\s*\n?/i, '').replace(/\n?```\s*$/, '');
    if (!body.trim()) return null;
    return { body, ...parseStereoBlock(body) };
  }, [input]);
  const preview = useMemo(() => (parsed ? stereoSvgFromSpec(parsed.body, { maxWidth: 360 }) : ''), [parsed]);
  const exportPreview = useMemo(() => stereoSvgFromSpec(exported.text, { maxWidth: 360 }), [exported.text]);

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
            onClick={() => { onLoad(parsed.scene, parsed.camera); onClose(); }}
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
              {exported.skipped > 0 && (
                <Alert type="warning" showIcon message={`Шагов не выражается текстом: ${exported.skipped} (прямые через «параллельную»)`} />
              )}
              <span className="stereo-cmd-help">
                Вставьте блок в условие задачи или статью теории — там он станет
                картинкой с этим же ракурсом (строка «вид»).
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
              placeholder={'куб 4\nM на AA1 1:2\nN на CC1\nMN\nX = MN ∩ AC\nвид 22 22'}
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
