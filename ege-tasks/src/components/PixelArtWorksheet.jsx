import { useCallback, useState } from 'react';
import {
  Card, Row, Col, Input, Button, Space, Alert, Switch,
  Typography, Divider, App, Radio, Popconfirm, Modal, List,
} from 'antd';
import {
  PrinterOutlined, PictureOutlined, DeleteOutlined,
  SaveOutlined, FolderOpenOutlined, EditOutlined, AppstoreOutlined, StarOutlined,
} from '@ant-design/icons';
import { api } from '../services/pocketbase';
import { usePixelArt } from '../hooks/usePixelArt';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import { suggestGridSize } from '../utils/imageToMatrix';
import QRTaskPanel from './qr-worksheet/QRTaskPanel';
import TeamImageUploader from './pixel-art-team/TeamImageUploader';
import GridSizeControls from './pixel-art/GridSizeControls';
import PixelArtPrintLayout from './pixel-art/PixelArtPrintLayout';
import MatrixEditor from './pixel-art/MatrixEditor';
import PixelArtImageLibraryModal from './pixel-art/PixelArtImageLibraryModal';
import './PixelArtWorksheet.css';

const { Text } = Typography;

export default function PixelArtWorksheet() {
  const { message } = App.useApp();
  const { topics, subtopics, tags } = useReferenceData();
  const [twoColumns, setTwoColumns] = useState(false);
  const [editorModalOpen, setEditorModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [savedSheets, setSavedSheets] = useState([]);
  const [loadingSheets, setLoadingSheets] = useState(false);

  // Библиотека картинок
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryImages, setLibraryImages] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const [libraryImageId, setLibraryImageId] = useState(null); // ID записи в библиотеке (null = новая)

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
    toggleCell, clearMatrix, fillMatrix, invertMatrix,
    setMatrix,
    savedId, setSavedId,
  } = usePixelArt();

  // ── Загрузка изображения ──────────────────────────────────────────────────
  const handleImageChange = useCallback((file) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      setImageDimensions({ width: img.width, height: img.height });
      setImageFile(file);
      setLibraryImageId(null);
      // Авто-подбираем размер сетки под пропорции — TeamImageUploader сам запустит обработку
      const { cols, rows } = suggestGridSize(img.width, img.height, gridCols);
      setGridCols(cols);
      setGridRows(rows);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }, [gridCols, setImageFile, setImageDimensions, setGridCols, setGridRows]);

  // ── «Пересчитать» — теперь TeamImageUploader делает это автоматически ─────
  const handleApply = () => {};

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

  const handleLoad = async (record) => {
    setLoadModalOpen(false);
    try {
      // Список загружается без matrix/grid/expand — берём полную запись по ID
      const full = await api.getPixelArtWorksheet(record.id);
      loadFromSaved(full);
      setTwoColumns(!!full.two_columns);
      setLibraryImageId(null); // сбрасываем привязку к библиотеке — это готовый лист, не картинка
      message.success('Пиксель-арт загружен');
    } catch (e) {
      message.error('Ошибка загрузки: ' + (e.message || e));
    }
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

  // ── Библиотека картинок ───────────────────────────────────────────────────
  const handleOpenLibrary = async () => {
    setLibraryOpen(true);
    setLibraryLoading(true);
    try {
      const imgs = await api.getPixelArtImages();
      setLibraryImages(imgs);
    } catch (e) {
      message.error('Ошибка загрузки библиотеки');
    } finally {
      setLibraryLoading(false);
    }
  };

  const handleSelectFromLibrary = (record) => {
    setMatrix(record.matrix);
    setGridCols(record.grid_cols || 25);
    setGridRows(record.grid_rows || 25);
    setThreshold(record.threshold ?? 128);
    setImageFile(null);
    setImageDimensions(null);
    setLibraryImageId(record.id);
    setLibraryOpen(false);
    message.success(`Картинка «${record.title || 'Без названия'}» применена`);
  };

  const handleDeleteFromLibrary = async (id) => {
    try {
      await api.deletePixelArtImage(id);
      setLibraryImages(prev => prev.filter(img => img.id !== id));
      message.success('Удалено из библиотеки');
    } catch (e) {
      message.error('Ошибка удаления');
    }
  };

  const handleRenameInLibrary = async (id, newTitle) => {
    try {
      const updated = await api.updatePixelArtImage(id, { title: newTitle });
      setLibraryImages(prev => prev.map(img => img.id === id ? { ...img, title: updated.title } : img));
    } catch (e) {
      message.error('Ошибка переименования');
    }
  };

  const handleSaveToLibrary = async () => {
    if (!matrix) {
      message.warning('Сначала загрузите или нарисуйте картинку');
      return;
    }
    setSavingToLibrary(true);
    // Берём реальные размеры из матрицы (могут отличаться от слайдеров если не нажали «Пересчитать»)
    const actualCols = matrix[0]?.length || gridCols;
    const actualRows = matrix.length || gridRows;
    const data = {
      title: title || 'Раскраска',
      matrix,
      grid_cols: actualCols,
      grid_rows: actualRows,
      threshold,
    };
    try {
      if (libraryImageId) {
        const updated = await api.updatePixelArtImage(libraryImageId, data);
        setLibraryImages(prev => prev.map(img => img.id === libraryImageId ? { ...img, ...updated } : img));
        message.success('Картинка в библиотеке обновлена');
      } else {
        const img = await api.createPixelArtImage(data);
        setLibraryImageId(img.id);
        setLibraryImages(prev => [img, ...prev]);
        message.success('Картинка сохранена в библиотеку');
      }
    } catch (e) {
      message.error('Ошибка сохранения в библиотеку: ' + (e.message || e));
    } finally {
      setSavingToLibrary(false);
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
  const placeholderText = !matrix
    ? 'Загрузите изображение или выберите из библиотеки'
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
            <Card
              size="small"
              title="Изображение"
              extra={
                <Button
                  size="small"
                  icon={<AppstoreOutlined />}
                  onClick={handleOpenLibrary}
                >
                  Библиотека
                </Button>
              }
            >
              {libraryImageId && !imageFile && (
                <Alert
                  type="info"
                  showIcon
                  message={
                    <span>
                      Картинка из библиотеки{' '}
                      <Text style={{ fontSize: 12 }}>
                        ({(matrix?.[0]?.length || 0)}×{(matrix?.length || 0)} кл.)
                      </Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Загрузите новое изображение, чтобы заменить. Для правок — «Редактор пикселей».
                      </Text>
                    </span>
                  }
                  style={{ marginBottom: 10, fontSize: 12 }}
                />
              )}
              <TeamImageUploader
                imageFile={imageFile}
                gridCols={gridCols}
                gridRows={gridRows}
                threshold={threshold}
                onImageChange={handleImageChange}
                onMatrixChange={setMatrix}
                onThresholdChange={setThreshold}
              />
              {matrix && (
                <Button
                  size="small"
                  icon={<StarOutlined />}
                  loading={savingToLibrary}
                  onClick={handleSaveToLibrary}
                  style={{ marginTop: 10 }}
                  type={libraryImageId ? 'default' : 'default'}
                  block
                >
                  {libraryImageId ? 'Обновить в библиотеке' : 'Сохранить в библиотеку'}
                </Button>
              )}
            </Card>

            {/* Кнопка редактора пикселей */}
            {matrix && (
              <Button
                icon={<EditOutlined />}
                onClick={() => setEditorModalOpen(true)}
                block
              >
                Редактор пикселей
              </Button>
            )}

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
                hasImage={!!imageFile}
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

      {/* ── Полноэкранный редактор матрицы ── */}
      <Modal
        open={editorModalOpen}
        onCancel={() => setEditorModalOpen(false)}
        footer={null}
        title="Редактор пикселей"
        width="100vw"
        style={{ top: 0, padding: 0, maxWidth: '100vw' }}
        styles={{
          body: {
            padding: '12px 16px',
            height: 'calc(100vh - 55px)',
            overflow: 'auto',
          },
          content: { borderRadius: 0 },
        }}
        destroyOnHidden={false}
      >
        {matrix && (
          <MatrixEditor
            matrix={matrix}
            onToggleCell={toggleCell}
            onClear={clearMatrix}
            onFill={fillMatrix}
            onInvert={invertMatrix}
            availWidth={typeof window !== 'undefined' ? window.innerWidth - 48 : 800}
            availHeight={typeof window !== 'undefined' ? window.innerHeight - 160 : 600}
          />
        )}
      </Modal>

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

      {/* ── Модал библиотеки картинок ── */}
      <PixelArtImageLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        images={libraryImages}
        loading={libraryLoading}
        onSelect={handleSelectFromLibrary}
        onDelete={handleDeleteFromLibrary}
        onRename={handleRenameInLibrary}
      />

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
                    {Array.isArray(sheet.tasks) ? sheet.tasks.length : 0} задач · {sheet.grid_cols}×{sheet.grid_rows} · {new Date(sheet.created).toLocaleDateString('ru-RU')}
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
