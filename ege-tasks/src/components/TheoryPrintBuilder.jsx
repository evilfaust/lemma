import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Checkbox, Select, Input, Tag, Spin, Empty, Tooltip, App } from 'antd';
import {
  FilePdfOutlined, PrinterOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useMarkdownProcessor } from '../hooks';
import { getPageDimensions, getThemeStyles, DEFAULT_SETTINGS, THEME_NAMES } from '../utils/theoryThemes';
import { api } from '../services/pocketbase';
import html2pdf from 'html2pdf.js';
import 'katex/dist/katex.min.css';
import './theory/themes.css';
import './theory/TheoryEditor.css';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import './theory/TheoryArticlePrint.css';

export default function TheoryPrintBuilder({ onBack }) {
  const { theoryCategories: categories } = useReferenceData();
  const [allArticles, setAllArticles] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedArticles, setSelectedArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [includeToc, setIncludeToc] = useState(true);
  const [docTitle, setDocTitle] = useState('Конспект');
  const [currentTheme, setCurrentTheme] = useState('classic');
  const [pageSettings] = useState(DEFAULT_SETTINGS);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadArticlesList();
  }, [categoryFilter]);

  const loadArticlesList = async () => {
  const { message } = App.useApp();
    setLoading(true);
    try {
      const filters = {};
      if (categoryFilter) filters.category = categoryFilter;
      const data = await api.getTheoryArticles(filters);
      setAllArticles(data);
    } catch (error) {
      console.error('Error loading articles:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedIds.length === 0) {
      setSelectedArticles([]);
      return;
    }
    loadSelectedContent();
  }, [selectedIds]);

  const loadSelectedContent = async () => {
    setLoadingContent(true);
    try {
      const articles = await Promise.all(
        selectedIds.map(id => api.getTheoryArticle(id))
      );
      setSelectedArticles(articles.filter(Boolean));
    } catch (error) {
      console.error('Error loading article content:', error);
    } finally {
      setLoadingContent(false);
    }
  };

  const toggleArticle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const combinedMarkdown = useMemo(() => {
    if (selectedArticles.length === 0) return '';

    let parts = [];

    if (includeToc && selectedArticles.length > 1) {
      parts.push(`# ${docTitle}\n\n## Содержание\n`);
      selectedArticles.forEach((a, i) => {
        parts.push(`${i + 1}. ${a.title}`);
      });
      parts.push('\n---\n');
    }

    selectedArticles.forEach((article, index) => {
      if (index > 0) parts.push('\n---\n');
      parts.push(article.content_md || '');
    });

    return parts.join('\n');
  }, [selectedArticles, includeToc, docTitle]);

  const html = useMarkdownProcessor(combinedMarkdown, pageSettings.columns);

  const previewStyles = useMemo(() => {
    const dims = getPageDimensions(pageSettings.pageSize, pageSettings.orientation);
    return {
      width: `${dims.width}mm`,
      minHeight: `${dims.height}mm`,
      padding: `${pageSettings.marginTop}mm ${pageSettings.marginRight}mm ${pageSettings.marginBottom}mm ${pageSettings.marginLeft}mm`,
      fontSize: `${pageSettings.fontSize}px`,
      lineHeight: '1.3',
      boxSizing: 'border-box',
      margin: '0 auto',
      background: 'white',
      boxShadow: '0 0 10px rgba(0,0,0,0.1)',
    };
  }, [pageSettings]);

  const handleExportPDF = useCallback(async () => {
    if (selectedArticles.length === 0) {
      message.warning('Выберите хотя бы одну статью');
      return;
    }
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
        filename: `${docTitle || 'conspect'}.pdf`,
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
      message.success('PDF конспект экспортирован');
    } catch (error) {
      console.error('PDF export error:', error);
      message.error('Ошибка при экспорте PDF');
    } finally {
      setIsExporting(false);
    }
  }, [html, currentTheme, pageSettings, docTitle, selectedArticles]);

  const handlePrint = () => window.print();

  return (
    <div className="theory-print-view">
      {/* Тулбар — скрывается при печати */}
      <div className="theory-article-toolbar no-print">
        <div className="theory-article-toolbar-left">
          {onBack && (
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
          )}
          <div className="theory-article-toolbar-divider" />
          <Input
            placeholder="Название конспекта"
            value={docTitle}
            onChange={e => setDocTitle(e.target.value)}
            size="small"
            style={{ width: 200 }}
          />
          <Select
            value={currentTheme}
            onChange={setCurrentTheme}
            size="small"
            style={{ width: 150 }}
            options={Object.entries(THEME_NAMES).map(([key, label]) => ({
              value: key, label,
            }))}
          />
          <Checkbox checked={includeToc} onChange={e => setIncludeToc(e.target.checked)}>
            Оглавление
          </Checkbox>
        </div>
        <div className="theory-article-toolbar-right">
          <Tooltip title="Печать">
            <Button
              type="text"
              icon={<PrinterOutlined />}
              onClick={handlePrint}
              disabled={selectedArticles.length === 0}
            />
          </Tooltip>
          <Tooltip title="Экспорт PDF">
            <Button
              type="text"
              icon={<FilePdfOutlined />}
              onClick={handleExportPDF}
              loading={isExporting}
              disabled={selectedArticles.length === 0}
            />
          </Tooltip>
        </div>
      </div>

      <div className="theory-print-builder">
        {/* Левая панель — скрывается при печати */}
        <div className="theory-print-selector no-print">
          <div style={{ marginBottom: 8 }}>
            <Select
              placeholder="Все категории"
              allowClear
              value={categoryFilter}
              onChange={setCategoryFilter}
              size="small"
              style={{ width: '100%' }}
              options={categories.map(c => ({
                label: <Tag color={c.color}>{c.title}</Tag>,
                value: c.id,
              }))}
            />
          </div>

          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
            Выбрано: {selectedIds.length} из {allArticles.length}
          </div>

          {loading ? (
            <Spin style={{ display: 'block', margin: '20px auto' }} />
          ) : allArticles.length === 0 ? (
            <Empty description="Нет статей" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {allArticles.map(article => {
                const cat = article.expand?.category || categories.find(c => c.id === article.category);
                const isSelected = selectedIds.includes(article.id);
                return (
                  <div
                    key={article.id}
                    onClick={() => toggleArticle(article.id)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isSelected ? '#e6f7ff' : '#fafafa',
                      border: isSelected ? '1px solid #1890ff' : '1px solid #e8e8e8',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Checkbox checked={isSelected} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {article.title}
                        </div>
                        {cat && <Tag color={cat.color} style={{ fontSize: 10 }}>{cat.title}</Tag>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Правая панель — превью и печатаемая область */}
        <div className="theory-print-preview">
          {loadingContent ? (
            <Spin style={{ display: 'block', margin: '40px auto' }} />
          ) : selectedArticles.length === 0 ? (
            <div className="no-print" style={{ textAlign: 'center', padding: 40, color: '#999' }}>
              Выберите статьи слева для формирования конспекта
            </div>
          ) : (
            <div
              className="theory-preview-content theory-article-print-area"
              data-theme={currentTheme}
              style={previewStyles}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
