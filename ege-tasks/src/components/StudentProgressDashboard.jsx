import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Collapse, Empty, Modal, Progress, Space, Spin, Table, Tag, Typography } from 'antd';
import { ReloadOutlined, UserOutlined, TeamOutlined, TrophyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { api } from '../services/pocketbase';
import './StudentProgressDashboard.css';

const { Text } = Typography;

const toPercent = (score, total) => {
  if (!total) return 0;
  return Math.round((score / total) * 100);
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('ru-RU');
};

const getAttemptTestTitle = (attempt, worksById) => {
  const session = attempt?.expand?.session;

  const expandedWorkTitle = session?.expand?.work?.title?.trim();
  if (expandedWorkTitle) return expandedWorkTitle;

  const workTitle = session?.work ? worksById?.get(session.work)?.title?.trim() : '';
  if (workTitle) return workTitle;

  return session?.id || attempt?.session || '—';
};

const normalizeUnlockedIds = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && typeof item.id === 'string') return item.id;
        return null;
      })
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => (typeof item === 'string' ? item : item?.id))
          .filter(Boolean);
      }
    } catch (_) {
      return [];
    }
  }

  return [];
};

const StudentProgressDashboard = ({ onOpenWork }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [works, setWorks] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [studentsData, attemptsData, worksData] = await Promise.all([
        api.getStudents(),
        api.getAttemptsForRegisteredStudents(),
        api.getWorks({ includeArchived: true }),
      ]);
      setStudents(studentsData);
      setAttempts(attemptsData);
      setWorks(worksData);
    } catch (err) {
      console.error('Error loading student progress dashboard:', err);
      message.error('Ошибка загрузки прогресса учеников');
    }
    setLoading(false);
  }, [message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const worksById = useMemo(() => {
    const map = new Map();
    works.forEach((work) => map.set(work.id, work));
    return map;
  }, [works]);

  const attemptsByStudentId = useMemo(() => {
    const map = new Map();
    attempts.forEach((attempt) => {
      if (!attempt.student) return;
      if (!map.has(attempt.student)) map.set(attempt.student, []);
      map.get(attempt.student).push(attempt);
    });
    return map;
  }, [attempts]);

  const tableData = useMemo(() => {
    return students.map((student) => {
      const studentAttempts = attemptsByStudentId.get(student.id) || [];
      const finishedAttempts = studentAttempts.filter((a) => a.status !== 'started');
      const totalScore = finishedAttempts.reduce((sum, a) => sum + (a.score || 0), 0);
      const totalTasks = finishedAttempts.reduce((sum, a) => sum + (a.total || 0), 0);
      const avgPercent = toPercent(totalScore, totalTasks);
      const bestPercent = finishedAttempts.reduce((best, a) => {
        return Math.max(best, toPercent(a.score || 0, a.total || 0));
      }, 0);
      const lastAttemptAt = studentAttempts
        .map((a) => a.created)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a))[0] || null;
      const latestAttempt = studentAttempts
        .slice()
        .sort((a, b) => new Date(b.created) - new Date(a.created))[0] || null;

      const achievements = new Set();
      const completedWorkIds = new Set();
      studentAttempts.forEach((a) => {
        if (a.achievement) achievements.add(a.achievement);
        normalizeUnlockedIds(a.unlocked_achievements).forEach((id) => achievements.add(id));
        if (a.status !== 'started') {
          const workId = a.expand?.session?.work;
          if (workId) completedWorkIds.add(workId);
        }
      });

      return {
        key: student.id,
        id: student.id,
        name: student.name || '—',
        username: student.username || '—',
        studentClass: student.student_class || '',
        registeredAt: student.created || null,
        attemptsCount: studentAttempts.length,
        finishedCount: finishedAttempts.length,
        avgPercent,
        bestPercent,
        totalScore,
        totalTasks,
        achievementsCount: achievements.size,
        completedWorksCount: completedWorkIds.size,
        lastAttemptAt,
        latestTestTitle: getAttemptTestTitle(latestAttempt, worksById),
      };
    });
  }, [students, attemptsByStudentId, worksById]);

  // Группировка по классам для Collapse
  const groupedByClass = useMemo(() => {
    const groups = new Map();

    tableData.forEach((student) => {
      const cls = student.studentClass || '__none__';
      if (!groups.has(cls)) groups.set(cls, []);
      groups.get(cls).push(student);
    });

    // Сортируем классы: сначала по числу, потом буквы, "Без класса" в конец
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      return a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' });
    });

    return sortedKeys.map((key) => {
      const students = groups.get(key);
      const avgPercent = students.length > 0
        ? Math.round(students.reduce((sum, s) => sum + s.avgPercent, 0) / students.length)
        : 0;
      const totalAttempts = students.reduce((sum, s) => sum + s.attemptsCount, 0);
      return {
        key,
        label: key === '__none__' ? 'Без класса' : key,
        students,
        avgPercent,
        totalAttempts,
      };
    });
  }, [tableData]);

  const dashboardStats = useMemo(() => {
    const totalStudents = tableData.length;
    const classCount = groupedByClass.filter((group) => group.key !== '__none__').length;
    const finishedAttempts = tableData.reduce((sum, row) => sum + row.finishedCount, 0);
    const totalAttempts = tableData.reduce((sum, row) => sum + row.attemptsCount, 0);
    const avgResult = totalStudents > 0
      ? Math.round(tableData.reduce((sum, row) => sum + row.avgPercent, 0) / totalStudents)
      : 0;
    const achievements = tableData.reduce((sum, row) => sum + row.achievementsCount, 0);

    return {
      totalStudents,
      classCount,
      finishedAttempts,
      totalAttempts,
      avgResult,
      achievements,
    };
  }, [tableData, groupedByClass]);

  const columns = [
    {
      title: 'Ученик',
      key: 'student',
      width: 240,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.name}</Text>
          <Text type="secondary">@{record.username}</Text>
        </Space>
      ),
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: 'Класс',
      key: 'studentClass',
      width: 120,
      render: (_, record) => (
        record.studentClass
          ? <Tag color="geekblue">{record.studentClass}</Tag>
          : <Text type="secondary">—</Text>
      ),
      sorter: (a, b) => (a.studentClass || '').localeCompare(b.studentClass || '', 'ru'),
    },
    {
      title: 'Попытки',
      key: 'attempts',
      width: 120,
      render: (_, record) => (
        <Text>{record.finishedCount}/{record.attemptsCount}</Text>
      ),
      sorter: (a, b) => a.attemptsCount - b.attemptsCount,
    },
    {
      title: 'Последний тест',
      key: 'latestTestTitle',
      width: 220,
      render: (_, record) => (
        <Text
          ellipsis={{ tooltip: record.latestTestTitle }}
          type={record.latestTestTitle === '—' ? 'secondary' : undefined}
        >
          {record.latestTestTitle}
        </Text>
      ),
      sorter: (a, b) => (a.latestTestTitle || '').localeCompare(b.latestTestTitle || '', 'ru'),
    },
    {
      title: 'Средний результат',
      key: 'avg',
      width: 190,
      render: (_, record) => (
        <Progress
          percent={record.avgPercent}
          size="small"
          status="active"
          format={(p) => `${p}%`}
        />
      ),
      sorter: (a, b) => a.avgPercent - b.avgPercent,
    },
    {
      title: 'Лучший',
      dataIndex: 'bestPercent',
      key: 'bestPercent',
      width: 100,
      render: (value) => <Tag color={value >= 80 ? 'green' : value >= 50 ? 'blue' : 'default'}>{value}%</Tag>,
      sorter: (a, b) => a.bestPercent - b.bestPercent,
    },
    {
      title: 'Ачивки',
      dataIndex: 'achievementsCount',
      key: 'achievementsCount',
      width: 100,
      sorter: (a, b) => a.achievementsCount - b.achievementsCount,
    },
    {
      title: 'Работы',
      dataIndex: 'completedWorksCount',
      key: 'completedWorksCount',
      width: 90,
      sorter: (a, b) => a.completedWorksCount - b.completedWorksCount,
    },
    {
      title: 'Последняя активность',
      key: 'lastAttemptAt',
      width: 190,
      render: (_, record) => (
        <Text type={record.lastAttemptAt ? undefined : 'secondary'}>
          {formatDateTime(record.lastAttemptAt)}
        </Text>
      ),
      sorter: (a, b) => new Date(a.lastAttemptAt || 0) - new Date(b.lastAttemptAt || 0),
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Button size="small" onClick={() => setSelectedStudent(record)}>
          Детали
        </Button>
      ),
    },
  ];

  const selectedStudentAttempts = useMemo(() => {
    if (!selectedStudent) return [];
    return (attemptsByStudentId.get(selectedStudent.id) || [])
      .slice()
      .sort((a, b) => new Date(b.created) - new Date(a.created));
  }, [selectedStudent, attemptsByStudentId]);

  const selectedStudentCompletedWorks = useMemo(() => {
    if (!selectedStudent) return [];
    const studentAttempts = attemptsByStudentId.get(selectedStudent.id) || [];
    const ids = new Set();
    studentAttempts.forEach((attempt) => {
      if (attempt.status === 'started') return;
      const workId = attempt.expand?.session?.work;
      if (workId) ids.add(workId);
    });

    return Array.from(ids).map((id) => ({
      id,
      title: worksById.get(id)?.title || 'Работа',
    }));
  }, [selectedStudent, attemptsByStudentId, worksById]);

  // Колонки без колонки "Класс" для таблиц внутри Collapse
  const columnsWithoutClass = useMemo(() =>
    columns.filter((c) => c.key !== 'studentClass'),
    [columns]
  );

  if (loading && tableData.length === 0) {
    return (
      <div className="spd-loading">
        <Spin />
      </div>
    );
  }

  return (
    <div className="spd-dashboard">
      <div className="spd-dashboard-header">
        <h2 className="spd-dashboard-title">
          <UserOutlined />
          Прогресс учеников
        </h2>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          Обновить
        </Button>
      </div>

      <div className="spd-hero-grid">
        <div className="spd-hero-card spd-hero-card--students">
          <div className="spd-hero-label">Ученики</div>
          <div className="spd-hero-value">{dashboardStats.totalStudents}</div>
          <div className="spd-hero-suffix">{dashboardStats.classCount} классов</div>
        </div>
        <div className="spd-hero-card spd-hero-card--attempts">
          <div className="spd-hero-label">Попытки</div>
          <div className="spd-hero-value">{dashboardStats.finishedAttempts}</div>
          <div className="spd-hero-suffix">из {dashboardStats.totalAttempts}</div>
        </div>
        <div className="spd-hero-card spd-hero-card--result">
          <div className="spd-hero-label">Средний результат</div>
          <div className="spd-hero-value">{dashboardStats.avgResult}%</div>
          <div className="spd-hero-suffix">по завершённым работам</div>
        </div>
        <div className="spd-hero-card spd-hero-card--achievements">
          <div className="spd-hero-label">Достижения</div>
          <div className="spd-hero-value">{dashboardStats.achievements}</div>
          <div className="spd-hero-suffix">разблокировано всего</div>
        </div>
      </div>

      {tableData.length === 0 ? (
        <div className="spd-section">
          <Empty description="Нет зарегистрированных учеников" />
        </div>
      ) : (
        <div className="spd-section">
          <div className="spd-section-header">
            <div className="spd-section-icon">
              <TeamOutlined />
            </div>
            <h3 className="spd-section-title">Классы и ученики</h3>
          </div>
          <Collapse
            defaultActiveKey={groupedByClass.length <= 4 ? groupedByClass.map((g) => g.key) : []}
            className="spd-collapse"
            items={groupedByClass.map((group) => ({
              key: group.key,
              label: (
                <Space size={12} wrap>
                  <TeamOutlined />
                  <Text strong>{group.label}</Text>
                  <Tag>{group.students.length} уч.</Tag>
                  <Tag color={group.avgPercent >= 70 ? 'green' : group.avgPercent >= 40 ? 'blue' : 'default'}>
                    Средний: {group.avgPercent}%
                  </Tag>
                  <Text type="secondary">
                    Попыток: {group.totalAttempts}
                  </Text>
                </Space>
              ),
              children: (
                <Table
                  columns={columnsWithoutClass}
                  dataSource={group.students}
                  size="small"
                  pagination={group.students.length > 20 ? { pageSize: 20 } : false}
                  scroll={{ x: 920 }}
                />
              ),
            }))}
          />
        </div>
      )}

      <Modal
        open={!!selectedStudent}
        title={selectedStudent ? `Прогресс: ${selectedStudent.name}` : 'Прогресс ученика'}
        onCancel={() => setSelectedStudent(null)}
        footer={null}
        width={900}
      >
        {selectedStudent && (
          <Space direction="vertical" size={16} style={{ width: '100%' }} className="spd-modal-content">
            <Space wrap className="spd-modal-tags">
              <Tag>Логин: @{selectedStudent.username}</Tag>
              <Tag color="geekblue">Класс: {selectedStudent.studentClass || '—'}</Tag>
              <Tag>Регистрация: {formatDateTime(selectedStudent.registeredAt)}</Tag>
              <Tag color="blue">Попыток: {selectedStudent.attemptsCount}</Tag>
              <Tag color="green">Решено: {selectedStudent.totalScore} / {selectedStudent.totalTasks}</Tag>
              <Tag color="gold">Ачивок: {selectedStudent.achievementsCount}</Tag>
            </Space>

            <div className="spd-modal-card">
              <div className="spd-modal-card-header">
                <CheckCircleOutlined />
                <Text strong>Выполненные работы</Text>
              </div>
              <div>
                {selectedStudentCompletedWorks.length === 0 ? (
                  <Text type="secondary">Нет завершённых работ</Text>
                ) : (
                  <Space wrap className="spd-modal-works">
                    {selectedStudentCompletedWorks.map((work) => (
                      <Button
                        key={work.id}
                        size="small"
                        onClick={() => onOpenWork?.(work.id)}
                      >
                        {work.title}
                      </Button>
                    ))}
                  </Space>
                )}
              </div>
            </div>

            <div className="spd-modal-card">
              <div className="spd-modal-card-header">
                <TrophyOutlined />
                <Text strong>История попыток</Text>
              </div>
              <Table
                rowKey="id"
                size="small"
                dataSource={selectedStudentAttempts}
                pagination={false}
                locale={{ emptyText: 'Попыток пока нет' }}
                columns={[
                  {
                    title: 'Дата',
                    key: 'created',
                    width: 180,
                    render: (_, record) => formatDateTime(record.created),
                  },
                  {
                    title: 'Работа',
                    key: 'work',
                    width: 220,
                    render: (_, record) => {
                      const workId = record.expand?.session?.work;
                      if (!workId) return <Text type="secondary">—</Text>;
                      return (
                        <Space>
                          <Text>{worksById.get(workId)?.title || workId}</Text>
                          <Button size="small" type="link" onClick={() => onOpenWork?.(workId)}>
                            Открыть
                          </Button>
                        </Space>
                      );
                    },
                  },
                  {
                    title: 'Вариант',
                    key: 'variant',
                    width: 100,
                    render: (_, record) => record.expand?.variant?.number || '—',
                  },
                  {
                    title: 'Статус',
                    key: 'status',
                    width: 110,
                    render: (_, record) => record.status || '—',
                  },
                  {
                    title: 'Результат',
                    key: 'score',
                    width: 150,
                    render: (_, record) => (
                      <Text>{record.score || 0} / {record.total || 0} ({toPercent(record.score || 0, record.total || 0)}%)</Text>
                    ),
                  },
                  {
                    title: 'Ачивки',
                    key: 'ach',
                    width: 120,
                    render: (_, record) => {
                      const achCount = new Set([
                        ...(record.achievement ? [record.achievement] : []),
                        ...normalizeUnlockedIds(record.unlocked_achievements),
                      ]).size;
                      return achCount || '—';
                    },
                  },
                ]}
              />
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default StudentProgressDashboard;
