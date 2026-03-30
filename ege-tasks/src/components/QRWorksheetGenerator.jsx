import { useRef, useState, useCallback } from 'react';
import {
  Card, Row, Col, Form, Input, Button, Space, Alert, Switch,
  Typography, Tooltip, Divider, App, Badge, Modal, List, Popconfirm, Select,
} from 'antd';
import {
  QrcodeOutlined, PrinterOutlined, ReloadOutlined,
  EyeOutlined, EyeInvisibleOutlined, InfoCircleOutlined,
  ThunderboltOutlined, SaveOutlined, FolderOpenOutlined, DeleteOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { api } from '../services/pocketbase';
import { useQRWorksheet } from '../hooks/useQRWorksheet';
import { useReferenceData } from '../contexts/ReferenceDataContext';
import TaskEditModal from './TaskEditModal';
import QRTaskPanel from './qr-worksheet/QRTaskPanel';
import QRGridPreview from './qr-worksheet/QRGridPreview';
import QRPrintLayout from './qr-worksheet/QRPrintLayout';
import './QRWorksheetGenerator.css';

const { Text } = Typography;

const QRWorksheetGenerator = () => {
  const { message, modal } = App.useApp();
  const { topics, subtopics, tags, sources, years } = useReferenceData();
  const printContainerRef = useRef(null);
  const [showTeacherKey, setShowTeacherKey] = useState(true);
  const [twoColumns, setTwoColumns] = useState(false);
  const [preFillFinder, setPreFillFinder] = useState(false);
  const [preFillTiming, setPreFillTiming] = useState(false);
  const [preFillFormat, setPreFillFormat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [savedSheets, setSavedSheets] = useState([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [works, setWorks] = useState([]);
  const [worksLoading, setWorksLoading] = useState(false);
  const [worksLoaded, setWorksLoaded] = useState(false);
  const [shortening, setShortening] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  const {
    tasks, addTask, removeTask, moveTask, updateTask,
    customAnswers, setCustomAnswer, getAnswerForTask, getAnswers,
    qrUrl, setQrUrl,
    matrix, grid,
    mode, setMode,
    title, setTitle,
    generating, error,
    generate, reset, loadFromSaved,
    qrSize,
  } = useQRWorksheet();

  const handleGenerate = async () => {
    const ok = await generate();
    if (ok) {
      message.success('QR-сетка сгенерирована!');
    } else if (error) {
      message.error(error);
    }
  };

  const handlePrint = () => {
    if (!grid) {
      message.warning('Сначала сгенерируйте сетку');
      return;
    }
    // Инжектируем @page прямо перед печатью, как в EgeVariantGenerator
    const style = document.createElement('style');
    style.id = 'qr-print-page-style';
    style.textContent = '@page { size: A4 portrait; margin: 0; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const s = document.getElementById('qr-print-page-style');
      if (s) document.head.removeChild(s);
    }, 1000);
  };

  const handleSave = async () => {
    if (!grid) {
      message.warning('Сначала сгенерируйте QR-сетку');
      return;
    }
    setSaving(true);
    try {
      await api.createQrWorksheet({
        title: title || 'QR-лист',
        qr_url: qrUrl,
        tasks: tasks.map(t => t.id),
        custom_answers: customAnswers,
        grid,
        qr_size: grid.length,
      });
      message.success('QR-лист сохранён');
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
      const sheets = await api.getQrWorksheets();
      setSavedSheets(sheets);
    } catch (e) {
      message.error('Ошибка загрузки списка');
    } finally {
      setLoadingSheets(false);
    }
  };

  const handleLoad = (record) => {
    loadFromSaved(record);
    setLoadModalOpen(false);
    message.success('QR-лист загружен');
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteQrWorksheet(id);
      setSavedSheets(prev => prev.filter(s => s.id !== id));
      message.success('Удалено');
    } catch (e) {
      message.error('Ошибка удаления');
    }
  };

  const handleShortenUrl = async () => {
    if (!qrUrl.trim()) return;
    if (qrUrl.includes('clck.ru')) {
      message.info('Ссылка уже сокращена');
      return;
    }
    setShortening(true);
    try {
      const resp = await fetch(`https://clck.ru/--?url=${encodeURIComponent(qrUrl.trim())}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const short = (await resp.text()).trim();
      if (!short.startsWith('http')) throw new Error('Неожиданный ответ сервиса');
      setQrUrl(short);
      message.success('Ссылка сокращена');
    } catch (e) {
      message.error('Не удалось сократить: ' + (e.message || e));
    } finally {
      setShortening(false);
    }
  };

  const handleWorksDropdownOpen = async (open) => {
    if (!open || worksLoaded) return;
    setWorksLoading(true);
    try {
      const list = await api.getWorks();
      setWorks(list);
      setWorksLoaded(true);
    } catch {
      message.error('Не удалось загрузить список работ');
    } finally {
      setWorksLoading(false);
    }
  };

  const handleWorkSelect = async (workId) => {
    try {
      const studentDomain = import.meta.env.VITE_STUDENT_URL || `${window.location.origin}/student`;
      let session = await api.getSessionByWork(workId);
      if (!session) {
        session = await api.createSession({ work: workId, is_open: true });
      }
      setQrUrl(`${studentDomain}/${session.id}`);
    } catch {
      message.error('Не удалось получить ссылку на работу');
    }
  };

  const handleSaveTaskEdit = async (taskId, values) => {
    await api.updateTask(taskId, values);
    updateTask(taskId, values);
    setEditingTask(null);
    message.success('Задача обновлена');
  };

  const answers = getAnswers();
  const hasValidTasks = tasks.length > 0 && answers.length > 0;
  const canGenerate = hasValidTasks && qrUrl.trim().length > 0;

  return (
    <div className="qr-worksheet-container">
      <Alert
        message="QR-листы"
        description={
          <div>
            <div>Ученики решают 3–6 задач и находят числа-ответы в таблице.</div>
            <div>Закрашенные ячейки образуют QR-код, который ведёт к следующему заданию.</div>
          </div>
        }
        type="info"
        icon={<InfoCircleOutlined />}
        showIcon
        className="no-print"
        style={{ marginBottom: 16 }}
      />

      <Row gutter={24} className="no-print">
        {/* ── Левая колонка: настройки ── */}
        <Col xs={24} lg={12}>
          <Card title="Настройки листа" size="small" style={{ marginBottom: 16 }}>

            {/* Заголовок */}
            <Form layout="vertical">
              <Form.Item label="Заголовок листа" style={{ marginBottom: 12 }}>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Например: Квадратные уравнения, 9 класс"
                />
              </Form.Item>

              {/* URL */}
              <Form.Item
                label={
                  <span>
                    URL для QR-кода&nbsp;
                    <Tooltip title="Ссылка, которую ученик получит после правильного закрашивания. Может вести на условие финального задания или любой другой ресурс.">
                      <InfoCircleOutlined style={{ color: '#1890ff' }} />
                    </Tooltip>
                  </span>
                }
                style={{ marginBottom: 4 }}
              >
                <Input
                  value={qrUrl}
                  onChange={e => setQrUrl(e.target.value)}
                  placeholder="https://..."
                  prefix={<QrcodeOutlined />}
                  status={qrUrl && !qrUrl.startsWith('http') ? 'warning' : ''}
                  addonAfter={
                    <Tooltip title={qrUrl.includes('clck.ru') ? 'Ссылка уже сокращена' : 'Сократить через clck.ru — уменьшит размер QR-кода'}>
                      <Button
                        type="link"
                        size="small"
                        loading={shortening}
                        disabled={!qrUrl.trim() || qrUrl.includes('clck.ru')}
                        onClick={handleShortenUrl}
                        style={{ padding: 0, height: 'auto', color: qrUrl.includes('clck.ru') ? '#52c41a' : undefined }}
                      >
                        {qrUrl.includes('clck.ru') ? '✓ сокращено' : 'Сократить'}
                      </Button>
                    </Tooltip>
                  }
                />
              </Form.Item>
              <Form.Item style={{ marginBottom: 12 }}>
                <Select
                  placeholder={<span><BookOutlined /> Или выбрать из «Моих работ»…</span>}
                  loading={worksLoading}
                  onDropdownVisibleChange={handleWorksDropdownOpen}
                  onSelect={handleWorkSelect}
                  showSearch
                  optionFilterProp="label"
                  value={null}
                  style={{ width: '100%' }}
                  options={works.map(w => ({ value: w.id, label: w.title || `Работа ${w.id.slice(0, 6)}` }))}
                />
                {qrSize && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    QR версия {Math.round((qrSize - 17) / 4)} → сетка {qrSize}×{qrSize} клеток
                  </Text>
                )}
              </Form.Item>
            </Form>

            <Divider style={{ margin: '8px 0' }} />

            {/* Задачи */}
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              Задачи <Badge count={tasks.length} style={{ backgroundColor: tasks.length > 0 ? '#52c41a' : '#d9d9d9' }} />
            </div>
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
              onEditTask={setEditingTask}
            />

            {/* Итог ответов */}
            {answers.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Числа-ответы: {answers.map((a, i) => (
                    <Badge
                      key={i}
                      count={a}
                      style={{ backgroundColor: '#1890ff', marginRight: 4 }}
                    />
                  ))}
                </Text>
              </div>
            )}
          </Card>

          {/* Кнопки действий */}
          <Card size="small">
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleGenerate}
                loading={generating}
                disabled={!canGenerate}
                block
                size="large"
              >
                Сгенерировать QR-сетку
              </Button>

              {!canGenerate && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {!qrUrl.trim() && '• Введите URL для QR-кода  '}
                  {answers.length === 0 && '• Добавьте задачи с числовыми ответами'}
                </Text>
              )}

              <Row gutter={8}>
                <Col span={12}>
                  <Button
                    icon={mode === 'teacher' ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setMode(mode === 'student' ? 'teacher' : 'student')}
                    block
                    disabled={!grid}
                  >
                    {mode === 'teacher' ? 'Режим ученика' : 'Режим учителя'}
                  </Button>
                </Col>
                <Col span={12}>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={reset}
                    block
                    danger
                  >
                    Сбросить
                  </Button>
                </Col>
              </Row>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12 }}>Задачи в две колонки</Text>
                <Switch
                  checked={twoColumns}
                  onChange={setTwoColumns}
                  size="small"
                />
              </div>

              {grid && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12 }}>Печатать страницу-ключ для учителя</Text>
                  <Switch
                    checked={showTeacherKey}
                    onChange={setShowTeacherKey}
                    size="small"
                  />
                </div>
              )}

              {/* Предзакрашенные служебные зоны */}
              <Divider style={{ margin: '6px 0' }} />
              <div style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: 600 }}>
                  Предзакрашенные зоны{' '}
                  <Tooltip title="Служебные зоны QR-кода заранее напечатаны закрашенными. Ученик не тратит время на их заполнение. Это также снижает вероятность угадывания ответов по расположению.">
                    <InfoCircleOutlined style={{ color: '#1890ff' }} />
                  </Tooltip>
                </Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12 }}>Поисковые квадраты (углы)</Text>
                <Switch
                  checked={preFillFinder}
                  onChange={setPreFillFinder}
                  size="small"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12 }}>Тайминговые полосы</Text>
                <Switch
                  checked={preFillTiming}
                  onChange={setPreFillTiming}
                  size="small"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12 }}>Маска формата</Text>
                <Switch
                  checked={preFillFormat}
                  onChange={setPreFillFormat}
                  size="small"
                />
              </div>

              <Row gutter={8}>
                <Col span={12}>
                  <Button
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={saving}
                    disabled={!grid}
                    block
                  >
                    Сохранить
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

              <Button
                icon={<PrinterOutlined />}
                onClick={handlePrint}
                disabled={!grid}
                block
                size="large"
              >
                Печать
              </Button>
            </Space>
          </Card>
        </Col>

        {/* ── Правая колонка: превью сетки ── */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <span>
                Превью QR-сетки&nbsp;
                {mode === 'teacher' && (
                  <Badge.Ribbon text="Режим учителя" color="orange" />
                )}
              </span>
            }
            size="small"
          >
            <QRGridPreview
              grid={grid}
              mode={mode}
              loading={generating}
              matrix={matrix}
              preFillFinder={preFillFinder}
              preFillTiming={preFillTiming}
              preFillFormat={preFillFormat}
            />

            {error && (
              <Alert message={error} type="error" showIcon style={{ marginTop: 12 }} />
            )}

            {grid && mode === 'teacher' && (
              <Alert
                message="Тёмные клетки — это ответы. В режиме ученика все клетки одинаково белые."
                type="warning"
                showIcon
                style={{ marginTop: 12 }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* ── Модал редактирования задачи ── */}
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

      {/* ── Модал загрузки ── */}
      <Modal
        title={<Space><FolderOpenOutlined /><span>Загрузить QR-лист</span></Space>}
        open={loadModalOpen}
        onCancel={() => setLoadModalOpen(false)}
        footer={null}
        width={560}
      >
        <List
          loading={loadingSheets}
          dataSource={savedSheets}
          locale={{ emptyText: 'Нет сохранённых QR-листов' }}
          renderItem={(sheet) => (
            <List.Item
              actions={[
                <Button type="link" onClick={() => handleLoad(sheet)}>
                  Загрузить
                </Button>,
                <Popconfirm
                  title="Удалить этот QR-лист?"
                  onConfirm={() => handleDelete(sheet.id)}
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
                    {sheet.qr_url && <span>{sheet.qr_url.slice(0, 50)}{sheet.qr_url.length > 50 ? '…' : ''} · </span>}
                    {(sheet.tasks?.length ?? 0)} задач · {new Date(sheet.created).toLocaleDateString('ru-RU')}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      </Modal>

      {/* ── Скрытый печатный блок ── */}
      {grid && (
        <QRPrintLayout
          title={title}
          tasks={tasks}
          grid={grid}
          qrUrl={qrUrl}
          getAnswerForTask={getAnswerForTask}
          showTeacherKey={showTeacherKey}
          twoColumns={twoColumns}
          matrix={matrix}
          preFillFinder={preFillFinder}
          preFillTiming={preFillTiming}
          preFillFormat={preFillFormat}
        />
      )}
    </div>
  );
};

export default QRWorksheetGenerator;
