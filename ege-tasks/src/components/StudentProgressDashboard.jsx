import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Modal, Progress, Select, Space, Spin, Table, Tag, Typography } from 'antd';
import { ReloadOutlined, UserOutlined } from '@ant-design/icons';
import { api } from '../services/pocketbase';

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
  const [classFilter, setClassFilter] = useState('all');
  const [editingClass, setEditingClass] = useState('');
  const [savingClass, setSavingClass] = useState(false);

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
      };
    });
  }, [students, attemptsByStudentId]);

  const classOptions = useMemo(() => {
    const values = Array.from(new Set(
      students
        .map((s) => (s.student_class || '').trim())
        .filter(Boolean)
    ));

    values.sort((a, b) => a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' }));
    return values;
  }, [students]);

  const filteredTableData = useMemo(() => {
    if (classFilter === 'all') return tableData;
    if (classFilter === '__none__') return tableData.filter((s) => !s.studentClass);
    return tableData.filter((s) => s.studentClass === classFilter);
  }, [tableData, classFilter]);

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

  useEffect(() => {
    if (!selectedStudent) {
      setEditingClass('');
      return;
    }
    setEditingClass(selectedStudent.studentClass || '');
  }, [selectedStudent]);

  const handleSaveStudentClass = useCallback(async () => {
    if (!selectedStudent) return;
    setSavingClass(true);
    try {
      await api.updateStudent(selectedStudent.id, {
        student_class: editingClass || '',
      });

      setStudents((prev) => prev.map((student) => (
        student.id === selectedStudent.id
          ? { ...student, student_class: editingClass || '' }
          : student
      )));
      setSelectedStudent((prev) => (prev ? { ...prev, studentClass: editingClass || '' } : prev));
      message.success('Класс сохранён');
    } catch (err) {
      console.error('Error saving student class:', err);
      if (err?.status === 404) {
        message.error('Класс не сохранён: нет прав на обновление students. Перезапустите PocketBase, чтобы применить миграцию 1770001100.');
      } else {
        message.error('Не удалось сохранить класс');
      }
    }
    setSavingClass(false);
  }, [selectedStudent, editingClass, message]);

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

  if (loading && tableData.length === 0) {
    return <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <UserOutlined />
          <Text strong>Зарегистрированные ученики ({filteredTableData.length})</Text>
          <Select
            size="small"
            value={classFilter}
            style={{ minWidth: 180 }}
            onChange={setClassFilter}
            options={[
              { value: 'all', label: 'Все классы' },
              { value: '__none__', label: 'Без класса' },
              ...classOptions.map((value) => ({ value, label: value })),
            ]}
          />
        </Space>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading} size="small">
          Обновить
        </Button>
      </div>

      {filteredTableData.length === 0 ? (
        <Empty description="Нет зарегистрированных учеников" />
      ) : (
        <Table
          columns={columns}
          dataSource={filteredTableData}
          size="small"
          pagination={false}
          scroll={{ x: 1040 }}
        />
      )}

      <Modal
        open={!!selectedStudent}
        title={selectedStudent ? `Прогресс: ${selectedStudent.name}` : 'Прогресс ученика'}
        onCancel={() => setSelectedStudent(null)}
        footer={null}
        width={900}
      >
        {selectedStudent && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Space wrap>
              <Tag>Логин: @{selectedStudent.username}</Tag>
              <Tag color="geekblue">Класс: {selectedStudent.studentClass || '—'}</Tag>
              <Tag>Регистрация: {formatDateTime(selectedStudent.registeredAt)}</Tag>
              <Tag color="blue">Попыток: {selectedStudent.attemptsCount}</Tag>
              <Tag color="green">Решено: {selectedStudent.totalScore} / {selectedStudent.totalTasks}</Tag>
              <Tag color="gold">Ачивок: {selectedStudent.achievementsCount}</Tag>
            </Space>

            <Space wrap align="start">
              <Text strong>Класс:</Text>
              <Select
                value={editingClass || undefined}
                placeholder="Не указан"
                allowClear
                style={{ minWidth: 180 }}
                onChange={(value) => setEditingClass(value || '')}
                options={[
                  ...classOptions.map((value) => ({ value, label: value })),
                  { value: '5', label: '5 класс' },
                  { value: '6', label: '6 класс' },
                  { value: '7', label: '7 класс' },
                  { value: '8', label: '8 класс' },
                  { value: '9', label: '9 класс' },
                  { value: '10', label: '10 класс' },
                  { value: '11', label: '11 класс' },
                  { value: '10А', label: '10А' },
                  { value: '10Б', label: '10Б' },
                  { value: '11А', label: '11А' },
                  { value: '11Б', label: '11Б' },
                ]}
              />
              <Button
                type="primary"
                size="small"
                loading={savingClass}
                onClick={handleSaveStudentClass}
              >
                Сохранить класс
              </Button>
            </Space>

            <div>
              <Text strong>Выполненные работы</Text>
              <div style={{ marginTop: 8 }}>
                {selectedStudentCompletedWorks.length === 0 ? (
                  <Text type="secondary">Нет завершённых работ</Text>
                ) : (
                  <Space wrap>
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
                  title: 'Сессия',
                  key: 'session',
                  width: 170,
                  render: (_, record) => record.session || '—',
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
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default StudentProgressDashboard;
