import { useEffect, useState } from 'react';
import { Card, Table, Space, Button, Divider } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';

export default function OtherTab({ difficultyRows, yearRows, stats, onOpenTasks }) {
  const [yearPage, setYearPage] = useState(1);
  const [yearPageSize, setYearPageSize] = useState(20);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(yearRows.length / yearPageSize));
    if (yearPage > totalPages) {
      setYearPage(totalPages);
    }
  }, [yearRows.length, yearPageSize, yearPage]);

  return (
    <>
      <Card title="Сложность" style={{ marginBottom: 16 }}>
        <Table
          size="small"
          dataSource={difficultyRows}
          pagination={false}
          columns={[
            { title: 'Сложность', dataIndex: 'difficulty', width: 120, sorter: (a, b) => Number(a.difficulty) - Number(b.difficulty) },
            { title: 'Кол-во', dataIndex: 'count', width: 120, sorter: (a, b) => a.count - b.count },
            {
              title: 'Действия',
              render: (_, record) => (
                <Button size="small" icon={<FolderOpenOutlined />} onClick={() => onOpenTasks({ difficulty: record.difficulty })} />
              ),
            },
          ]}
        />
      </Card>

      <Card title="Годы" style={{ marginBottom: 16 }}>
        <Table
          size="small"
          dataSource={yearRows}
          pagination={{
            current: yearPage,
            pageSize: yearPageSize,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50, 100],
            onChange: (page, size) => {
              setYearPage(page);
              setYearPageSize(size);
            },
          }}
          columns={[
            { title: 'Год', dataIndex: 'year', width: 120, sorter: (a, b) => Number(a.year) - Number(b.year) },
            { title: 'Кол-во', dataIndex: 'count', width: 120, sorter: (a, b) => a.count - b.count },
            {
              title: 'Действия',
              render: (_, record) => (
                <Button size="small" icon={<FolderOpenOutlined />} onClick={() => onOpenTasks({ year: record.year })} />
              ),
            },
          ]}
        />
      </Card>

      <Card title="Признаки">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Divider style={{ margin: 0 }} />
          <Space>
            <span>С ответом: {stats.hasAnswer}</span>
            <Button size="small" onClick={() => onOpenTasks({ hasAnswer: true })}>Открыть</Button>
          </Space>
          <Divider style={{ margin: 0 }} />
          <Space>
            <span>С решением: {stats.hasSolution}</span>
            <Button size="small" onClick={() => onOpenTasks({ hasSolution: true })}>Открыть</Button>
          </Space>
          <Divider style={{ margin: 0 }} />
          <Space>
            <span>С изображением: {stats.hasImage}</span>
            <Button size="small" onClick={() => onOpenTasks({ hasImage: true })}>Открыть</Button>
          </Space>
        </Space>
      </Card>
    </>
  );
}
