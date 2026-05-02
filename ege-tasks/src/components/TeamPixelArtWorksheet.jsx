import { useState } from 'react';
import { Button, Radio, Slider, Switch, message, Modal, List, Popconfirm } from 'antd';
import { PrinterOutlined, SaveOutlined, TeamOutlined, FolderOpenOutlined, DatabaseOutlined, DeleteOutlined } from '@ant-design/icons';
import { TrigGeneratorLayout, TrigSettingsSection, TrigPreviewPane, TrigStatBadge } from './trig/TrigGeneratorLayout';
import ImageUploader from './pixel-art/ImageUploader';
import PixelArtImageLibraryModal from './pixel-art/PixelArtImageLibraryModal';
import TeamTileTasksEditor from './pixel-art-team/TeamTileTasksEditor';
import TeamPixelArtPrintLayout from './pixel-art-team/TeamPixelArtPrintLayout';
import TaskEditModal from './TaskEditModal';
import { useTeamPixelArt } from '../hooks/useTeamPixelArt';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { api } from '../services/pocketbase';
import { snapToTileCount } from '../utils/splitMatrix';
import './pixel-art-team/TeamPixelArtPrintLayout.css';

const TILE_OPTIONS = [
  { value: 2, label: '2×2 = 4 плитки' },
  { value: 3, label: '3×3 = 9 плиток' },
  { value: 4, label: '4×4 = 16 плиток' },
];

