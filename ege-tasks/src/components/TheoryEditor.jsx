import React, { useState, useRef, useCallback, useMemo, useEffect, lazy, Suspense } from 'react';
import { Button, Select, Input, Modal, Spin, InputNumber, Radio, Tag, Space, Tooltip, App } from 'antd';
import {
  SaveOutlined, SettingOutlined,
  FormatPainterOutlined, ColumnWidthOutlined, FilePdfOutlined,
  ArrowLeftOutlined, TagsOutlined
} from '@ant-design/icons';
import { useMarkdownProcessor, useKeyboardShortcuts, useDocumentStats, useAutosave, loadAutosave } from '../hooks';
import { getPageDimensions, getThemeStyles, DEFAULT_SETTINGS, THEME_NAMES } from '../utils/theoryThemes';
import { api } from '../services/pocketbase';
import html2pdf from 'html2pdf.js';
import 'katex/dist/katex.min.css';
import './theory/themes.css';
import './theory/TheoryEditor.css';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

const THEMES = [
  { id: 'classic', name: 'Классическая', description: 'Стандартное оформление с засечками' },
  { id: 'minimal', name: 'Минималистичная', description: 'Чистый и простой стиль' },
  { id: 'academic', name: 'Академическая', description: 'Для научных работ' },
  { id: 'notebook', name: 'Тетрадь', description: 'Как школьная тетрадь' },
  { id: 'compact', name: 'Компактная', description: 'Плотная вёрстка, мелкий шрифт' },
];

const DEFAULT_CONTENT = `# Заголовок статьи

Введите текст теоретического материала здесь.

## Подзаголовок

Поддерживается **жирный**, *курсив*, формулы: $E = mc^2$

Блочная формула:

$$
\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$
`;

import { useReferenceData } from '../contexts/ReferenceDataContext';

