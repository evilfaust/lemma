import { useMemo, useState } from 'react';
import {
  Alert, Button, Card, Input, InputNumber, Progress, Result, Segmented, Select,
  Space, Table, Tag, Tooltip, Typography, Upload, App,
} from 'antd';
import {
  ArrowDownOutlined, ArrowUpOutlined, CloseOutlined, PictureOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useReferenceData } from '../../contexts/ReferenceDataContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/pocketbase';
import { useReshuWorkImport } from '../../hooks/useReshuWorkImport';
import {
  RESHU_EXAMS, detectReshuExam, extractReshuIds, extractVariantUrls, formatReshuList, reshuProblemUrl,
} from '../../utils/reshuTaskList';
import { compressImage } from '../../utils/imageProcessing';
import MathRenderer from '../MathRenderer';

const { TextArea } = Input;
const { Text } = Typography;

const EXAM_OPTIONS = Object.entries(RESHU_EXAMS).map(([value, { label }]) => ({ value, label }));

const STATUS_TAG = {
  bank: <Tag color="green">в банке</Tag>,
  reshu: <Tag color="blue">добавится с Решу</Tag>,
  missing: <Tag color="red">не найдена</Tag>,
};

/** Условие для превью в таблице: без картинок, коротко (сырой текст Решу — тоже). */
function previewText(md = '') {
  const text = String(md)
    .replace(/___BR___/g, '\n')
    .replace(/[\u00AD\u200B]/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)(\{[^}]*\})?/g, ' 🖼 ')
    .trim();
  return text.length > 220 ? `${text.slice(0, 220)}…` : text;
}

/**
 * Работа по номерам «Решу ЕГЭ/ОГЭ»: список номеров (текстом, ссылками,
 * скопированной страницей варианта или скриншотом) → работа в «Моих работах»
 * из задач банка. Чего нет в банке — добавляется с Решу в тему по номеру задания.
 */
