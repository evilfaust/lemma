import { useState, useEffect, lazy, Suspense, useCallback } from 'react';
import { Layout, Menu, ConfigProvider, theme, Spin, Button, notification } from 'antd';
import { FileTextOutlined, FileSearchOutlined, BookOutlined, FileAddOutlined, UploadOutlined, PieChartOutlined, SolutionOutlined, EditOutlined, TeamOutlined, TrophyOutlined, BarChartOutlined, ReadOutlined, SnippetsOutlined, FolderOutlined, CompassOutlined, UnorderedListOutlined, CustomerServiceOutlined } from '@ant-design/icons';
import TaskList from './components/TaskList';
import TaskSheetGenerator from './components/OralWorksheetGenerator';
import TestWorkGenerator from './components/TestWorkGenerator';
import TaskStatsDashboard from './components/TaskStatsDashboard';
import TaskCatalogManager from './components/TaskCatalogManager';
import TheoryBrowser from './components/TheoryBrowser';
const TheoryEditor = lazy(() => import('./components/TheoryEditor'));
import TheoryArticleView from './components/TheoryArticleView';
import TheoryCategoryManager from './components/TheoryCategoryManager';
import TheoryPrintBuilder from './components/TheoryPrintBuilder';
import TaskImporter from './components/TaskImporter';
import WorkManager from './components/WorkManager';
import WorkEditorPage from './components/WorkEditorPage';
import StudentProgressDashboard from './components/StudentProgressDashboard';
import StudentDetailPage from './components/StudentDetailPage';
import AchievementManager from './components/AchievementManager';
import GeometryTaskList from './components/GeometryTaskList';
import GeometryTopicManager from './components/geometry/GeometryTopicManager';
import EnglishTTS from './components/EnglishTTS';
import { api } from './services/pocketbase';
import { ReferenceDataProvider, useReferenceData } from './contexts/ReferenceDataContext';
import { useVersionSync } from './shared/version/useVersionSync';
import 'katex/dist/katex.min.css';
import './App.css';

const { Header, Content, Sider } = Layout;

