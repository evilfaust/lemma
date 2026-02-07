import { useState, useEffect } from 'react';
import { Layout, Menu, ConfigProvider, theme, message } from 'antd';
import { FileTextOutlined, FileSearchOutlined, BookOutlined, FileAddOutlined, UploadOutlined, PieChartOutlined, AppstoreOutlined } from '@ant-design/icons';
import TaskList from './components/TaskList';
import TaskSheetGenerator from './components/OralWorksheetGenerator';
import TestWorkGenerator from './components/TestWorkGenerator';
import TaskStatsDashboard from './components/TaskStatsDashboard';
import TaskCatalogManager from './components/TaskCatalogManager';
import TheoryBrowser from './components/TheoryBrowser';
import TheoryEditor from './components/TheoryEditor';
import TheoryArticleView from './components/TheoryArticleView';
import TheoryCategoryManager from './components/TheoryCategoryManager';
import TheoryPrintBuilder from './components/TheoryPrintBuilder';
import TaskImporter from './components/TaskImporter';
import { api } from './services/pocketbase';
import 'katex/dist/katex.min.css';
import './App.css';

const { Header, Content, Sider } = Layout;

function App() {
  const [currentView, setCurrentView] = useState('tasks');
  const [topics, setTopics] = useState([]);
  const [tags, setTags] = useState([]);
  const [years, setYears] = useState([]);
  const [sources, setSources] = useState([]);
  const [subtopics, setSubtopics] = useState([]);
  const [theoryCategories, setTheoryCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskListInitialFilters, setTaskListInitialFilters] = useState(null);
  const [taskListFiltersToken, setTaskListFiltersToken] = useState(0);

  // State for theory navigation
  const [editingArticleId, setEditingArticleId] = useState(null);
  const [viewingArticleId, setViewingArticleId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [topicsData, tagsData, yearsData, sourcesData, subtopicsData, theoryCatsData] = await Promise.all([
        api.getTopics(),
        api.getTags(),
        api.getUniqueYears(),
        api.getUniqueSources(),
        api.getSubtopics(),
        api.getTheoryCategories(),
      ]);
      setTopics(topicsData);
      setTags(tagsData);
      setYears(yearsData);
      setSources(sourcesData);
      setSubtopics(subtopicsData);
      setTheoryCategories(theoryCatsData);
    } catch (error) {
      console.error('Error loading data:', error);
      message.error('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    {
      key: 'tasks',
      icon: <FileTextOutlined />,
      label: 'Все задачи',
    },
    {
      key: 'stats',
      icon: <PieChartOutlined />,
      label: 'Статистика',
    },
    {
      key: 'catalog',
      icon: <AppstoreOutlined />,
      label: 'Каталог',
    },
    {
      key: 'generator',
      icon: <FileSearchOutlined />,
      label: 'Генератор',
    },
    {
      key: 'test-generator',
      icon: <FileAddOutlined />,
      label: 'Контрольные работы',
    },
    {
      key: 'import',
      icon: <UploadOutlined />,
      label: 'Импорт задач',
    },
    {
      key: 'theory',
      icon: <BookOutlined />,
      label: 'Теория',
      children: [
        { key: 'theory-browser', label: 'Библиотека' },
        { key: 'theory-editor', label: 'Редактор' },
        { key: 'theory-print', label: 'Конспекты' },
        { key: 'theory-categories', label: 'Категории' },
      ],
    },
  ];

  // Navigation helpers for theory
  const navigateToEditor = (articleId = null) => {
    setEditingArticleId(articleId);
    setCurrentView('theory-editor');
  };

  const navigateToView = (articleId) => {
    setViewingArticleId(articleId);
    setCurrentView('theory-view');
  };

  const navigateToBrowser = () => {
    setEditingArticleId(null);
    setViewingArticleId(null);
    setCurrentView('theory-browser');
  };

  const openTasksWithFilters = (filters) => {
    setTaskListInitialFilters(filters);
    setTaskListFiltersToken(prev => prev + 1);
    setCurrentView('tasks');
  };

  const handleArticleSaved = (newId) => {
    if (!editingArticleId && newId) {
      setEditingArticleId(newId);
    }
    api.getTheoryCategories().then(setTheoryCategories);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'tasks':
        return (
          <TaskList
            topics={topics}
            tags={tags}
            years={years}
            sources={sources}
            subtopics={subtopics}
            loading={loading}
            initialFilters={taskListInitialFilters}
            initialFiltersToken={taskListFiltersToken}
          />
        );
      case 'stats':
        return (
          <TaskStatsDashboard
            topics={topics}
            tags={tags}
            subtopics={subtopics}
            sources={sources}
            onTagClick={(tagId) => openTasksWithFilters({ tags: [tagId] })}
          />
        );
      case 'catalog':
        return (
          <TaskCatalogManager
            topics={topics}
            subtopics={subtopics}
            tags={tags}
            sources={sources}
            years={years}
            onOpenTasks={openTasksWithFilters}
            onReloadData={loadData}
          />
        );
      case 'generator':
        return (
          <TaskSheetGenerator
            topics={topics}
            tags={tags}
            years={years}
            sources={sources}
            subtopics={subtopics}
          />
        );
      case 'test-generator':
        return (
          <TestWorkGenerator
            topics={topics}
            tags={tags}
            years={years}
            sources={sources}
            subtopics={subtopics}
          />
        );
      case 'import':
        return (
          <TaskImporter
            topics={topics}
            tags={tags}
            subtopics={subtopics}
            onImportComplete={loadData}
          />
        );
      case 'theory-browser':
        return (
          <TheoryBrowser
            categories={theoryCategories}
            onEditArticle={navigateToEditor}
            onViewArticle={navigateToView}
            onCreateArticle={() => navigateToEditor(null)}
          />
        );
      case 'theory-editor':
        return (
          <TheoryEditor
            articleId={editingArticleId}
            categories={theoryCategories}
            onBack={navigateToBrowser}
            onSaved={handleArticleSaved}
          />
        );
      case 'theory-view':
        return (
          <TheoryArticleView
            articleId={viewingArticleId}
            categories={theoryCategories}
            onBack={navigateToBrowser}
            onEdit={navigateToEditor}
          />
        );
      case 'theory-print':
        return (
          <TheoryPrintBuilder
            categories={theoryCategories}
            onBack={navigateToBrowser}
          />
        );
      case 'theory-categories':
        return <TheoryCategoryManager />;
      default:
        return null;
    }
  };

  const getHeaderTitle = () => {
    switch (currentView) {
      case 'tasks': return 'Все задачи';
      case 'stats': return 'Статистика задач';
      case 'catalog': return 'Каталог задач';
      case 'generator': return 'Генератор';
      case 'test-generator': return 'Контрольные работы';
      case 'import': return 'Импорт задач';
      case 'theory-browser': return 'Теория — Библиотека';
      case 'theory-editor': return editingArticleId ? 'Теория — Редактор' : 'Теория — Новая статья';
      case 'theory-view': return 'Теория — Просмотр';
      case 'theory-print': return 'Теория — Конспекты';
      case 'theory-categories': return 'Теория — Категории';
      default: return '';
    }
  };

  const getSelectedKeys = () => {
    if (currentView === 'theory-view') return ['theory-browser'];
    return [currentView];
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Sider
          breakpoint="lg"
          collapsedWidth="0"
          width={220}
          style={{
            background: '#fff',
            boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 600,
            color: '#1890ff'
          }}>
            ЕГЭ Задачи
          </div>
          <Menu
            mode="inline"
            selectedKeys={getSelectedKeys()}
            defaultOpenKeys={[]}
            items={menuItems}
            onClick={({ key }) => {
              setCurrentView(key);
              if (key === 'theory-browser') {
                setEditingArticleId(null);
                setViewingArticleId(null);
              }
            }}
            style={{ borderRight: 0 }}
          />
        </Sider>

        <Layout>
          <Header style={{
            background: '#fff',
            padding: '0 24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            fontSize: 20,
            fontWeight: 500,
          }}>
            {getHeaderTitle()}
          </Header>

          <Content style={{
            margin: currentView === 'theory-editor' ? 0 : '24px 16px 0',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: currentView === 'theory-editor' ? 0 : 24,
              minHeight: currentView === 'theory-editor' ? undefined : 360,
              height: currentView === 'theory-editor' ? '100%' : undefined,
              background: '#fff',
              borderRadius: currentView === 'theory-editor' ? 0 : 8,
            }}>
              {renderContent()}
            </div>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}

export default App;
