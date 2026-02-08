import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button, Spin, Tag, Space, message, Select, Tooltip, Card, List, Divider } from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, FilePdfOutlined,
  PrinterOutlined
} from '@ant-design/icons';
import { useMarkdownProcessor } from '../hooks';
import { getPageDimensions, getThemeStyles, DEFAULT_SETTINGS, THEME_NAMES } from '../utils/theoryThemes';
import { api } from '../services/pocketbase';
import MathRenderer from './MathRenderer';
import html2pdf from 'html2pdf.js';
import 'katex/dist/katex.min.css';
import './theory/themes.css';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import './theory/TheoryArticlePrint.css';

export default function TheoryArticleView({ articleId, onBack, onEdit }) {
  const { theoryCategories: categories } = useReferenceData();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTheme, setCurrentTheme] = useState('classic');
  const [pageSettings, setPageSettings] = useState(DEFAULT_SETTINGS);
  const [isExporting, setIsExporting] = useState(false);
  const [relatedTasks, setRelatedTasks] = useState([]);
  const [relatedTags, setRelatedTags] = useState([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  useEffect(() => {
    if (articleId) loadArticle(articleId);
  }, [articleId]);

  useEffect(() => {
    if (article?.tags && article.tags.length > 0) {
      loadRelatedTasks(article.tags);
    } else {
      setRelatedTasks([]);
      setRelatedTags([]);
    }
  }, [article?.id, article?.tags]);

  const loadArticle = async (id) => {
    setLoading(true);
    try {
      const data = await api.getTheoryArticle(id);
      setArticle(data);
      if (data?.theme_settings) {
        if (data.theme_settings.pageSettings) setPageSettings(data.theme_settings.pageSettings);
        if (data.theme_settings.currentTheme) setCurrentTheme(data.theme_settings.currentTheme);
      }
    } catch (error) {
      message.error('Ошибка при загрузке статьи');
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedTasks = async (tagTitles = []) => {
    setLoadingRelated(true);
    try {
      const allTags = await api.getTags();
      const tagMap = new Map(allTags.map(t => [t.title.toLowerCase(), t]));
      const matched = tagTitles
        .map(t => tagMap.get(t.toLowerCase()))
        .filter(Boolean);

      const tagIds = matched.map(t => t.id);
      setRelatedTags(matched);

      if (tagIds.length === 0) {
        setRelatedTasks([]);
        return;
      }

      const tasks = await api.getTasks({ tags: tagIds });
      const sorted = [...tasks].sort((a, b) => (a.code || '').localeCompare(b.code || ''));
      setRelatedTasks(sorted);
    } catch (error) {
      console.error('Error loading related tasks:', error);
      setRelatedTasks([]);
      setRelatedTags([]);
    } finally {
      setLoadingRelated(false);
    }
  };

  const html = useMarkdownProcessor(article?.content_md || '', pageSettings.columns);

  const previewStyles = useMemo(() => {
    const dims = getPageDimensions(pageSettings.pageSize, pageSettings.orientation);
    const base = {
      width: `${dims.width}mm`,
      minHeight: `${dims.height}mm`,
      padding: `${pageSettings.marginTop}mm ${pageSettings.marginRight}mm ${pageSettings.marginBottom}mm ${pageSettings.marginLeft}mm`,
      fontSize: `${pageSettings.fontSize}px`,
      lineHeight: '1.4',
      boxSizing: 'border-box',
      margin: '0 auto',
      background: 'white',
      boxShadow: '0 0 10px rgba(0,0,0,0.1)',
    };
    if (pageSettings.columns > 1) {
      base.display = 'grid';
      base.gridTemplateColumns = `repeat(${pageSettings.columns}, 1fr)`;
      base.columnGap = '15px';
      base.alignContent = 'start';
    }
    return base;
  }, [pageSettings]);

  const handleExportPDF = useCallback(async () => {
    if (!article) return;
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
        filename: `${article.title || 'theory'}.pdf`,
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
  }, [html, currentTheme, pageSettings, article]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;
  }

  if (!article) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>Статья не найдена</div>;
  }

  const cat = article.expand?.category || categories.find(c => c.id === article.category);

  return (
    <div className="theory-article-view">
      {/* Toolbar — скрывается при печати */}
      <div className="theory-article-toolbar no-print">
        <div className="theory-article-toolbar-left">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
          <div className="theory-article-toolbar-divider" />
          <Select
            value={currentTheme}
            onChange={setCurrentTheme}
            size="small"
            style={{ width: 150 }}
            options={Object.entries(THEME_NAMES).map(([key, label]) => ({
              value: key,
              label,
            }))}
          />
        </div>
        <div className="theory-article-toolbar-right">
          <Tooltip title="Редактировать">
            <Button type="text" icon={<EditOutlined />} onClick={() => onEdit?.(articleId)} />
          </Tooltip>
          <Tooltip title="Печать">
            <Button type="text" icon={<PrinterOutlined />} onClick={handlePrint} />
          </Tooltip>
          <Tooltip title="Экспорт PDF">
            <Button type="text" icon={<FilePdfOutlined />} onClick={handleExportPDF} loading={isExporting} />
          </Tooltip>
        </div>
      </div>

      {/* Контент — при печати занимает всю страницу */}
      <div className="theory-article-content-wrapper">
        <div
          className="theory-preview-content theory-article-print-area"
          data-theme={currentTheme}
          style={previewStyles}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>

      {/* Связанные задачи — скрывается при печати */}
      <div className="no-print" style={{ marginTop: 24 }}>
        <Divider />
        <Card title="Задачи по теме">
          {article.tags?.length ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <Space wrap>
                  {relatedTags.length > 0 ? (
                    relatedTags.map(tag => (
                      <Tag key={tag.id} color={tag.color}>{tag.title}</Tag>
                    ))
                  ) : (
                    <Tag color="default">Теги статьи не найдены в базе задач</Tag>
                  )}
                </Space>
              </div>
              {loadingRelated ? (
                <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
              ) : relatedTasks.length === 0 ? (
                <div style={{ color: '#999' }}>Нет задач по выбранным тегам.</div>
              ) : (
                <>
                  <div style={{ color: '#666', marginBottom: 8 }}>
                    Найдено задач: {relatedTasks.length}. Показано: {Math.min(20, relatedTasks.length)}.
                  </div>
                  <List
                    size="small"
                    dataSource={relatedTasks.slice(0, 20)}
                    renderItem={(task) => (
                      <List.Item>
                        <div>
                          <Space wrap size={6} style={{ marginBottom: 4 }}>
                            <Tag color="blue">{task.code}</Tag>
                            <Tag>Сложность: {task.difficulty || '1'}</Tag>
                          </Space>
                          <div style={{ fontSize: 13 }}>
                            <MathRenderer text={task.statement_md} />
                          </div>
                        </div>
                      </List.Item>
                    )}
                  />
                </>
              )}
            </>
          ) : (
            <div style={{ color: '#999' }}>В статье нет тегов для поиска задач.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
