import { useState, useEffect } from 'react';
import { Layout, Menu, ConfigProvider, theme, message } from 'antd';
import { FileTextOutlined, FileSearchOutlined } from '@ant-design/icons';
import TaskList from './components/TaskList';
import TaskSheetGenerator from './components/OralWorksheetGenerator';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [topicsData, tagsData, yearsData, sourcesData, subtopicsData] = await Promise.all([
        api.getTopics(),
        api.getTags(),
        api.getUniqueYears(),
        api.getUniqueSources(),
        api.getSubtopics(),
      ]);
      setTopics(topicsData);
      setTags(tagsData);
      setYears(yearsData);
      setSources(sourcesData);
      setSubtopics(subtopicsData);
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
      key: 'generator',
      icon: <FileSearchOutlined />,
      label: 'Генератор',
    },
  ];

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
      default:
        return null;
    }
  };

  const getHeaderTitle = () => {
    switch (currentView) {
      case 'tasks':
        return 'Все задачи';
      case 'generator':
        return 'Генератор';
      default:
        return '';
    }
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
            selectedKeys={[currentView]}
            items={menuItems}
            onClick={({ key }) => setCurrentView(key)}
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

          <Content style={{ margin: '24px 16px 0' }}>
            <div style={{
              padding: 24,
              minHeight: 360,
              background: '#fff',
              borderRadius: 8,
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