export default function TeamPixelArtWorksheet() {
  const pa = useTeamPixelArt();
  const { topics, subtopics, tags, sources, years } = useReferenceData();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryImages, setLibraryImages] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedSets, setSavedSets] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [loadingId, setLoadingId] = useState(null);

  // ── Обработка изображения ─────────────────────────────────────────────────
  const handleImageChange = (file, dims) => {
    pa.setImageFile(file);
    if (file) {
      const snapped = snapToTileCount(pa.gridSize, pa.tileCount);
      pa.processImage(file, snapped, pa.threshold);
    }
  };

  const handleGridSizeChange = (val) => {
    const snapped = snapToTileCount(val, pa.tileCount);
    pa.setGridSize(snapped);
    if (pa.imageFile) pa.processImage(pa.imageFile, snapped, pa.threshold);
  };

  const handleThresholdChange = (val) => {
    pa.setThreshold(val);
    if (pa.imageFile) pa.processImage(pa.imageFile, pa.gridSize, val);
  };

  const handleTileCountChange = (val) => {
    pa.changeTileCount(val);
    if (pa.imageFile) {
      const snapped = snapToTileCount(pa.gridSize, val);
      pa.processImage(pa.imageFile, snapped, pa.threshold);
    }
  };

  // ── Загрузка из библиотеки ────────────────────────────────────────────────
  const openLibrary = async () => {
    setLibraryOpen(true);
    setLibraryLoading(true);
    try {
      const imgs = await api.getPixelArtImages();
      setLibraryImages(imgs);
    } catch {
      message.error('Не удалось загрузить библиотеку');
    } finally {
      setLibraryLoading(false);
    }
  };

  const loadFromLibrary = (img) => {
    const snapped = snapToTileCount(img.grid_cols ?? pa.gridSize, pa.tileCount);
    pa.setMatrix(img.matrix);
    pa.setGridSize(snapped);
    pa.setThreshold(img.threshold ?? 128);
    pa.setImageFile(null);
    setLibraryOpen(false);
  };

  // ── Загрузка сохранённых сетов ────────────────────────────────────────────
  const openSaved = async () => {
    setSavedOpen(true);
    setSavedLoading(true);
    try {
      setSavedSets(await api.getPixelArtTeamSets());
    } catch {
      message.error('Не удалось загрузить список');
    } finally {
      setSavedLoading(false);
    }
  };

  const handleLoadSaved = async (setId) => {
    setLoadingId(setId);
    try {
      const [setRecord, tileRecords] = await Promise.all([
        api.getPixelArtTeamSet(setId),
        api.getPixelArtTeamTiles(setId),
      ]);
      // Собираем все уникальные ID задач (shared_tasks — relation IDs; tile.tasks — JSON IDs)
      const allIds = new Set([
        ...(setRecord.shared_tasks ?? []),
        ...tileRecords.flatMap(t => t.tasks ?? []),
      ]);
      const tasksMap = {};
      if (allIds.size > 0) {
        const tasks = await api.getTasksByIds([...allIds]);
        tasks.forEach(t => { tasksMap[t.id] = t; });
      }
      setRecord.expand = {
        shared_tasks: (setRecord.shared_tasks ?? []).map(id => tasksMap[id]).filter(Boolean),
      };
      const enrichedTiles = tileRecords.map(tile => ({
        ...tile,
        expand: { tasks: (tile.tasks ?? []).map(id => tasksMap[id]).filter(Boolean) },
      }));
      pa.loadFromSaved(setRecord, enrichedTiles);
      setSavedOpen(false);
      message.success('Загружено');
    } catch {
      message.error('Ошибка загрузки');
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeleteSaved = async (setId) => {
    try {
      await api.deletePixelArtTeamSet(setId);
      setSavedSets(prev => prev.filter(s => s.id !== setId));
      if (pa.savedId === setId) pa.reset();
      message.success('Удалено');
    } catch {
      message.error('Ошибка удаления');
    }
  };

  // ── Редактирование задачи ─────────────────────────────────────────────────
  const handleSaveTaskEdit = async (taskId, values) => {
    await api.updateTask(taskId, values);
    // Обновляем задачу везде где она может быть: в shared и во всех плитках
    pa.setSharedTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...values } : t));
    pa.setTileTasks(prev => prev.map(arr => arr.map(t => t.id === taskId ? { ...t, ...values } : t)));
    setEditingTask(null);
    message.success('Задача обновлена');
  };

  // ── Печать ────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!pa.matrix) { message.warning('Сначала загрузите изображение'); return; }
    const readyTiles = pa.tileGrids.filter(Boolean).length;
    if (readyTiles === 0) { message.warning('Добавьте задачи хотя бы к одной плитке'); return; }
    const style = document.createElement('style');
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.head.removeChild(style), 1500);
  };

  // ── Сохранение ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      await pa.save();
      message.success('Сохранено');
    } catch {
      message.error('Ошибка сохранения');
    }
  };

  // ── Статус плиток ─────────────────────────────────────────────────────────
  const readyCount = pa.tileGrids.filter(Boolean).length;

  // ── Превью плиток (миниатюры) ─────────────────────────────────────────────
  const renderTilePreview = () => {
    if (!pa.matrix) return null;
    const size = 60; // px на плитку
    const tileH = pa.tiles[0]?.length ?? 1;
    const tileW = pa.tiles[0]?.[0]?.length ?? 1;

    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${pa.tileCount}, ${size}px)`,
        gap: 4,
        padding: 12,
        background: 'var(--bg-sunken)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--rule-soft)',
        width: 'fit-content',
      }}>
        {pa.tiles.map((tile, i) => {
          const hasGrid = !!pa.tileGrids[i];
          return (
            <div key={i} style={{ position: 'relative' }}>
              <canvas
                ref={el => {
                  if (!el || !tile?.length) return;
                  const ctx = el.getContext('2d');
                  ctx.clearRect(0, 0, size, size);
                  const ch = size / tileH;
                  const cw = size / tileW;
                  tile.forEach((row, r) => {
                    row.forEach((cell, c) => {
                      ctx.fillStyle = cell ? '#1a1a1a' : '#f0f0f0';
                      ctx.fillRect(c * cw, r * ch, cw, ch);
                    });
                  });
                  // Рамка
                  ctx.strokeStyle = hasGrid ? '#0d9488' : '#d97706';
                  ctx.lineWidth = 2;
                  ctx.strokeRect(1, 1, size - 2, size - 2);
                }}
                width={size}
                height={size}
                style={{ display: 'block', borderRadius: 4 }}
              />
              <div style={{
                position: 'absolute', bottom: 2, right: 3,
                fontSize: 10, fontWeight: 700,
                color: hasGrid ? '#0d9488' : '#d97706',
                textShadow: '0 0 3px #fff',
              }}>
                {i + 1}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ── Левая панель ──────────────────────────────────────────────────────────
  const left = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', paddingRight: 2 }}>

      {/* Изображение */}
      <TrigSettingsSection label="Изображение">
        <ImageUploader
          imageFile={pa.imageFile}
          matrix={pa.matrix}
          processing={pa.processing}
          error={pa.error}
          gridCols={pa.gridSize}
          gridRows={pa.gridSize}
          threshold={pa.threshold}
          onImageChange={handleImageChange}
        />
        <div style={{ marginTop: 8 }}>
          <Button
            size="small"
            icon={<FolderOpenOutlined />}
            onClick={openLibrary}
            style={{ color: 'var(--ink-3)' }}
          >
            Из библиотеки
          </Button>
        </div>
      </TrigSettingsSection>

      {/* Параметры деления */}
      <TrigSettingsSection label="Деление на плитки">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>Количество плиток</div>
            <Radio.Group
              value={pa.tileCount}
              onChange={e => handleTileCountChange(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              size="small"
              options={TILE_OPTIONS}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>
              Общая сетка: {pa.gridSize}×{pa.gridSize}
              <span style={{ fontSize: 11, marginLeft: 6, color: 'var(--ink-4)' }}>
                → плитка {pa.gridSize / pa.tileCount}×{pa.gridSize / pa.tileCount} на A4
              </span>
            </div>
            <Slider
              min={pa.tileCount * 4}
              max={pa.tileCount * 40}
              step={pa.tileCount}
              value={pa.gridSize}
              onChange={handleGridSizeChange}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>
              Порог бинаризации: {pa.threshold}
            </div>
            <Slider min={50} max={220} value={pa.threshold} onChange={handleThresholdChange} />
          </div>
        </div>
      </TrigSettingsSection>

      {/* Режим задач */}
      <TrigSettingsSection label="Режим задач">
        <Radio.Group
          value={pa.taskMode}
          onChange={e => pa.setTaskMode(e.target.value)}
          size="small"
          style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <Radio value="per_tile">
            <span style={{ fontSize: 13 }}>Разные задачи для каждой плитки</span>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginLeft: 22 }}>
              У каждого ученика своё уникальное задание
            </div>
          </Radio>
          <Radio value="same">
            <span style={{ fontSize: 13 }}>Одинаковые задачи для всех</span>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginLeft: 22 }}>
              Все решают одно, красят разные части
            </div>
          </Radio>
        </Radio.Group>
      </TrigSettingsSection>

      {/* Опции печати */}
      <TrigSettingsSection label="Печать">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <Switch size="small" checked={pa.twoSheets} onChange={pa.setTwoSheets} />
            Задачи и сетка на разных листах
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <Switch size="small" checked={pa.twoColumns} onChange={pa.setTwoColumns} />
            Задачи в две колонки
          </label>
        </div>
      </TrigSettingsSection>

      {/* Действия */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Button
          type="primary"
          icon={<PrinterOutlined />}
          onClick={handlePrint}
          disabled={!pa.matrix || readyCount === 0}
          block
        >
          Печатать все листы ({readyCount > 0 ? `${readyCount + 1} стр.` : '—'})
        </Button>
        <Button
          icon={<SaveOutlined />}
          onClick={handleSave}
          disabled={!pa.matrix}
          loading={pa.saving}
          block
        >
          Сохранить
        </Button>
        <Button
          icon={<DatabaseOutlined />}
          onClick={openSaved}
          block
        >
          Загрузить сохранённое
        </Button>
      </div>
    </div>
  );

  // ── Правая панель ─────────────────────────────────────────────────────────
  const right = (
    <TrigPreviewPane
      hasData={!!pa.matrix}
      emptyIcon={<TeamOutlined />}
      emptyTitle="Загрузите изображение"
      emptyHint="Оно будет разделено на равные части для каждого ученика"
      summary={pa.matrix ? [
        <TrigStatBadge key="tiles">{pa.tileCount}×{pa.tileCount} = {pa.totalTiles} плиток</TrigStatBadge>,
        <TrigStatBadge key="ready" tone={readyCount === pa.totalTiles ? 'success' : 'default'}>
          {readyCount}/{pa.totalTiles} готово
        </TrigStatBadge>,
      ] : null}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Превью плиток */}
        {pa.matrix && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 8 }}>
              Предпросмотр плиток
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink-4)' }}>
                зелёная рамка = задачи заданы
              </span>
            </div>
            {renderTilePreview()}
          </div>
        )}

        {/* Редактор задач */}
        {pa.matrix && (
          <TeamTileTasksEditor
            taskMode={pa.taskMode}
            totalTiles={pa.totalTiles}
            tileCount={pa.tileCount}
            sharedTasks={pa.sharedTasks}
            sharedAnswers={pa.sharedAnswers}
            onAddShared={pa.addSharedTask}
            onRemoveShared={pa.removeSharedTask}
            onMoveShared={pa.moveSharedTask}
            onSetSharedAnswer={pa.setSharedCustomAnswer}
            getSharedAnswerForTask={pa.getSharedAnswerForTask}
            tileTasks={pa.tileTasks}
            tileAnswers={pa.tileAnswers}
            onAddTile={pa.addTileTask}
            onRemoveTile={pa.removeTileTask}
            onMoveTile={pa.moveTileTask}
            onSetTileAnswer={pa.setTileCustomAnswer}
            getTileAnswerForTask={pa.getTileAnswerForTask}
            onCopyTileToAll={pa.copyTileTasksToAll}
            topics={topics}
            subtopics={subtopics}
            tags={tags}
            tileGrids={pa.tileGrids}
            onEditTask={setEditingTask}
          />
        )}
      </div>
    </TrigPreviewPane>
  );

  return (
    <>
      <TrigGeneratorLayout
        icon={<TeamOutlined />}
        title={pa.title}
        onTitleChange={pa.setTitle}
        titlePlaceholder="Командная раскраска"
        leftWidth={360}
        left={left}
        right={right}
      />

      {/* Область печати: скрыта на экране через CSS (.team-pixel-art-print-wrapper display:none) */}
      <div className="team-pixel-art-print-wrapper">
      <TeamPixelArtPrintLayout
        title={pa.title}
        tileCount={pa.tileCount}
        tiles={pa.tiles}
        tileGrids={pa.tileGrids}
        tileTasks={pa.tileTasks}
        tileAnswers={pa.tileAnswers}
        taskMode={pa.taskMode}
        sharedTasks={pa.sharedTasks}
        sharedAnswers={pa.sharedAnswers}
        twoSheets={pa.twoSheets}
        twoColumns={pa.twoColumns}
        fullMatrix={pa.matrix}
      />
      </div>

      {/* Библиотека изображений */}
      <PixelArtImageLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        images={libraryImages}
        loading={libraryLoading}
        onSelect={loadFromLibrary}
        onDelete={async (id) => {
          await api.deletePixelArtImage(id);
          setLibraryImages(prev => prev.filter(img => img.id !== id));
        }}
        onRename={async (id, title) => {
          await api.updatePixelArtImage(id, { title });
          setLibraryImages(prev => prev.map(img => img.id === id ? { ...img, title } : img));
        }}
      />

      {/* Список сохранённых */}
      <Modal
        title="Сохранённые командные раскраски"
        open={savedOpen}
        onCancel={() => setSavedOpen(false)}
        footer={null}
        width={520}
      >
        <List
          loading={savedLoading}
          dataSource={savedSets}
          locale={{ emptyText: 'Нет сохранённых работ' }}
          renderItem={(set) => (
            <List.Item
              actions={[
                <Button
                  key="load"
                  type="primary"
                  size="small"
                  loading={loadingId === set.id}
                  onClick={() => handleLoadSaved(set.id)}
                >
                  Загрузить
                </Button>,
                <Popconfirm
                  key="del"
                  title="Удалить эту раскраску?"
                  onConfirm={() => handleDeleteSaved(set.id)}
                  okText="Да"
                  cancelText="Нет"
                >
                  <Button size="small" danger type="text" icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={set.title || 'Без названия'}
                description={
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    {set.tile_count}×{set.tile_count} плиток
                    {' · '}{set.task_mode === 'per_tile' ? 'разные задачи' : 'общие задачи'}
                    {' · '}{new Date(set.created).toLocaleDateString('ru')}
                  </span>
                }
              />
            </List.Item>
          )}
        />
      </Modal>

      {/* Редактирование задачи */}
      <TaskEditModal
        task={editingTask}
        visible={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSave={handleSaveTaskEdit}
        onDelete={null}
        allTags={tags || []}
        allSources={sources || []}
        allYears={years || []}
        allSubtopics={subtopics || []}
        allTopics={topics || []}
      />
    </>
  );
}
