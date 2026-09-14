import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, App, InputNumber, Input, Modal, Select, Space, Spin, Tag, Typography } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import { collectMarathonTasks, MARATHON_TASKS_LIMIT } from '../../utils/marathonFromWork';
import { R } from '../../App';

const { Text } = Typography;
const ALL_VARIANTS = '__all__';

// «Отправить работу в марафон»: из задач работы создаётся марафон, учитель
// попадает в него сразу (ученики и трекинг — уже там).
// `variants` можно передать готовыми (редактор работы держит свежий состав),
// иначе модалка сама читает их из базы.
export default function SendToMarathonModal({ open, work, variants = null, onClose }) {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loaded, setLoaded] = useState([]);
  const [source, setSource] = useState(ALL_VARIANTS);
  const [title, setTitle] = useState('');
  const [classNumber, setClassNumber] = useState(8);

  const given = Array.isArray(variants) && variants.length > 0 ? variants : null;
  const data = given || loaded;

  useEffect(() => {
    if (!open || !work) return;
    setSource(ALL_VARIANTS);
    setTitle(work.title || 'Марафон');
    setClassNumber(work.class || 8);
    if (given) return;

    let alive = true;
    setLoading(true);
    api.getVariantsByWork(work.id)
      .then((vars) => { if (alive) setLoaded(vars || []); })
      .catch((e) => { console.error(e); message.error('Не удалось загрузить состав работы'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // given сознательно не в зависимостях: пересобирать список при каждой
    // правке состава в редакторе не нужно — он и так приходит пропом.
  }, [open, work?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const tasks = useMemo(
    () => collectMarathonTasks(data, source === ALL_VARIANTS ? null : Number(source)),
    [data, source],
  );

  const variantOptions = useMemo(() => ([
    { value: ALL_VARIANTS, label: `Все варианты — без повторов (${collectMarathonTasks(data).length} задач)` },
    ...data.map((v) => ({
      value: String(v.number),
      label: `Вариант ${v.number} (${collectMarathonTasks(data, v.number).length} задач)`,
    })),
  ]), [data]);

  const tooMany = tasks.length > MARATHON_TASKS_LIMIT;

  const handleOk = async () => {
    if (!tasks.length || tooMany) return;
    setCreating(true);
    try {
      const marathon = await api.createMarathonFromWork(work, tasks.map((t) => t.id), {
        title: title.trim() || work.title || 'Марафон',
        classNumber,
      });
      message.success('Марафон создан — добавьте учеников и запускайте');
      onClose?.();
      navigate(`${R.MARATHON}?marathon=${marathon.id}`);
    } catch (e) {
      console.error(e);
      message.error('Не удалось создать марафон');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      title={<span><TrophyOutlined /> Отправить работу в марафон</span>}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Создать марафон"
      cancelText="Отмена"
      confirmLoading={creating}
      okButtonProps={{ disabled: loading || !tasks.length || tooMany }}
      width={560}
    >
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center' }}><Spin /></div>
      ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">Название марафона</Text>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Марафон"
            />
          </div>

          <Space size={16} wrap>
            <span>
              <Text type="secondary">Класс: </Text>
              <InputNumber min={1} max={11} value={classNumber} onChange={(v) => setClassNumber(v || 8)} />
            </span>
            <Tag color={tasks.length ? 'blue' : 'default'}>Задач в марафоне: {tasks.length}</Tag>
          </Space>

          <div>
            <Text type="secondary">Откуда брать задачи</Text>
            <Select
              style={{ width: '100%' }}
              value={source}
              onChange={setSource}
              options={variantOptions}
            />
          </div>

          {!tasks.length && (
            <Alert type="warning" showIcon message="В работе нет задач — марафон не из чего собрать" />
          )}
          {tooMany && (
            <Alert
              type="error"
              showIcon
              message={`Слишком много задач: ${tasks.length}`}
              description={`В марафон помещается не больше ${MARATHON_TASKS_LIMIT} задач — выберите один вариант.`}
            />
          )}
          {tasks.length > 0 && !tooMany && (
            <Alert
              type="info"
              showIcon
              message="Задачи станут карточками марафона"
              description="Ученики, очередь и трекер — уже в самом марафоне; работа и её выдачи остаются как есть."
            />
          )}
        </Space>
      )}
    </Modal>
  );
}
