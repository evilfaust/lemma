import { Card, Collapse, Space, Tag, Button } from 'antd';
import { FolderOpenOutlined, SwapOutlined } from '@ant-design/icons';

export default function DuplicateTab({ duplicateGroups, onOpenTasks, onMerge }) {
  return (
    <>
      <Card title="Дубли по названиям" style={{ marginBottom: 16 }}>
        <Collapse
          items={[
            {
              key: 'dup-topics',
              label: `Темы (${duplicateGroups.topicsDup.length})`,
              children: duplicateGroups.topicsDup.length === 0 ? (
                <div style={{ color: '#999' }}>Дубли не найдены</div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {duplicateGroups.topicsDup.map(group => (
                    <Card key={group.key} size="small" title={`"${group.key}" (${group.items.length})`}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {group.items.map(item => (
                          <Space key={item.id} wrap>
                            <Tag color="blue">{item.title}</Tag>
                            <Button size="small" icon={<FolderOpenOutlined />} onClick={() => onOpenTasks({ topic: item.id })}>Открыть</Button>
                            <Button size="small" icon={<SwapOutlined />} onClick={() => onMerge('topic', item)}>Объединить</Button>
                          </Space>
                        ))}
                      </Space>
                    </Card>
                  ))}
                </Space>
              ),
            },
            {
              key: 'dup-subtopics',
              label: `Подтемы (${duplicateGroups.subtopicsDup.length})`,
              children: duplicateGroups.subtopicsDup.length === 0 ? (
                <div style={{ color: '#999' }}>Дубли не найдены</div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {duplicateGroups.subtopicsDup.map(group => (
                    <Card key={group.key} size="small" title={`"${group.key}" (${group.items.length})`}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {group.items.map(item => (
                          <Space key={item.id} wrap>
                            <Tag color="purple">{item.name || item.title}</Tag>
                            <Button size="small" icon={<FolderOpenOutlined />} onClick={() => onOpenTasks({ subtopic: item.id, topic: item.topic })}>Открыть</Button>
                            <Button size="small" icon={<SwapOutlined />} onClick={() => onMerge('subtopic', item)}>Объединить</Button>
                          </Space>
                        ))}
                      </Space>
                    </Card>
                  ))}
                </Space>
              ),
            },
            {
              key: 'dup-tags',
              label: `Теги (${duplicateGroups.tagsDup.length})`,
              children: duplicateGroups.tagsDup.length === 0 ? (
                <div style={{ color: '#999' }}>Дубли не найдены</div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {duplicateGroups.tagsDup.map(group => (
                    <Card key={group.key} size="small" title={`"${group.key}" (${group.items.length})`}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {group.items.map(item => (
                          <Space key={item.id} wrap>
                            <Tag color={item.color}>{item.title}</Tag>
                            <Button size="small" icon={<FolderOpenOutlined />} onClick={() => onOpenTasks({ tags: [item.id] })}>Открыть</Button>
                            <Button size="small" icon={<SwapOutlined />} onClick={() => onMerge('tag', item)}>Объединить</Button>
                          </Space>
                        ))}
                      </Space>
                    </Card>
                  ))}
                </Space>
              ),
            },
            {
              key: 'dup-sources',
              label: `Источники (${duplicateGroups.sourcesDup.length})`,
              children: duplicateGroups.sourcesDup.length === 0 ? (
                <div style={{ color: '#999' }}>Дубли не найдены</div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {duplicateGroups.sourcesDup.map(group => (
                    <Card key={group.key} size="small" title={`"${group.key}" (${group.items.length})`}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {group.items.map(item => (
                          <Space key={item.key} wrap>
                            <Tag>{item.source}</Tag>
                            <Button size="small" icon={<FolderOpenOutlined />} onClick={() => onOpenTasks({ source: item.source })}>Открыть</Button>
                            <Button size="small" icon={<SwapOutlined />} onClick={() => onMerge('source', item.source)}>Объединить</Button>
                          </Space>
                        ))}
                      </Space>
                    </Card>
                  ))}
                </Space>
              ),
            },
          ]}
          defaultActiveKey={[]}
        />
      </Card>

      <Card title="Дубли задач" style={{ marginBottom: 16 }}>
        <Collapse
          items={[
            {
              key: 'dup-tasks-strict',
              label: `Точные совпадения (${duplicateGroups.strictTasks.length})`,
              children: duplicateGroups.strictTasks.length === 0 ? (
                <div style={{ color: '#999' }}>Дубли не найдены</div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {duplicateGroups.strictTasks.map(group => (
                    <Card key={group.key} size="small" title={`Совпадение (${group.items.length})`}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {group.items.map(task => (
                          <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <span>{task.code}</span>
                            <Button
                              size="small"
                              icon={<FolderOpenOutlined />}
                              onClick={() => onOpenTasks({ search: (task.statement_md || '').slice(0, 40) })}
                            >
                              Открыть
                            </Button>
                          </div>
                        ))}
                      </Space>
                    </Card>
                  ))}
                </Space>
              ),
            },
            {
              key: 'dup-tasks-loose',
              label: `Похожие (агрессивная нормализация) (${duplicateGroups.looseTasks.length})`,
              children: duplicateGroups.looseTasks.length === 0 ? (
                <div style={{ color: '#999' }}>Дубли не найдены</div>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {duplicateGroups.looseTasks.map(group => (
                    <Card key={group.key} size="small" title={`Похожие (${group.items.length})`}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {group.items.map(task => (
                          <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <span>{task.code}</span>
                            <Button
                              size="small"
                              icon={<FolderOpenOutlined />}
                              onClick={() => onOpenTasks({ search: (task.statement_md || '').slice(0, 40) })}
                            >
                              Открыть
                            </Button>
                          </div>
                        ))}
                      </Space>
                    </Card>
                  ))}
                </Space>
              ),
            },
          ]}
          defaultActiveKey={[]}
        />
      </Card>
    </>
  );
}
