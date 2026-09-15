import { Alert, Divider, InputNumber, Segmented, Space, Switch, Typography } from 'antd';
import { ratingMaxScore, scoreForAttempt } from '../../utils/marathonRating';
import SettingRow from './SettingRow';

const { Text } = Typography;

const ORIENTATION_OPTIONS = [
  { value: 'landscape', label: 'Альбомный' },
  { value: 'portrait', label: 'Книжный' },
];
const ATTEMPT_OPTIONS = [2, 3, 4, 5].map(n => ({ value: n, label: String(n) }));

/** Настройки бумажного бланка рейтинга. */
export default function MarathonRatingSettings({
  settings, patch, plan, taskCount = 0, studentCount = 0,
}) {
  const s = settings;
  const scale = Array.from({ length: s.attempts }, (_, i) => scoreForAttempt(i + 1, s.attempts)).join(' · ');

  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Space wrap size={16}>
        <SettingRow label="Лист:" hint="Книжный годится марафону на 8–10 задач; на большем числе колонки становятся уже квадратиков попыток и лист уезжает на второй.">
          <Segmented size="small" value={s.orientation} onChange={v => patch({ orientation: v })} options={ORIENTATION_OPTIONS} />
        </SettingRow>
        <SettingRow label="Попыток на задачу:" hint="Квадратики в клетке. Балл читается по закрашенному: с первой попытки — максимум, дальше по убыванию.">
          <Segmented size="small" value={s.attempts} onChange={v => patch({ attempts: v })} options={ATTEMPT_OPTIONS} />
        </SettingRow>
        <Text type="secondary" style={{ fontSize: 12 }}>
          баллы {scale} · максимум {ratingMaxScore(taskCount, s.attempts)}
        </Text>
      </Space>

      <Divider style={{ margin: '2px 0' }} />

      <Space wrap size={16}>
        <SettingRow label="Клетка «баллы»:" hint="Отдельная клетка рядом с попытками — если балл проставляется цифрой, а не читается по закрашенному квадрату.">
          <Switch size="small" checked={s.showScore} onChange={v => patch({ showScore: v })} />
        </SettingRow>
        <SettingRow label="Колонка №:">
          <Switch size="small" checked={s.showIndex} onChange={v => patch({ showIndex: v })} />
        </SettingRow>
        <SettingRow label="Легенда:">
          <Switch size="small" checked={s.showLegend} onChange={v => patch({ showLegend: v })} />
        </SettingRow>
        <SettingRow label="Полосы строк:" hint="Подсветка каждой второй строки: глаз не теряет ученика на длинной строке.">
          <Switch size="small" checked={s.zebra} onChange={v => patch({ zebra: v })} />
        </SettingRow>
      </Space>

      <Space wrap size={16}>
        <SettingRow label="Ширина колонки имени, мм:">
          <InputNumber size="small" min={30} max={70} value={s.nameMm} onChange={v => patch({ nameMm: v || 30 })} />
        </SettingRow>
        <SettingRow label="Пустых строк:" hint="Строки без фамилии — вписать тех, кто пришёл не по списку.">
          <InputNumber size="small" min={0} max={20} value={s.extraRows} onChange={v => patch({ extraRows: v ?? 0 })} />
        </SettingRow>
      </Space>

      {plan && plan.pages.length > 1 && (
        <Alert
          type="info"
          showIcon
          style={{ padding: '4px 10px' }}
          message={
            <span style={{ fontSize: 12 }}>
              {studentCount} учеников × {taskCount} задач не помещаются на один лист —
              {' '}бланк разбит на {plan.pages.length} листа: по {plan.rowsPerSheet} строк и
              {' '}{plan.tasksPerSheet} задач на лист, шапка повторяется.
            </span>
          }
        />
      )}
    </Space>
  );
}
