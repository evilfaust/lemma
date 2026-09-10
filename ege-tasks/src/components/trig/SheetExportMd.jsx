import { useMemo, useState } from 'react';
import {
  Button, Modal, Segmented, Checkbox, Input, Space, Alert, App, Tooltip,
} from 'antd';
import {
  FileMarkdownOutlined, CopyOutlined, DownloadOutlined,
} from '@ant-design/icons';
import {
  buildSheetMarkdown, sheetMarkdownFilename, normalizeSheet, countTasks,
  SHEET_MD_FORMATS, WORK_MD_MAX_VARIANTS,
} from '../../utils/sheetMarkdown';

const { TextArea } = Input;

/**
 * Выгрузка листа генератора в `.md` с формулами LaTeX.
 *
 * Кнопка живёт рядом с «Сохранить лист» (SheetStorageActions), поэтому
 * появляется сразу во всех генераторах. Текст собирает `utils/sheetMarkdown`:
 * читаемый лист либо файл формата «Импорта работы».
 *
 * @param {object} snapshot — { generator, title, tasksData, layout, instruction }
 */
export function SheetExportMd({ snapshot, hasData }) {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState('compact');
  const [withAnswers, setWithAnswers] = useState(true);
  const [onlyFirstVariant, setOnlyFirstVariant] = useState(false);

  const md = useMemo(() => {
    if (!open || !snapshot?.tasksData) return '';
    return buildSheetMarkdown(snapshot, { format, withAnswers, onlyFirstVariant });
  }, [open, snapshot, format, withAnswers, onlyFirstVariant]);

  // Сколько всего выгружаем — подпись под превью и повод предупредить
  // о лимите вариантов у импорта работ
  const stats = useMemo(() => {
    if (!open || !snapshot?.tasksData) return null;
    const sheet = normalizeSheet(snapshot);
    return {
      variants: sheet.variants.length,
      tasks: countTasks(sheet.variants[0]),
    };
  }, [open, snapshot]);

  const exported = onlyFirstVariant ? 1 : (stats?.variants || 0);
  const tooManyForWork = format === 'work' && exported > WORK_MD_MAX_VARIANTS;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(md);
      message.success('Markdown скопирован');
    } catch {
      message.error('Буфер обмена недоступен — скачайте файл');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = sheetMarkdownFilename(snapshot, format);
    document.body.appendChild(link);
    link.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
    message.success('Файл сохранён');
  };

  return (
    <>
      <Button
        block
        icon={<FileMarkdownOutlined />}
        onClick={() => setOpen(true)}
        disabled={!hasData}
      >
        Экспорт .md
      </Button>

      <Modal
        open={open}
        title="Экспорт листа в Markdown"
        onCancel={() => setOpen(false)}
        width={720}
        destroyOnHidden
        footer={[
          <Button key="close" onClick={() => setOpen(false)}>Закрыть</Button>,
          <Button key="copy" icon={<CopyOutlined />} onClick={handleCopy} disabled={!md}>
            Копировать
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            disabled={!md}
          >
            Скачать .md
          </Button>,
        ]}
      >
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13 }}>Формат:</span>
            <Segmented
              size="small"
              options={SHEET_MD_FORMATS}
              value={format}
              onChange={setFormat}
            />
            <Tooltip title={format === 'work'
              ? 'YAML-шапка, «### N» и метастрока «ответ:» — файл читается разделом «Импорт работы»'
              : 'Заголовок, «## Вариант N», нумерованный список и блок «## Ответы» — для заметок и письма коллеге'}>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                {format === 'work' ? 'вернётся в Lemma работой' : 'для чтения и заметок'}
              </span>
            </Tooltip>
          </div>

          <Space size={16} wrap>
            <Checkbox checked={withAnswers} onChange={e => setWithAnswers(e.target.checked)}>
              <span style={{ fontSize: 13 }}>Ответы</span>
            </Checkbox>
            <Checkbox
              checked={onlyFirstVariant}
              onChange={e => setOnlyFirstVariant(e.target.checked)}
            >
              <span style={{ fontSize: 13 }}>Только вариант 1</span>
            </Checkbox>
            {stats && (
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                {exported} вар. × {stats.tasks} зад.
              </span>
            )}
          </Space>

          {tooManyForWork && (
            <Alert
              type="warning"
              showIcon
              message={`«Импорт работы» разбирает не больше ${WORK_MD_MAX_VARIANTS} вариантов`}
              description="Лишние варианты в файле останутся, но при импорте о них будет предупреждение — выгрузите вариант 1 или разложите лист на несколько файлов."
            />
          )}

          <TextArea
            value={md}
            readOnly
            autoSize={{ minRows: 12, maxRows: 20 }}
            style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
          />
        </Space>
      </Modal>
    </>
  );
}

export default SheetExportMd;
