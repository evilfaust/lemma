import { useCallback, useState } from 'react';
import {
  Card, Row, Col, Input, Button, Space, Alert, Switch,
  Typography, Divider, App, Radio, Popconfirm, Modal, List,
} from 'antd';
import {
  PrinterOutlined, PictureOutlined, DeleteOutlined,
  SaveOutlined, FolderOpenOutlined,
} from '@ant-design/icons';
import api from '../services/pocketbase';
import { usePixelArt } from '../hooks/usePixelArt';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { suggestGridSize } from '../utils/imageToMatrix';
import QRTaskPanel from './qr-worksheet/QRTaskPanel';
import ImageUploader from './pixel-art/ImageUploader';
import GridSizeControls from './pixel-art/GridSizeControls';
import PixelArtPrintLayout from './pixel-art/PixelArtPrintLayout';
import './PixelArtWorksheet.css';

const { Text } = Typography;

export default function PixelArtWorksheet() {
  const { message } = App.useApp();
  const { topics, subtopics, tags } = useReferenceData();
  const [twoColumns, setTwoColumns] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [savedSheets, setSavedSheets] = useState([]);
  const [loadingSheets, setLoadingSheets] = useState(false);

  const {
    imageFile, setImageFile,
    imageDimensions, setImageDimensions,
    matrix, grid,
    gridCols, setGridCols,
    gridRows, setGridRows,
    threshold, setThreshold,
    lockAspect, setLockAspect,
    tasks, addTask, removeTask, moveTask, updateTask,
    customAnswers, setCustomAnswer, getAnswerForTask,
    title, setTitle,
    twoSheets, setTwoSheets,
    showTeacherKey, setShowTeacherKey,
    processing, error,
    processImage, reset, loadFromSaved,
    savedId, setSavedId,
  } = usePixelArt();

  // ── Загрузка изображения ──────────────────────────────────────────────────
  const handleImageChange = useCallback((file) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const dims = { width: img.width, height: img.height };
      setImageDimensions(dims);
      setImageFile(file);
      // Авто-подбираем размер сетки под пропорции изображения
      const { cols, rows } = suggestGridSize(img.width, img.height, gridCols);
      setGridCols(cols);
      setGridRows(rows);
      processImage(file, cols, rows, threshold);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [gridCols, threshold, setImageFile, setImageDimensions, setGridCols, setGridRows, processImage]);

  // ── Пересчёт по кнопке «Пересчитать» ─────────────────────────────────────
  const handleApply = () => {
    if (!imageFile) {
      message.warning('Сначала загрузите изображение');
      return;
    }
    processImage(imageFile, gridCols, gridRows, threshold);
  };

  // ── Изменение cols/rows с учётом блокировки пропорций ────────────────────
  // Логика блокировки — в GridSizeControls, здесь просто сеттеры
  const handleColsChange = (val) => { if (val) setGridCols(val); };
  const handleRowsChange = (val) => { if (val) setGridRows(val); };

  // ── Сохранение / загрузка ─────────────────────────────────────────────────
  const handleSave = async () => {
    if (!grid) {
      message.warning('Добавьте задачи с числовыми ответами');
      return;
    }
    setSaving(true);
    try {
      const data = {
        title: title || 'Раскраска',
        tasks: tasks.map(t => t.id),
        custom_answers: customAnswers,
        grid,
        matrix,
        grid_cols: gridCols,
        grid_rows: gridRows,
        threshold,
        two_sheets: twoSheets,
        show_teacher_key: showTeacherKey,
        two_columns: twoColumns,
      };
      if (savedId) {
        await api.updatePixelArtWorksheet(savedId, data);
        message.success('Пиксель-арт обновлён');
      } else {
        const record = await api.createPixelArtWorksheet(data);
        setSavedId(record.id);
        message.success('Пиксель-арт сохранён');
      }
    } catch (e) {
      message.error('Ошибка сохранения: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handleOpenLoad = async () => {
    setLoadModalOpen(true);
    setLoadingSheets(true);
    try {
      const sheets = await api.getPixelArtWorksheets();
      setSavedSheets(sheets);
    } catch (e) {
      message.error('Ошибка загрузки списка');
    } finally {
      setLoadingSheets(false);
    }
  };

  const handleLoad = (record) => {
    loadFromSaved(record);
    setTwoColumns(!!record.two_columns);
    setLoadModalOpen(false);
    message.success('Пиксель-арт загружен');
  };

  const handleDeleteSaved = async (id) => {
    try {
      await api.deletePixelArtWorksheet(id);
      setSavedSheets(prev => prev.filter(s => s.id !== id));
      if (savedId === id) setSavedId(null);
      message.success('Удалено');
    } catch (e) {
      message.error('Ошибка удаления');
    }
  };

  // ── Печать ────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!grid) {
      message.warning('Добавьте задачи с числовыми ответами');
      return;
    }
    const style = document.createElement('style');
    style.id = 'pixel-art-print-page-style';
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const s = document.getElementById('pixel-art-print-page-style');
      if (s) document.head.removeChild(s);
    }, 1500);
  };

  // ── Placeholder ───────────────────────────────────────────────────────────
  const placeholderText = !imageFile
    ? 'Загрузите изображение'
    : !matrix
    ? 'Нажмите «Пересчитать»'
    : tasks.length === 0
    ? 'Добавьте задачи с числовыми ответами'
    : 'Идёт генерация…';

  return (
    <div className="pixel-art-container">
      <Row gutter={16} align="top" className="no-print">

        {/* ══ ЛЕВАЯ КОЛОНКА: настройки ══════════════════════════════════════ */}
        <Col xs={24} lg={10}>
          <Space direction="vertical" style={{ width: '100%' }} size={10}>

            {/* Заголовок */}
            <Card size="small" title="Заголовок листа">
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Раскраска"
                maxLength={80}
              />
            </Card>

            {/* Изображение */}
            <Card size="small" title="Изображение">
              <ImageUploader
                imageFile={imageFile}
                gridCols={gridCols}
                gridRows={gridRows}
                threshold={threshold}
                onImageChange={handleImageChange}
              />
            </Card>

            {/* Параметры сетки */}
            <Card size="small" title="Параметры сетки">
              <GridSizeControls
                gridCols={gridCols}
                gridRows={gridRows}
                threshold={threshold}
                onColsChange={handleColsChange}
                onRowsChange={handleRowsChange}
                onThresholdChange={setThreshold}
                imageDimensions={imageDimensions}
                lockAspect={lockAspect}
                onLockAspectChange={setLockAspect}
                onApply={handleApply}
                processing={processing}
                twoSheets={twoSheets}
              />
            </Card>

            {/* Задачи */}
            <Card
              size="small"
              title={
                <span>
                  Задачи{' '}
                  <Text type="secondary" style={{ fontWeight: 400, fontSize: 12 }}>
                    (числовые ответы → числа в сетке)
                  </Text>
                </span>
              }
            >
              <QRTaskPanel
                tasks={tasks}
                customAnswers={customAnswers}
                topics={topics}
                subtopics={subtopics}
                tags={tags}
                onAddTask={addTask}
                onRemoveTask={removeTask}
                onMoveTask={moveTask}
                onSetCustomAnswer={setCustomAnswer}
                getAnswerForTask={getAnswerForTask}
              />
            </Card>

            {/* Параметры печати */}
            <Card size="small" title="Параметры печати">
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <div>
                  <Text style={{ fontSize: 13, marginRight: 12 }}>Режим:</Text>
                  <Radio.Group
                    value={twoSheets ? 'two' : 'one'}
                    onChange={e => setTwoSheets(e.target.value === 'two')}
                    size="small"
                  >
                    <Radio.Button value="one">Один лист</Radio.Button>
                    <Radio.Button value="two">Два листа</Radio.Button>
                  </Radio.Group>
                </div>
                {twoSheets && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Лист 1 — задачи, Лист 2 — сетка (больше места для крупных клеток)
                  </Text>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch
                    checked={twoColumns}
                    onChange={setTwoColumns}
                    size="small"
                  />
                  <Text style={{ fontSize: 13 }}>Задачи в две колонки</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Switch
                    checked={showTeacherKey}
                    onChange={setShowTeacherKey}
                    size="small"
                  />
                  <Text style={{ fontSize: 13 }}>Страница-ключ для учителя</Text>
                </div>
              </Space>
            </Card>

            {error && <Alert type="error" message={error} showIcon closable />}

            {/* Кнопки сохранения */}
            <Row gutter={8}>
              <Col span={12}>
                <Button
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={saving}
                  disabled={!grid}
                  block
                >
                  {savedId ? 'Обновить' : 'Сохранить'}
                </Button>
              </Col>
              <Col span={12}>
                <Button
                  icon={<FolderOpenOutlined />}
                  onClick={handleOpenLoad}
                  block
                >
                  Загрузить
                </Button>
              </Col>
            </Row>

            {/* Кнопки */}
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handlePrint}
              block
              disabled={!grid}
              size="large"
            >
              Печатать
            </Button>

            <Divider style={{ margin: '4px 0' }} />

            <Popconfirm
              title="Сбросить всё?"
              description="Изображение, задачи и настройки будут удалены."
              onConfirm={reset}
              okText="Сбросить"
              cancelText="Отмена"
              okButtonProps={{ danger: true }}
            >
              <Button
                block
                size="small"
                type="text"
                danger
                icon={<DeleteOutlined />}
              >
                Сбросить всё
              </Button>
            </Popconfirm>

          </Space>
        </Col>

        {/* ══ ПРАВАЯ КОЛОНКА: превью ════════════════════════════════════════ */}
        <Col xs={24} lg={14}>
          <div className="pixel-art-preview-wrapper">
            {grid ? (
              <div className="pixel-art-a4-paper">
                {/* Превью — без print-класса, чтобы не триггерить @media print */}
                <PixelArtPrintLayout
                  title={title}
                  tasks={tasks}
                  grid={grid}
                  getAnswerForTask={getAnswerForTask}
                  showTeacherKey={showTeacherKey}
                  twoSheets={twoSheets}
                  twoColumns={twoColumns}
                  className=""
                />
              </div>
            ) : (
              <div className="pixel-art-placeholder">
                <PictureOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                <Text type="secondary" style={{ marginTop: 8 }}>
                  {placeholderText}
                </Text>
              </div>
            )}
          </div>
        </Col>

      </Row>

      {/* ── Скрытый печатный блок (вне превью, как в QRWorksheetGenerator) ── */}
      {grid && (
        <PixelArtPrintLayout
          title={title}
          tasks={tasks}
          grid={grid}
          getAnswerForTask={getAnswerForTask}
          showTeacherKey={showTeacherKey}
          twoSheets={twoSheets}
          twoColumns={twoColumns}
          className="pixel-art-print-root"
        />
      )}

      {/* ── Модал загрузки ── */}
      <Modal
        title={<Space><FolderOpenOutlined /><span>Загрузить пиксель-арт</span></Space>}
        open={loadModalOpen}
        onCancel={() => setLoadModalOpen(false)}
        footer={null}
        width={560}
      >
        <List
          loading={loadingSheets}
          dataSource={savedSheets}
          locale={{ emptyText: 'Нет сохранённых пиксель-артов' }}
          renderItem={(sheet) => (
            <List.Item
              actions={[
                <Button type="link" onClick={() => handleLoad(sheet)}>
                  Загрузить
                </Button>,
                <Popconfirm
                  title="Удалить этот пиксель-арт?"
                  onConfirm={() => handleDeleteSaved(sheet.id)}
                  okText="Да"
                  cancelText="Нет"
                >
                  <Button type="link" danger icon={<DeleteOutlined />} />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={sheet.title || 'Без названия'}
                description={
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {(sheet.tasks?.length ?? 0)} задач · {sheet.grid_cols}×{sheet.grid_rows} · {new Date(sheet.created).toLocaleDateString('ru-RU')}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      </Modal>
    </div>
  );
}