export default function ReshuIdsImport() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { topics, reloadData } = useReferenceData();
  const { aiEnabled } = useAuth();

  const [examType, setExamType] = useState('ege_profile');
  const [text, setText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [workMeta, setWorkMeta] = useState({ title: '', classNumber: 11, timeLimit: null });

  const {
    rows, resolving, importing, progress, result, notes,
    resolve, updateRow, removeRow, moveRow, runImport, reset,
  } = useReshuWorkImport({ topics });

  const parsedCount = useMemo(
    () => extractReshuIds(text).items.length + extractVariantUrls(text).length,
    [text],
  );

  const examTopics = useMemo(() => topics
    .filter((t) => t.exam_type === examType)
    .sort((a, b) => (a.archived ? 1 : 0) - (b.archived ? 1 : 0) || (a.ege_number || 0) - (b.ege_number || 0)), [topics, examType]);

  const topicById = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics]);
  const topicLabel = (t) => (t ? `${t.ege_number ? `№${t.ege_number} — ` : ''}${t.title}${t.archived ? ' (архив)' : ''}` : '—');

  const handleTextChange = (value) => {
    setText(value);
    const detected = detectReshuExam(value);
    if (detected && detected !== examType) setExamType(detected);
  };

  const scanImage = async (file) => {
    if (!file?.type?.startsWith('image/')) {
      message.error('Нужна картинка (PNG/JPEG)');
      return false;
    }
    setScanning(true);
    try {
      // Мелкий шрифт списка — жмём мягче, чем фото бланка
      const dataUrl = await compressImage(file, 2200, 0.9);
      const { items = [] } = await api.scanTaskList({ imageBase64: dataUrl });
      if (!items.length) {
        message.warning('На картинке не нашлось номеров задач');
        return false;
      }
      const list = formatReshuList(items.map((it) => ({ id: it.id, typeLabel: it.type })));
      setText((prev) => (prev.trim() ? `${prev.trim()}\n${list}` : list));
      message.success(`Распознано номеров: ${items.length} — проверьте список и нажмите «Найти задачи»`);
    } catch (e) {
      message.error(e.message || 'Не удалось распознать картинку');
    } finally {
      setScanning(false);
    }
    return false;
  };

  const handlePaste = (e) => {
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    if (!aiEnabled) {
      message.warning('Распознавание картинок выключено для вашей учётной записи');
      return;
    }
    scanImage(file);
  };

  const handleResolve = async () => {
    try {
      const s = await resolve(text, examType);
      if (s.total === 0) {
        message.warning('Номеров задач в тексте не найдено');
        return;
      }
      const parts = [`в банке: ${s.bank}`];
      if (s.reshu) parts.push(`с Решу: ${s.reshu}`);
      if (s.missing) parts.push(`не найдено: ${s.missing}`);
      message.success(`Задач: ${s.total} (${parts.join(', ')})`);
    } catch (e) {
      console.error('[reshu-import] resolve:', e);
      message.error(`Не удалось найти задачи: ${e.message}`);
    }
  };

  const handleImport = async () => {
    try {
      const summary = await runImport({ workMeta, examType });
      if (summary.created) reloadData?.();
      message.success(`Работа сохранена: ${summary.reused} задач из банка, ${summary.created} добавлено с Решу`);
    } catch (e) {
      console.error('[reshu-import]', e);
      message.error(e.message);
    }
  };

  const handleReset = () => {
    reset();
    setText('');
    setWorkMeta({ title: '', classNumber: 11, timeLimit: null });
  };

  const activeRows = rows.filter((r) => r.status !== 'missing');
  // Номер в работе: ненайденные задачи в неё не попадут и номер не занимают
  const positionByKey = new Map(activeRows.map((r, i) => [r.key, i + 1]));
  const noTopic = rows.filter((r) => r.status === 'reshu' && !r.topicId).length;

  if (result) {
    return (
      <Result
        status={result.warnings.length ? 'warning' : 'success'}
        title="Работа сохранена"
        subTitle={`Из банка: ${result.reused}, добавлено с Решу: ${result.created}${result.failed ? `, не удалось: ${result.failed}` : ''}`}
        extra={[
          <Button key="open" type="primary" onClick={() => navigate(`/app/works/${result.work.id}/edit`)}>
            Открыть работу
          </Button>,
          <Button key="again" onClick={handleReset}>Собрать ещё одну</Button>,
        ]}
      >
        {result.warnings.length > 0 && (
          <Alert type="warning" showIcon message="Предупреждения" description={result.warnings.map((w) => <div key={w}>{w}</div>)} />
        )}
      </Result>
    );
  }

  const columns = [
    {
      title: '#', key: 'pos', width: 44,
      render: (_, r) => (positionByKey.has(r.key) ? <Text strong>{positionByKey.get(r.key)}</Text> : <Text type="secondary">—</Text>),
    },
    {
      title: '№ на Решу', key: 'id', width: 120,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <a href={reshuProblemUrl(r.sdamgiaId, examType)} target="_blank" rel="noreferrer">{r.sdamgiaId}</a>
          {r.typeLabel && <Text type="secondary" style={{ fontSize: 12 }}>тип {r.typeLabel}</Text>}
        </Space>
      ),
    },
    {
      title: 'Статус', key: 'status', width: 150,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          {STATUS_TAG[r.status]}
          {r.status === 'bank' && <Text type="secondary" style={{ fontSize: 12 }}>{r.bankTask.code}</Text>}
          {r.status === 'missing' && <Text type="secondary" style={{ fontSize: 12 }}>{r.error}</Text>}
        </Space>
      ),
    },
    {
      title: 'Тема', key: 'topic', width: 260,
      render: (_, r) => {
        if (r.status === 'bank') return topicLabel(topicById.get(r.bankTask.topic));
        if (r.status === 'missing') return '—';
        return (
          <Select
            style={{ width: '100%' }}
            status={r.topicId ? undefined : 'error'}
            placeholder="Выберите тему"
            value={r.topicId || undefined}
            onChange={(topicId) => updateRow(r.key, { topicId })}
            showSearch
            optionFilterProp="label"
            options={examTopics.map((t) => ({ value: t.id, label: topicLabel(t) }))}
          />
        );
      },
    },
    {
      title: 'Условие', key: 'statement',
      render: (_, r) => {
        const md = r.status === 'bank' ? r.bankTask.statement_md : r.problem?.condition;
        if (!md) return null;
        return (
          <div style={{ fontSize: 13, maxHeight: 88, overflow: 'hidden' }}>
            <MathRenderer text={previewText(md)} />
          </div>
        );
      },
    },
    {
      title: '', key: 'actions', width: 110,
      render: (_, r, i) => (
        <Space size={2}>
          <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={i === 0} onClick={() => moveRow(r.key, -1)} />
          <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={i === rows.length - 1} onClick={() => moveRow(r.key, 1)} />
          <Tooltip title="Убрать из работы">
            <Button size="small" type="text" danger icon={<CloseOutlined />} onClick={() => removeRow(r.key)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="Работа по номерам «Решу ЕГЭ»"
        description={(
          <div>
            Вставьте номера задач, ссылки <Text code>problem?id=…</Text>, ссылку на вариант
            (<Text code>test?id=…</Text>) или скопированную страницу варианта — порядок сохранится.
            Скриншот списка можно вставить прямо в поле (Ctrl+V) или загрузить кнопкой.
            Задачи берутся из банка Лемма по номеру Решу; каких нет — добавятся в банк
            в тему по номеру задания.
          </div>
        )}
      />

      <Card size="small">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space wrap>
            <Text>Экзамен:</Text>
            <Segmented value={examType} onChange={setExamType} options={EXAM_OPTIONS} />
            {aiEnabled && (
              <Upload accept="image/*" showUploadList={false} beforeUpload={scanImage} disabled={scanning}>
                <Button icon={<PictureOutlined />} loading={scanning}>Распознать скриншот</Button>
              </Upload>
            )}
          </Space>
          <TextArea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onPaste={handlePaste}
            placeholder={'27455\n509202\nhttps://ege.sdamgia.ru/problem?id=26662\nТип 12 № 504415'}
            autoSize={{ minRows: 6, maxRows: 16 }}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}
            disabled={scanning}
          />
          <Space wrap>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              loading={resolving}
              disabled={!parsedCount || scanning}
              onClick={handleResolve}
            >
              Найти задачи
            </Button>
            <Text type="secondary">
              {parsedCount ? `Номеров в списке: ${parsedCount}` : 'Номеров пока нет'}
            </Text>
          </Space>
          {resolving && progress.total > 0 && (
            <Progress percent={Math.round((progress.current / progress.total) * 100)} format={() => progress.label} />
          )}
        </Space>
      </Card>

      {rows.length > 0 && (
        <Card
          size="small"
          title={`Состав работы: ${activeRows.length} задач`}
          extra={(
            <Space size={4}>
              <Tag color="green">в банке {rows.filter((r) => r.status === 'bank').length}</Tag>
              <Tag color="blue">с Решу {rows.filter((r) => r.status === 'reshu').length}</Tag>
              {rows.some((r) => r.status === 'missing') && (
                <Tag color="red">не найдено {rows.filter((r) => r.status === 'missing').length}</Tag>
              )}
            </Space>
          )}
        >
          {notes.duplicates.length > 0 && (
            <Alert
              style={{ marginBottom: 12 }}
              type="warning"
              showIcon
              message={`Повторы в списке убраны: ${notes.duplicates.join(', ')}`}
            />
          )}
          <Table
            rowKey="key"
            size="small"
            pagination={false}
            columns={columns}
            dataSource={rows}
            scroll={{ x: 900 }}
            onRow={(r) => (r.status === 'missing' ? { style: { opacity: 0.55 } } : {})}
          />
        </Card>
      )}

      {activeRows.length > 0 && (
        <Card size="small" title="Работа">
          <Space wrap align="end">
            <div>
              <div><Text type="secondary">Название</Text></div>
              <Input
                style={{ width: 340 }}
                placeholder="Работа по номерам Решу"
                value={workMeta.title}
                onChange={(e) => setWorkMeta((m) => ({ ...m, title: e.target.value }))}
              />
            </div>
            <div>
              <div><Text type="secondary">Класс</Text></div>
              <InputNumber
                min={1}
                max={11}
                value={workMeta.classNumber}
                onChange={(v) => setWorkMeta((m) => ({ ...m, classNumber: v ?? null }))}
              />
            </div>
            <div>
              <div><Text type="secondary">Время, мин</Text></div>
              <InputNumber
                min={1}
                max={600}
                value={workMeta.timeLimit}
                onChange={(v) => setWorkMeta((m) => ({ ...m, timeLimit: v ?? null }))}
              />
            </div>
            <Button type="primary" loading={importing} disabled={noTopic > 0 || resolving} onClick={handleImport}>
              Создать работу
            </Button>
          </Space>
          {noTopic > 0 && (
            <div style={{ marginTop: 8 }}>
              <Text type="danger">Выберите тему для задач с Решу: {noTopic}</Text>
            </div>
          )}
          {importing && progress.total > 0 && (
            <Progress
              style={{ marginTop: 12 }}
              percent={Math.round((progress.current / progress.total) * 100)}
              format={() => progress.label}
            />
          )}
        </Card>
      )}
    </Space>
  );
}
