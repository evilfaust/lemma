import { useState, useCallback } from 'react';
import { Tooltip, Modal, Input } from 'antd';
import {
  BoldOutlined, ItalicOutlined, StrikethroughOutlined,
  OrderedListOutlined, UnorderedListOutlined,
  CodeOutlined, PictureOutlined, LinkOutlined,
  MinusOutlined, FunctionOutlined
} from '@ant-design/icons';
import TableInsertPopover from './TableInsertPopover';
import './EditorToolbar.css';

// Вставка текста в Monaco Editor
function insertIntoEditor(editor, { before = '', after = '', text = '', newLine = false }) {
  if (!editor) return;
  const selection = editor.getSelection();
  const model = editor.getModel();
  const selectedText = model.getValueInRange(selection) || '';

  let textToInsert;
  if (text) {
    // Полная вставка (для таблиц и т.д.)
    textToInsert = text;
  } else if (newLine) {
    const lineNumber = selection.startLineNumber;
    const lineContent = model.getLineContent(lineNumber);
    const needsNewLine = lineContent.trim().length > 0;
    const prefix = needsNewLine ? '\n' : '';
    textToInsert = `${prefix}${before}${selectedText}${after}`;
  } else {
    textToInsert = `${before}${selectedText}${after}`;
  }

  editor.executeEdits('toolbar', [{
    range: selection,
    text: textToInsert,
    forceMoveMarkers: true,
  }]);

  // Позиция курсора
  if (!selectedText && !text) {
    const pos = editor.getPosition();
    if (after) {
      editor.setPosition({
        lineNumber: pos.lineNumber,
        column: pos.column - after.length,
      });
    }
  }
  editor.focus();
}

export default function EditorToolbar({ editorRef }) {
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageAlt, setImageAlt] = useState('');
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');

  const insert = useCallback((opts) => {
    insertIntoEditor(editorRef.current, opts);
  }, [editorRef]);

  const handleTableInsert = useCallback((tableMarkdown) => {
    insertIntoEditor(editorRef.current, { text: tableMarkdown });
  }, [editorRef]);

  const handleImageInsert = useCallback(() => {
    if (!imageUrl.trim()) return;
    const alt = imageAlt.trim() || 'Изображение';
    insertIntoEditor(editorRef.current, { text: `\n![${alt}](${imageUrl.trim()})\n` });
    setImageUrl('');
    setImageAlt('');
    setImageModalOpen(false);
  }, [editorRef, imageUrl, imageAlt]);

  const handleLinkInsert = useCallback(() => {
    if (!linkUrl.trim()) return;
    const text = linkText.trim() || linkUrl.trim();
    insertIntoEditor(editorRef.current, { text: `[${text}](${linkUrl.trim()})` });
    setLinkUrl('');
    setLinkText('');
    setLinkModalOpen(false);
  }, [editorRef, linkUrl, linkText]);

  return (
    <>
      <div className="theory-format-toolbar">
        {/* Заголовки */}
        <div className="toolbar-group">
          <Tooltip title="Заголовок 1">
            <button className="toolbar-btn heading-btn h1" type="button"
              onClick={() => insert({ before: '# ', after: '', newLine: true })}>H1</button>
          </Tooltip>
          <Tooltip title="Заголовок 2">
            <button className="toolbar-btn heading-btn h2" type="button"
              onClick={() => insert({ before: '## ', after: '', newLine: true })}>H2</button>
          </Tooltip>
          <Tooltip title="Заголовок 3">
            <button className="toolbar-btn heading-btn h3" type="button"
              onClick={() => insert({ before: '### ', after: '', newLine: true })}>H3</button>
          </Tooltip>
          <Tooltip title="Заголовок 4">
            <button className="toolbar-btn heading-btn h4" type="button"
              onClick={() => insert({ before: '#### ', after: '', newLine: true })}>H4</button>
          </Tooltip>
        </div>

        {/* Форматирование текста */}
        <div className="toolbar-group">
          <Tooltip title="Жирный">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '**', after: '**' })}>
              <BoldOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Курсив">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '*', after: '*' })}>
              <ItalicOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Зачёркнутый">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '~~', after: '~~' })}>
              <StrikethroughOutlined />
            </button>
          </Tooltip>
        </div>

        {/* Блочные элементы */}
        <div className="toolbar-group">
          <Tooltip title="Маркированный список">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '- ', after: '', newLine: true })}>
              <UnorderedListOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Нумерованный список">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '1. ', after: '', newLine: true })}>
              <OrderedListOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Цитата">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '> ', after: '', newLine: true })}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>"</span>
            </button>
          </Tooltip>
          <Tooltip title="Блок кода">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '```\n', after: '\n```', newLine: true })}>
              <CodeOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Разделитель">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ text: '\n---\n' })}>
              <MinusOutlined />
            </button>
          </Tooltip>
        </div>

        {/* Вставка */}
        <div className="toolbar-group">
          <TableInsertPopover onInsert={handleTableInsert} />
          <Tooltip title="Формула (inline) — Ctrl+I">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '$', after: '$' })}>
              <FunctionOutlined />
              <span className="formula-label">x</span>
            </button>
          </Tooltip>
          <Tooltip title="Формула (блок) — Ctrl+B">
            <button className="toolbar-btn" type="button"
              onClick={() => insert({ before: '\n$$\n', after: '\n$$\n' })}>
              <FunctionOutlined />
              <span className="formula-label">∑</span>
            </button>
          </Tooltip>
          <Tooltip title="Изображение">
            <button className="toolbar-btn" type="button"
              onClick={() => setImageModalOpen(true)}>
              <PictureOutlined />
            </button>
          </Tooltip>
          <Tooltip title="Ссылка">
            <button className="toolbar-btn" type="button"
              onClick={() => setLinkModalOpen(true)}>
              <LinkOutlined />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Modal: Вставка изображения */}
      <Modal
        title="Вставка изображения"
        open={imageModalOpen}
        onCancel={() => { setImageModalOpen(false); setImageUrl(''); setImageAlt(''); }}
        onOk={handleImageInsert}
        okText="Вставить"
        cancelText="Отмена"
        okButtonProps={{ disabled: !imageUrl.trim() }}
        width={450}
      >
        <div className="theory-image-insert">
          <Input
            placeholder="URL изображения"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            autoFocus
          />
          <Input
            placeholder="Описание (alt текст)"
            value={imageAlt}
            onChange={e => setImageAlt(e.target.value)}
          />
          {imageUrl.trim() && (
            <img
              src={imageUrl}
              alt="Превью"
              className="theory-image-insert-preview"
              onError={e => { e.target.style.display = 'none'; }}
              onLoad={e => { e.target.style.display = 'block'; }}
            />
          )}
        </div>
      </Modal>

      {/* Modal: Вставка ссылки */}
      <Modal
        title="Вставка ссылки"
        open={linkModalOpen}
        onCancel={() => { setLinkModalOpen(false); setLinkUrl(''); setLinkText(''); }}
        onOk={handleLinkInsert}
        okText="Вставить"
        cancelText="Отмена"
        okButtonProps={{ disabled: !linkUrl.trim() }}
        width={450}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input
            placeholder="URL"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            autoFocus
          />
          <Input
            placeholder="Текст ссылки (необязательно)"
            value={linkText}
            onChange={e => setLinkText(e.target.value)}
          />
        </div>
      </Modal>
    </>
  );
}