function AppContent() {
  const [currentView, setCurrentView] = useState('tasks');
  const [selectedWorkIdForEditor, setSelectedWorkIdForEditor] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [taskListInitialFilters, setTaskListInitialFilters] = useState(null);
  const [taskListFiltersToken, setTaskListFiltersToken] = useState(0);

  // State for theory navigation
  const [editingArticleId, setEditingArticleId] = useState(null);
  const [viewingArticleId, setViewingArticleId] = useState(null);

  const { theoryCategories, reloadData } = useReferenceData();

  const handleVersionUpdate = useCallback((payload) => {
    notification.info({
      message: 'Доступно обновление приложения',
      description: `Новая версия уже развернута (${payload.version || payload.releaseId}).`,
      duration: 0,
      placement: 'bottomRight',
      btn: (
        <Button type="primary" size="small" onClick={() => window.location.reload()}>
          Обновить
        </Button>
      ),
    });
  }, []);

  useVersionSync(handleVersionUpdate);

  useEffect(() => {
    // Teacher UI must always work in unrestricted mode.
    // If a student auth token remains in localStorage, PocketBase list rules
    // return only that student's attempts, breaking dashboards.
    if (api.isStudentAuthenticated()) {
      api.logoutStudent();
    }
  }, []);

  const menuItems = [
    {
      key: 'tasks',
      icon: <FileTextOutlined />,
      label: 'Все задачи',
    },
    {
      key: 'stats',
      icon: <PieChartOutlined />,
      label: 'Аналитика',
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
      key: 'work-manager',
      icon: <SolutionOutlined />,
      label: 'Мои работы',
    },
    {
      key: 'work-editor',
      icon: <EditOutlined />,
      label: 'Редактор работ',
    },
    {
      key: 'students-group',
      icon: <TeamOutlined />,
      label: 'Ученики',
      children: [
        { key: 'students', icon: <BarChartOutlined />, label: 'Прогресс' },
        { key: 'achievements', icon: <TrophyOutlined />, label: 'Достижения' },
      ],
    },
    {
      key: 'import',
      icon: <UploadOutlined />,
      label: 'Импорт задач',
    },
    {
      key: 'geometry',
      icon: <CompassOutlined />,
      label: 'Геометрия',
      children: [
        { key: 'geometry-tasks', icon: <UnorderedListOutlined />, label: 'Задачи' },
        { key: 'geometry-topics', icon: <FolderOutlined />, label: 'Темы и подтемы' },
      ],
    },
    {
      key: 'theory',
      icon: <BookOutlined />,
      label: 'Теория',
      children: [
        { key: 'theory-browser', icon: <ReadOutlined />, label: 'Библиотека' },
        { key: 'theory-editor', icon: <EditOutlined />, label: 'Редактор' },
        { key: 'theory-print', icon: <SnippetsOutlined />, label: 'Конспекты' },
        { key: 'theory-categories', icon: <FolderOutlined />, label: 'Категории' },
      ],
    },
    {
      key: 'english',
      icon: <CustomerServiceOutlined />,
      label: 'Английский',
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
    reloadData();
  };

  const renderContent = () => {
    switch (currentView) {
      case 'tasks':
        return (
          <TaskList
            initialFilters={taskListInitialFilters}
            initialFiltersToken={taskListFiltersToken}
            onOpenWorkEditor={(workId) => {
              setSelectedWorkIdForEditor(workId);
              setCurrentView('work-editor');
            }}
          />
        );
      case 'stats':
        return (
          <TaskStatsDashboard
            onOpenTasks={openTasksWithFilters}
            onOpenCatalog={() => setCurrentView('catalog')}
          />
        );
      case 'catalog':
        return (
          <TaskCatalogManager
            onOpenTasks={openTasksWithFilters}
            onBackToAnalytics={() => setCurrentView('stats')}
          />
        );
      case 'generator':
        return <TaskSheetGenerator />;
      case 'test-generator':
        return <TestWorkGenerator />;
      case 'work-manager':
        return (
          <WorkManager
            onEditWork={(workId) => {
              setSelectedWorkIdForEditor(workId);
              setCurrentView('work-editor');
            }}
          />
        );
      case 'work-editor':
        return <WorkEditorPage initialWorkId={selectedWorkIdForEditor} />;
      case 'students':
        return (
          <StudentProgressDashboard
            onOpenWork={(workId) => {
              setSelectedWorkIdForEditor(workId);
              setCurrentView('work-editor');
            }}
            onOpenStudent={(studentId) => {
              setSelectedStudentId(studentId);
              setCurrentView('student-detail');
            }}
          />
        );
      case 'student-detail':
        return (
          <StudentDetailPage
            studentId={selectedStudentId}
            onBack={() => setCurrentView('students')}
            onOpenWork={(workId) => {
              setSelectedWorkIdForEditor(workId);
              setCurrentView('work-editor');
            }}
          />
        );
      case 'achievements':
        return <AchievementManager />;
      case 'import':
        return <TaskImporter />;
      case 'geometry-tasks':
        return <GeometryTaskList />;
      case 'geometry-topics':
        return <GeometryTopicManager />;
      case 'theory-browser':
        return (
          <TheoryBrowser
            onEditArticle={navigateToEditor}
            onViewArticle={navigateToView}
            onCreateArticle={() => navigateToEditor(null)}
          />
        );
      case 'theory-editor':
        return (
          <Suspense fallback={<div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>}>
            <TheoryEditor
              articleId={editingArticleId}
              onBack={navigateToBrowser}
              onSaved={handleArticleSaved}
            />
          </Suspense>
        );
      case 'theory-view':
        return (
          <TheoryArticleView
            articleId={viewingArticleId}
            onBack={navigateToBrowser}
            onEdit={navigateToEditor}
          />
        );
      case 'theory-print':
        return (
          <TheoryPrintBuilder
            onBack={navigateToBrowser}
          />
        );
      case 'theory-categories':
        return <TheoryCategoryManager />;
      case 'english':
        return <EnglishTTS />;
      default:
        return null;
    }
  };

  const getHeaderTitle = () => {
    switch (currentView) {
      case 'tasks': return 'Все задачи';
      case 'stats': return 'Аналитика задач';
      case 'catalog': return 'Каталог задач';
      case 'generator': return 'Генератор';
      case 'test-generator': return 'Контрольные работы';
      case 'work-manager': return 'Мои работы';
      case 'work-editor': return 'Редактор работ';
      case 'students': return 'Прогресс учеников';
      case 'student-detail': return 'Детали ученика';
      case 'achievements': return 'Управление достижениями';
      case 'import': return 'Импорт задач';
      case 'geometry-tasks': return 'Геометрические задачи';
      case 'geometry-topics': return 'Геометрия — Темы и подтемы';
      case 'theory-browser': return 'Теория — Библиотека';
      case 'theory-editor': return editingArticleId ? 'Теория — Редактор' : 'Теория — Новая статья';
      case 'theory-view': return 'Теория — Просмотр';
      case 'theory-print': return 'Теория — Конспекты';
      case 'theory-categories': return 'Теория — Категории';
      case 'english': return 'Английский — Аудирование';
      default: return '';
    }
  };

  const getSelectedKeys = () => {
    if (currentView === 'theory-view') return ['theory-browser'];
    if (currentView === 'student-detail') return ['students'];
    return [currentView];
  };

  return (
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
          margin: ['theory-editor', 'theory-view', 'theory-print'].includes(currentView) ? 0 : '24px 16px 0',
          overflow: 'hidden',
        }}>
          <div style={{
            padding: ['theory-editor', 'theory-view', 'theory-print'].includes(currentView) ? 0 : 24,
            minHeight: ['theory-editor', 'theory-view', 'theory-print'].includes(currentView) ? undefined : 360,
            height: ['theory-editor', 'theory-view', 'theory-print'].includes(currentView) ? '100%' : undefined,
            background: '#fff',
            borderRadius: ['theory-editor', 'theory-view', 'theory-print'].includes(currentView) ? 0 : 8,
          }}>
            {renderContent()}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}

function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <ReferenceDataProvider>
        <AppContent />
      </ReferenceDataProvider>
    </ConfigProvider>
  );
}

export default App;
