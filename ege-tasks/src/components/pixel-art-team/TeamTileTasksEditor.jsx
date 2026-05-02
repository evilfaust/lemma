import { useState } from 'react';
import { Button, Collapse, Tag, Tooltip, Empty } from 'antd';
import { CopyOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import QRTaskPanel from '../qr-worksheet/QRTaskPanel';
import { TrigSettingsSection } from '../trig/TrigGeneratorLayout';

const TILE_LABELS = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р'];

/**
 * Редактор задач для командного пиксель-арта.
 *
 * В режиме 'same' — одна панель задач, общая для всех плиток.
 * В режиме 'per_tile' — Collapse с панелью для каждой плитки + кнопка "Копировать всем".
 */
export default function TeamTileTasksEditor({
  taskMode,
  totalTiles,
  tileCount,
  // Shared
  sharedTasks,
  sharedAnswers,
  onAddShared,
  onRemoveShared,
  onMoveShared,
  onSetSharedAnswer,
  getSharedAnswerForTask,
  // Per-tile
  tileTasks,
  tileAnswers,
  onAddTile,
  onRemoveTile,
  onMoveTile,
  onSetTileAnswer,
  getTileAnswerForTask,
  onCopyTileToAll,
  // Reference data
  topics,
  subtopics,
  tags,
  // Tile grids (для статуса)
  tileGrids,
  // Редактирование задачи
  onEditTask,
}) {
  const [activeKeys, setActiveKeys] = useState(['0']);

  if (taskMode === 'same') {
    return (
      <TrigSettingsSection label="Задачи (одинаковые для всех плиток)">
        <QRTaskPanel
          tasks={sharedTasks}
          customAnswers={sharedAnswers}
          topics={topics}
          subtopics={subtopics}
          tags={tags}
          onAddTask={onAddShared}
          onRemoveTask={onRemoveShared}
          onMoveTask={onMoveShared}
          onSetCustomAnswer={onSetSharedAnswer}
          getAnswerForTask={getSharedAnswerForTask}
          onEditTask={onEditTask}
        />
        {sharedTasks.length > 0 && (
          <div style={{
            marginTop: 8, fontSize: 12, color: 'var(--ink-3)',
            padding: '6px 8px', background: 'var(--bg-sunken)',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--rule-soft)',
          }}>
            Эти задачи получат все {totalTiles} учеников. Каждый красит свою часть картины.
          </div>
        )}
      </TrigSettingsSection>
    );
  }

  // per_tile mode
  const tileStatus = (i) => {
    const tasks = tileTasks?.[i] ?? [];
    const grid  = tileGrids?.[i];
    if (!tasks.length) return 'empty';
    if (!grid) return 'no-grid';
    return 'ok';
  };

  const statusIcon = (i) => {
    const s = tileStatus(i);
    if (s === 'ok')   return <CheckCircleOutlined style={{ color: 'var(--lvl-1)', fontSize: 13 }} />;
    return <ExclamationCircleOutlined style={{ color: 'var(--c-amber)', fontSize: 13 }} />;
  };

  const items = Array.from({ length: totalTiles }, (_, i) => {
    const tr = Math.floor(i / tileCount);
    const tc = i % tileCount;
    const label = TILE_LABELS[i] ?? `${i + 1}`;
    const tasks = tileTasks?.[i] ?? [];

    return {
      key: String(i),
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {statusIcon(i)}
          <span style={{ fontWeight: 600 }}>
            Плитка {label}
          </span>
          <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>
            (ряд {tr + 1}, колонка {tc + 1})
          </span>
          {tasks.length > 0 && (
            <Tag style={{ marginLeft: 'auto', fontSize: 11 }}>{tasks.length} задач</Tag>
          )}
        </div>
      ),
      children: (
        <div>
          <QRTaskPanel
            tasks={tasks}
            customAnswers={tileAnswers?.[i] ?? {}}
            topics={topics}
            subtopics={subtopics}
            tags={tags}
            onAddTask={(task) => onAddTile(i, task)}
            onRemoveTask={(taskId) => onRemoveTile(i, taskId)}
            onMoveTask={(idx, dir) => onMoveTile(i, idx, dir)}
            onSetCustomAnswer={(taskId, val) => onSetTileAnswer(i, taskId, val)}
            getAnswerForTask={(task) => getTileAnswerForTask(i, task)}
            onEditTask={onEditTask}
          />
          {tasks.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <Tooltip title="Скопировать эти задачи на все остальные плитки">
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => onCopyTileToAll(i)}
                  style={{ color: 'var(--ink-3)' }}
                >
                  Скопировать на все плитки
                </Button>
              </Tooltip>
            </div>
          )}
        </div>
      ),
    };
  });

  const readyCount = Array.from({ length: totalTiles }, (_, i) => tileStatus(i) === 'ok').filter(Boolean).length;

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          Задачи для каждой плитки
        </span>
        <Tag color={readyCount === totalTiles ? 'success' : 'default'}>
          {readyCount} / {totalTiles} готово
        </Tag>
      </div>
      <Collapse
        activeKey={activeKeys}
        onChange={setActiveKeys}
        size="small"
        items={items}
        style={{ background: 'var(--bg-raised)' }}
      />
    </div>
  );
}