export default function TheoryEditor({ articleId = null, onBack, onSaved }) {
  const { theoryCategories: categories } = useReferenceData();
  const initialData = useMemo(() => {
  const { message } = App.useApp();
    const { content, settings } = loadAutosave(articleId);
    return {
      content: content || DEFAULT_CONTENT,
      pageSettings: settings?.pageSettings || DEFAULT_SETTINGS,
      theme: settings?.currentTheme || 'classic'
    };
  }, [articleId]);

  const [markdown, setMarkdown] = useState(initialData.content);
  const [currentTheme, setCurrentTheme] = useState(initialData.theme);
  const [pageSettings, setPageSettings] = useState(initialData.pageSettings);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTagsModalOpen, setIsTagsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [articleLoading, setArticleLoading] = useState(!!articleId);

  // Article metadata
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [articleTags, setArticleTags] = useState([]);
  const [summary, setSummary] = useState('');

  const editorRef = useRef(null);

  // Process markdown
  const html = useMarkdownProcessor(markdown, pageSettings.columns);
  const stats = useDocumentStats(markdown);

  // Autosave
  useAutosave(markdown, pageSettings, currentTheme, articleId);

  // Load article if editing
  useEffect(() => {
    if (articleId) {
      loadArticle(articleId);
    }
  }, [articleId]);

  const loadArticle = async (id) => {
    setArticleLoading(true);
    try {
      const article = await api.getTheoryArticle(id);
      if (article) {
        setMarkdown(article.content_md || '');
        setTitle(article.title || '');
        setCategoryId(article.category || null);
        setArticleTags(article.tags || []);
        setSummary(article.summary || '');
        if (article.theme_settings) {
          if (article.theme_settings.pageSettings) {
            setPageSettings(article.theme_settings.pageSettings);
          }
          if (article.theme_settings.currentTheme) {
            setCurrentTheme(article.theme_settings.currentTheme);
          }
        }
      }
    } catch (error) {
      message.error('Ошибка при загрузке статьи');
    } finally {
      setArticleLoading(false);
    }
  };

  // Insert formula at cursor
  const insertFormula = useCallback((type) => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = editor.getSelection();

    if (type === 'inline') {
      const text = '$ $';
      editor.executeEdits('', [{ range: selection, text }]);
      const pos = selection.getStartPosition();
      editor.setPosition({ lineNumber: pos.lineNumber, column: pos.column + 2 });
    } else if (type === 'block') {
      const text = '\n$$\n\n$$\n';
      editor.executeEdits('', [{ range: selection, text }]);
      const pos = selection.getStartPosition();
      editor.setPosition({ lineNumber: pos.lineNumber + 2, column: 1 });
    }

    editor.focus();
  }, []);

  // Save article
  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      message.warning('Введите название статьи');
      return;
    }
    if (!categoryId) {
      message.warning('Выберите категорию');
      return;
    }

    setSaving(true);
    try {
      const data = {
        title: title.trim(),
        content_md: markdown,
        category: categoryId,
        tags: articleTags,
        summary: summary.trim(),
        theme_settings: { pageSettings, currentTheme },
      };

      if (articleId) {
        await api.updateTheoryArticle(articleId, data);
        message.success('Статья обновлена');
      } else {
        const created = await api.createTheoryArticle(data);
        message.success('Статья создана');
        onSaved?.(created.id);
      }
    } catch (error) {
      message.error('Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  }, [title, categoryId, markdown, articleTags, summary, pageSettings, currentTheme, articleId, onSaved]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSave: handleSave,
    onInsertInlineFormula: useCallback(() => insertFormula('inline'), [insertFormula]),
    onInsertBlockFormula: useCallback(() => insertFormula('block'), [insertFormula]),
  });

  // Export PDF
  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);
    try {
      const styles = getThemeStyles(currentTheme, pageSettings);
      const dims = getPageDimensions(pageSettings.pageSize, pageSettings.orientation);

      const container = document.createElement('div');
      container.innerHTML = `
        <style>${styles}</style>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
        <div class="page" data-theme="${currentTheme}">${html}</div>
      `;

      document.body.appendChild(container);

      const opt = {
        margin: 0,
        filename: `${title || 'theory-article'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: {
          unit: 'mm',
          format: [dims.width, dims.height],
          orientation: pageSettings.orientation,
        },
      };

      await html2pdf().set(opt).from(container.querySelector('.page')).save();
      document.body.removeChild(container);
      message.success('PDF экспортирован');
    } catch (error) {
      console.error('PDF export error:', error);
      message.error('Ошибка при экспорте PDF');
    } finally {
      setIsExporting(false);
    }
  }, [html, currentTheme, pageSettings, title]);

  // Toggle columns
  const toggleColumns = useCallback(() => {
    setPageSettings(prev => ({ ...prev, columns: prev.columns === 1 ? 2 : 1 }));
  }, []);

  // Preview styles
  const previewStyles = useMemo(() => {
    const dims = getPageDimensions(pageSettings.pageSize, pageSettings.orientation);
    const base = {
      width: `${dims.width}mm`,
      minHeight: `${dims.height}mm`,
      padding: `${pageSettings.marginTop}mm ${pageSettings.marginRight}mm ${pageSettings.marginBottom}mm ${pageSettings.marginLeft}mm`,
      fontSize: `${pageSettings.fontSize}px`,
      lineHeight: '1.3',
      boxSizing: 'border-box',
    };
    if (pageSettings.columns > 1) {
      base.display = 'grid';
      base.gridTemplateColumns = `repeat(${pageSettings.columns}, 1fr)`;
      base.columnGap = '15px';
      base.alignContent = 'start';
    }
    return base;
  }, [pageSettings]);

  if (articleLoading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  return (
    <div className="theory-editor-container">
      {/* Компактный тулбар */}
      <div className="theory-editor-toolbar">
        <div className="toolbar-group">
          {onBack && (
            <Tooltip title="Назад">
              <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} />
            </Tooltip>
          )}
          <Input
            placeholder="Название статьи"
            value={title}
            onChange={e => setTitle(e.target.value)}
            size="small"
            style={{ width: 200 }}
          />
          <Select
            placeholder="Категория"
            value={categoryId}
            onChange={setCategoryId}
            size="small"
            style={{ width: 150 }}
            options={categories.map(c => ({
              label: <Tag color={c.color} style={{ margin: 0 }}>{c.title}</Tag>,
              value: c.id,
            }))}
          />
          <Tooltip title={articleTags.length > 0 ? `Теги: ${articleTags.join(', ')}` : 'Теги'}>
            <Button
              type="text"
              size="small"
              icon={<TagsOutlined />}
              onClick={() => setIsTagsModalOpen(true)}
            >
              {articleTags.length > 0 && <span style={{ fontSize: 11, color: '#888' }}>{articleTags.length}</span>}
            </Button>
          </Tooltip>
        </div>

        <div style={{ flex: 1 }} />

        <div className="toolbar-group">
          <Tooltip title={pageSettings.columns > 1 ? '1 колонка' : '2 колонки'}>
            <Button
              type={pageSettings.columns > 1 ? 'primary' : 'text'}
              size="small"
              icon={<ColumnWidthOutlined />}
              onClick={toggleColumns}
            />
          </Tooltip>
          <Tooltip title="Настройки страницы">
            <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => setIsSettingsModalOpen(true)} />
          </Tooltip>
          <Tooltip title="Тема оформления">
            <Button type="text" size="small" icon={<FormatPainterOutlined />} onClick={() => setIsThemeModalOpen(true)} />
          </Tooltip>
          <div className="toolbar-divider" />
          <Button
            type="primary"
            size="small"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            Сохранить
          </Button>
          <Tooltip title="Экспорт PDF">
            <Button type="text" size="small" icon={<FilePdfOutlined />} onClick={handleExportPDF} loading={isExporting} />
          </Tooltip>
        </div>
      </div>

      {/* Editor + Preview */}
      <div className="theory-editor-body">
        {/* Editor Panel */}
        <div className="theory-editor-panel">
          <div className="panel-header">
            <span>Редактор (Markdown + LaTeX)</span>
            <span className="hint">Ctrl+I — inline, Ctrl+B — блочная формула</span>
          </div>
          <Suspense fallback={<div className="theory-editor-loading">Загрузка редактора...</div>}>
            <MonacoEditor
              height="100%"
              defaultLanguage="markdown"
              value={markdown}
              onChange={(value) => setMarkdown(value || '')}
              onMount={(editor) => { editorRef.current = editor; }}
              theme="vs-light"
              options={{
                fontSize: 14,
                lineNumbers: 'on',
                minimap: { enabled: false },
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
              }}
              loading={<div className="theory-editor-loading">Загрузка Monaco Editor...</div>}
            />
          </Suspense>
        </div>

        {/* Preview Panel */}
        <div className="theory-editor-panel">
          <div className="panel-header">
            <span>
              Превью ({pageSettings.pageSize} {pageSettings.orientation === 'landscape' ? '↔' : '↕'}) — {THEME_NAMES[currentTheme]}
            </span>
            <span className="stats">
              {stats.words} слов | {stats.formulas} формул
            </span>
          </div>
          <div className="theory-preview-wrapper">
            <div
              className="theory-preview-content"
              data-theme={currentTheme}
              style={previewStyles}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
      </div>

      {/* Tags Modal */}
      <Modal
        title="Теги статьи"
        open={isTagsModalOpen}
        onCancel={() => setIsTagsModalOpen(false)}
        footer={null}
        width={400}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Select
            mode="tags"
            placeholder="Введите теги через Enter"
            value={articleTags}
            onChange={setArticleTags}
            style={{ width: '100%' }}
            tokenSeparators={[',']}
            open={false}
          />
          {articleTags.length > 0 && (
            <div>
              {articleTags.map(tag => (
                <Tag
                  key={tag}
                  closable
                  onClose={() => setArticleTags(prev => prev.filter(t => t !== tag))}
                  style={{ marginBottom: 4 }}
                >
                  {tag}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Theme Selector Modal */}
      <Modal
        title="Выбор темы"
        open={isThemeModalOpen}
        onCancel={() => setIsThemeModalOpen(false)}
        footer={null}
        width={700}
      >
        <div className="theory-theme-grid">
          {THEMES.map(theme => (
            <div
              key={theme.id}
              className={`theory-theme-card ${currentTheme === theme.id ? 'active' : ''}`}
              onClick={() => {
                setCurrentTheme(theme.id);
                setIsThemeModalOpen(false);
              }}
            >
              <div className="theme-preview" data-theme={theme.id}>
                <div className="preview-title">Заголовок</div>
                <div className="preview-text">Текст документа</div>
                <div className="preview-formula">x² + y² = r²</div>
              </div>
              <div className="theme-info">
                <h4>{theme.name}</h4>
                <p>{theme.description}</p>
                {currentTheme === theme.id && (
                  <Tag color="green" style={{ marginTop: 4 }}>Выбрана</Tag>
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Page Settings Modal */}
      <Modal
        title="Настройки страницы"
        open={isSettingsModalOpen}
        onCancel={() => setIsSettingsModalOpen(false)}
        footer={null}
        width={500}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px 0' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Формат страницы</div>
            <Radio.Group
              value={pageSettings.pageSize}
              onChange={e => setPageSettings(prev => ({ ...prev, pageSize: e.target.value }))}
            >
              <Radio.Button value="A4">A4 (210 × 297 мм)</Radio.Button>
              <Radio.Button value="A5">A5 (148 × 210 мм)</Radio.Button>
            </Radio.Group>
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Ориентация</div>
            <Radio.Group
              value={pageSettings.orientation}
              onChange={e => setPageSettings(prev => ({ ...prev, orientation: e.target.value }))}
            >
              <Radio.Button value="portrait">Книжная</Radio.Button>
              <Radio.Button value="landscape">Альбомная</Radio.Button>
            </Radio.Group>
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Поля (мм)</div>
            <Space>
              <div>
                <div style={{ fontSize: 12, color: '#888' }}>Верх</div>
                <InputNumber min={5} max={50} value={pageSettings.marginTop}
                  onChange={v => setPageSettings(prev => ({ ...prev, marginTop: v || 15 }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888' }}>Низ</div>
                <InputNumber min={5} max={50} value={pageSettings.marginBottom}
                  onChange={v => setPageSettings(prev => ({ ...prev, marginBottom: v || 15 }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888' }}>Лево</div>
                <InputNumber min={5} max={50} value={pageSettings.marginLeft}
                  onChange={v => setPageSettings(prev => ({ ...prev, marginLeft: v || 15 }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#888' }}>Право</div>
                <InputNumber min={5} max={50} value={pageSettings.marginRight}
                  onChange={v => setPageSettings(prev => ({ ...prev, marginRight: v || 15 }))} />
              </div>
            </Space>
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Размер шрифта (px)</div>
            <InputNumber min={10} max={24} value={pageSettings.fontSize}
              onChange={v => setPageSettings(prev => ({ ...prev, fontSize: v || 16 }))} />
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Быстрые пресеты</div>
            <Space wrap>
              <Button size="small" onClick={() => setPageSettings({
                pageSize: 'A4', orientation: 'portrait', columns: 1,
                marginTop: 20, marginBottom: 20, marginLeft: 20, marginRight: 20, fontSize: 16
              })}>A4 Стандарт</Button>
              <Button size="small" onClick={() => setPageSettings({
                pageSize: 'A4', orientation: 'landscape', columns: 2,
                marginTop: 10, marginBottom: 10, marginLeft: 15, marginRight: 15, fontSize: 12
              })}>A4 Альбомная</Button>
              <Button size="small" onClick={() => setPageSettings({
                pageSize: 'A5', orientation: 'portrait', columns: 1,
                marginTop: 15, marginBottom: 15, marginLeft: 15, marginRight: 15, fontSize: 14
              })}>A5 Компакт</Button>
              <Button size="small" onClick={() => setPageSettings({
                pageSize: 'A4', orientation: 'portrait', columns: 1,
                marginTop: 8, marginBottom: 8, marginLeft: 8, marginRight: 8, fontSize: 11
              })}>A4 Плотная</Button>
            </Space>
          </div>
        </div>
      </Modal>
    </div>
  );
}
