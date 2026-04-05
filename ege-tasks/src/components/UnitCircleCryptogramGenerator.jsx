import { useRef, useState } from 'react';
import katex from 'katex';
import {
  Card, Button, Input, Select, Radio, Checkbox,
  Divider, Space, Modal, List, Typography, Tag, Popconfirm,
} from 'antd';
import {
  ReloadOutlined, PrinterOutlined, SaveOutlined, FolderOpenOutlined,
  DeleteOutlined, CodeSandboxOutlined, KeyOutlined
} from '@ant-design/icons';
import { useCryptogram } from '../hooks/useCryptogram';
import UnitCircleSVG from './trig/UnitCircleSVG';
import CryptogramPrintLayout from './trig/CryptogramPrintLayout';
import './UnitCircleCryptogramGenerator.css';

const { Text } = Typography;
const { TextArea } = Input;

function MathInline({ latex }) {
  let html;
  try { html = katex.renderToString(latex, { throwOnError: false, displayMode: false }); }
  catch { html = latex; }
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

const SHOW_AXES_OPTIONS = [
  { value: 'none', label: 'Ничего' },
  { value: 'axes', label: 'Только оси (0, π/2, π, 3π/2)' },
  { value: 'all',  label: 'Все стандартные углы' },
];

const MAX_K_OPTIONS = [
  { value: 0, label: '0  (только [0, 2π))' },
  { value: 1, label: '±1  (±2π)' },
  { value: 2, label: '±2  (±4π)' },
  { value: 3, label: '±3  (±6π)' },
  { value: 4, label: '±4  (±8π)' },
];

export default function UnitCircleCryptogramGenerator() {
  const [showLoadModal, setShowLoadModal] = useState(false);

  const {
    title, setTitle,
    wordsText, setWordsText,
    settings, updateSetting,
    tasksData,
    savedId,
    saved, loadingSaved, saving,
    generate, reset,
    loadSavedList, saveWorksheet, loadWorksheet, deleteWorksheet
  } = useCryptogram();

  const handlePrint = () => {
    const style = document.createElement('style');
    style.id = 'crg-print-page-style';
    style.textContent = '@page { size: A4 portrait; margin: 7mm; }';
    document.head.appendChild(style);
    window.print();
    setTimeout(() => {
      const s = document.getElementById('crg-print-page-style');
      if (s) s.remove();
    }, 1500);
  };

  const handleOpenLoad = async () => {
    await loadSavedList();
    setShowLoadModal(true);
  };

  return (
    <div className="crg-root">
      {/* Заголовок */}
      <div className="crg-header">
        <KeyOutlined style={{ fontSize: 22, color: '#1677ff' }} />
        <Input
          className="crg-title-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Название (для сохранения)"
          size="middle"
        />
      </div>

      <div className="crg-layout">
        {/* ── Панель настроек ─────────────────────────────────────── */}
        <Card className="crg-settings-card" size="small" title="Настройки шифровок">

          <div className="crg-settings-section">
            <div className="crg-settings-label">Слова-ответы (по одному на строку)</div>
            <TextArea
              rows={6}
              value={wordsText}
              onChange={e => setWordsText(e.target.value)}
              placeholder="СИНУС\nТАНГЕНС\nФУНКЦИЯ"
              style={{ fontFamily: 'monospace' }}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              Каждое слово станет отдельным заданием. Максимум 16 уникальных букв в слове.
            </Text>
          </div>

          <Divider style={{ margin: '10px 0' }} />

          <div className="crg-settings-section">
            <div className="crg-settings-label">Заданий на странице A4</div>
            <Radio.Group
              value={settings.circlesPerPage}
              onChange={e => updateSetting('circlesPerPage', e.target.value)}
              size="small"
            >
              <Radio.Button value={2}>2 варианта</Radio.Button>
              <Radio.Button value={4}>4 варианта</Radio.Button>
            </Radio.Group>
          </div>

          <div className="crg-settings-section">
            <div className="crg-settings-label">Смещение по ±k×2π</div>
            <Select
              value={settings.maxK}
              onChange={v => updateSetting('maxK', v)}
              options={MAX_K_OPTIONS}
              style={{ width: '100%' }}
              size="small"
            />
          </div>

          <Divider style={{ margin: '10px 0' }} />

          <div className="crg-settings-section">
            <div className="crg-settings-label">Подписи на окружности</div>
            <Select
              value={settings.showAxes}
              onChange={v => updateSetting('showAxes', v)}
              options={SHOW_AXES_OPTIONS}
              style={{ width: '100%' }}
              size="small"
            />
          </div>

          <div className="crg-settings-section">
            <Space direction="vertical" size={4}>
              <Checkbox
                checked={settings.showDegrees}
                onChange={e => updateSetting('showDegrees', e.target.checked)}
              >
                Показывать градусы (0°, 90°, 180°, 270°)
              </Checkbox>
              <Checkbox
                checked={settings.showTicks}
                onChange={e => updateSetting('showTicks', e.target.checked)}
              >
                Засечки на всех стандартных позициях
              </Checkbox>
              <Checkbox
                checked={settings.showTeacherKey}
                onChange={e => updateSetting('showTeacherKey', e.target.checked)}
              >
                Лист ответов учителя (Ключ)
              </Checkbox>
            </Space>
          </div>
        </Card>

        {/* ── Область превью ─────────────────────────────────────────── */}
        <div className="crg-preview">
          {/* Кнопки */}
          <div className="crg-actions">
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={generate}
            >
              Сгенерировать
            </Button>

            {tasksData && (
              <>
                <Button
                  icon={<PrinterOutlined />}
                  onClick={handlePrint}
                >
                  Печать
                </Button>
                <Button
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={saveWorksheet}
                >
                  {savedId ? 'Обновить' : 'Сохранить'}
                </Button>
              </>
            )}

            <Button
              icon={<FolderOpenOutlined />}
              onClick={handleOpenLoad}
            >
              Загрузить
            </Button>

            {tasksData && (
              <Popconfirm
                title="Сбросить всё?"
                onConfirm={reset}
                okText="Да"
                cancelText="Нет"
              >
                <Button danger>Сброс</Button>
              </Popconfirm>
            )}
          </div>

          {/* Превью страниц */}
          {!tasksData ? (
            <div className="crg-empty-hint">
              <CodeSandboxOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <span>Нажмите «Сгенерировать» чтобы создать шифровки по списку слов</span>
            </div>
          ) : (
            <div className="crg-pages-list">
              {tasksData.map((page, pi) => (
                <Card
                  key={pi}
                  className="crg-page-card"
                  size="small"
                  title={`Страница печати ${pi + 1}`}
                >
                  <div className={`crg-circles-grid layout-${settings.circlesPerPage}`}>
                    {page.map((task, ti) => (
                      <div key={ti} className="crg-task-preview">
                        <div className="crg-preview-label">Слово: <b>{task.word}</b></div>

                        <div className="crg-circle-svg-wrap">
                          <UnitCircleSVG
                            taskType="cryptogram"
                            isAnswer={false}
                            showAxes={settings.showAxes}
                            showDegrees={settings.showDegrees}
                            showTicks={settings.showTicks}
                            cipherMap={task.cipherMap}
                          />
                        </div>

                        <div className="crg-answers-preview">
                          <table className="crg-preview-table">
                            <thead>
                              <tr><th>Угол</th><th>БУКВА</th></tr>
                            </thead>
                            <tbody>
                              {task.questions.map((q, i) => (
                                <tr key={i}>
                                  <td><MathInline latex={q.display} /></td>
                                  <td className="crg-preview-letter-blank"></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Печатная вёрстка (скрыта на экране) ──────────────────────────── */}
      <CryptogramPrintLayout
        tasksData={tasksData}
        settings={settings}
        title={title}
      />

      {/* ── Модал загрузки ────────────────────────────────────────────────── */}
      <Modal
        title="Загрузить сохранённые шифровки"
        open={showLoadModal}
        onCancel={() => setShowLoadModal(false)}
        footer={null}
        width={500}
      >
        {saved.length === 0 && !loadingSaved ? (
          <Text type="secondary">Нет сохранённых листов с шифровками</Text>
        ) : (
          <List
            loading={loadingSaved}
            dataSource={saved}
            renderItem={item => (
              <div className="crg-saved-item">
                <div>
                  <div style={{ fontWeight: 600 }}>{item.title}</div>
                  <div className="crg-saved-meta">
                    <Tag color="cyan">Шифровка</Tag>
                    {item.variants_count} стр. ·{' '}
                    {new Date(item.created).toLocaleDateString('ru')}
                  </div>
                </div>
                <Space>
                  <Button size="small" onClick={() => {
                    loadWorksheet(item);
                    setShowLoadModal(false);
                  }}>
                    Загрузить
                  </Button>
                  <Popconfirm
                    title="Удалить?"
                    onConfirm={() => deleteWorksheet(item.id)}
                    okText="Да"
                    cancelText="Нет"
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              </div>
            )}
          />
        )}
      </Modal>
    </div>
  );
}
