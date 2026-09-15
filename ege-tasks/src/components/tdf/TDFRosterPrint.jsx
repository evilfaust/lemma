import { useEffect, useMemo, useState } from 'react';
import { Button, InputNumber, Segmented, Select, Space, Switch, Tooltip, Typography } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { api } from '../../services/pocketbase';
import { printPaged } from '../../utils/printPage';
import {
  HEAD_ROW_MM, INDEX_COL_MM, MARK_COL_MM, ROSTER_PAD, ROSTER_PAGE, TITLE_MM, TOTAL_COL_MM,
  legendLabel, normalizeRosterSettings, planRoster, readRosterSettings, writeRosterSettings,
} from '../../utils/tdfRoster';
import './TDFRosterPrint.css';

const { Text } = Typography;

/** Строка панели настроек — тот же вид, что на печатных экранах марафона. */
function Row({ label, hint, children }) {
  const text = <Text style={{ fontSize: 13 }}>{label}</Text>;
  return (
    <Space size={6}>
      {hint ? <Tooltip title={hint}>{text}</Tooltip> : text}
      {children}
    </Space>
  );
}

/**
 * Ведомость устного опроса: бумажный бланк «ученик × пункт», который учитель
 * заполняет на уроке. Спросил — поставил отметку в клетке; в конце виден и
 * итог по ученику, и пункт, на котором сыплется весь класс.
 *
 * Оформление — язык `print-sheet`: только чёрная краска, миллиметры,
 * волосяные линейки, группирующая линия каждые пять пунктов.
 */
export default function TDFRosterPrint({ tdfSet, items, onBack }) {
  const [settings, setSettings] = useState(() => readRosterSettings());
  const [groups, setGroups] = useState([]);
  const [groupId, setGroupId] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const patch = (p) => setSettings(prev => {
    const next = normalizeRosterSettings({ ...prev, ...p });
    writeRosterSettings(next);
    return next;
  });

  useEffect(() => {
    api.getTeachingGroups().then(setGroups).catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    if (!groupId) { setStudents([]); return; }
    setLoadingStudents(true);
    api.getStudentsByGroup(groupId)
      .then(list => setStudents(list || []))
      .catch(() => setStudents([]))
      .finally(() => setLoadingStudents(false));
  }, [groupId]);

  const realItems = useMemo(() => items.filter(i => !i.is_section_header), [items]);
  const names = useMemo(
    () => students.map(s => s.name || s.full_name || s.username || '—'),
    [students]
  );

  const pages = useMemo(
    () => planRoster(names.length, realItems.length, settings),
    [names.length, realItems.length, settings]
  );

  const page = ROSTER_PAGE[settings.orientation];
  const handlePrint = () => printPaged({ size: `A4 ${settings.orientation}`, margin: '0' });

  const groupLabel = groups.find(g => g.id === groupId)?.name;

  const renderSheet = (plan, idx) => {
    const cols = Array.from({ length: plan.colTo - plan.colFrom }, (_, i) => plan.colFrom + i);
    const rows = Array.from({ length: plan.rowTo - plan.rowFrom }, (_, i) => plan.rowFrom + i);

    return (
      <div
        key={idx}
        className="tdfr-sheet"
        style={{
          width: `${page.w}mm`,
          height: `${page.h}mm`,
          padding: `${ROSTER_PAD.top}mm ${ROSTER_PAD.x}mm ${ROSTER_PAD.bottom}mm`,
        }}
      >
        <div className="tdfr-title" style={{ height: `${TITLE_MM}mm` }}>
          <div className="tdfr-title__main">
            <span className="tdfr-title__text">{tdfSet?.title || 'ТДФ'}</span>
            <span className="tdfr-title__kind">ведомость устного опроса</span>
          </div>
          <div className="tdfr-title__meta">
            {groupLabel && <span>{groupLabel}</span>}
            {tdfSet?.class_number && <span>{tdfSet.class_number} класс</span>}
            {pages.length > 1 && <span>лист {idx + 1} из {pages.length}</span>}
            <span className="tdfr-date">дата <i /></span>
          </div>
        </div>

        <div className="tdfr-table">
          <div className="tdfr-row tdfr-row--head" style={{ height: `${HEAD_ROW_MM}mm` }}>
            {settings.showIndex && (
              <div className="tdfr-cell tdfr-cell--idx" style={{ flex: `0 0 ${INDEX_COL_MM}mm` }}>№</div>
            )}
            <div className="tdfr-cell tdfr-cell--name" style={{ flex: `0 0 ${settings.nameColMm}mm` }}>
              Ученик
            </div>
            {cols.map(c => (
              <div
                key={c}
                className={`tdfr-cell tdfr-cell--task${(c - plan.colFrom) % 5 === 0 && c > plan.colFrom ? ' is-group' : ''}`}
                style={{ flex: `0 0 ${plan.colMm}mm` }}
              >
                {c + 1}
              </div>
            ))}
            {plan.showTotal && (
              <div className="tdfr-cell tdfr-cell--total" style={{ flex: `0 0 ${TOTAL_COL_MM}mm` }}>Итого</div>
            )}
            {plan.showMark && (
              <div className="tdfr-cell tdfr-cell--total" style={{ flex: `0 0 ${MARK_COL_MM}mm` }}>Оценка</div>
            )}
          </div>

          {rows.map(r => (
            <div
              key={r}
              className={`tdfr-row${settings.zebra && r % 2 === 1 ? ' is-zebra' : ''}`}
              style={{ height: `${plan.rowMm}mm` }}
            >
              {settings.showIndex && (
                <div className="tdfr-cell tdfr-cell--idx" style={{ flex: `0 0 ${INDEX_COL_MM}mm` }}>
                  {r + 1}
                </div>
              )}
              <div className="tdfr-cell tdfr-cell--name" style={{ flex: `0 0 ${settings.nameColMm}mm` }}>
                {names[r] || ''}
              </div>
              {cols.map(c => (
                <div
                  key={c}
                  className={`tdfr-cell tdfr-cell--task${(c - plan.colFrom) % 5 === 0 && c > plan.colFrom ? ' is-group' : ''}`}
                  style={{ flex: `0 0 ${plan.colMm}mm` }}
                />
              ))}
              {plan.showTotal && (
                <div className="tdfr-cell tdfr-cell--total" style={{ flex: `0 0 ${TOTAL_COL_MM}mm` }} />
              )}
              {plan.showMark && (
                <div className="tdfr-cell tdfr-cell--total" style={{ flex: `0 0 ${MARK_COL_MM}mm` }} />
              )}
            </div>
          ))}
        </div>

        {settings.showLegend && cols.length > 0 && (
          <ol className="tdfr-legend">
            {cols.map(c => (
              <li key={c} className="tdfr-legend__item">
                <span className="tdfr-legend__num">{c + 1}</span>
                <span className="tdfr-legend__text">{legendLabel(realItems[c])}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  };

  return (
    <div className={`tdfr-root tdfr-root--${settings.orientation}`}>
      <div className="tdfr-toolbar no-print">
        <div className="tdfr-toolbar__row">
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>Назад</Button>
          <span className="tdfr-toolbar__title">Ведомость устного опроса</span>
          <span className="tdfr-toolbar__hint">
            {realItems.length} пунктов · {names.length + settings.extraRows} строк · {pages.length} лист(ов)
          </span>
          <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>Печать</Button>
        </div>

        <div className="tdfr-toolbar__row">
          <Row label="Класс:" hint="Фамилии подставятся в бланк. Без выбора — пустые строки.">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Выбрать группу"
              style={{ width: 220 }}
              loading={loadingStudents}
              value={groupId}
              onChange={setGroupId}
              options={groups.map(g => ({ value: g.id, label: g.name }))}
            />
          </Row>
          <Row label="Лист:">
            <Segmented
              size="small"
              value={settings.orientation}
              onChange={v => patch({ orientation: v })}
              options={[{ value: 'landscape', label: 'Альбомный' }, { value: 'portrait', label: 'Книжный' }]}
            />
          </Row>
          <Row label="Колонка имени, мм:" hint="Узкая колонка даёт больше места пунктам.">
            <InputNumber size="small" min={28} max={80} value={settings.nameColMm} onChange={v => patch({ nameColMm: v })} style={{ width: 70 }} />
          </Row>
          <Row label="Пустых строк:" hint="Вписать тех, кого нет в списке группы.">
            <InputNumber size="small" min={0} max={12} value={settings.extraRows} onChange={v => patch({ extraRows: v })} style={{ width: 62 }} />
          </Row>
        </div>

        <div className="tdfr-toolbar__row">
          <Row label="№ строки:"><Switch size="small" checked={settings.showIndex} onChange={v => patch({ showIndex: v })} /></Row>
          <Row label="Итого:"><Switch size="small" checked={settings.showTotal} onChange={v => patch({ showTotal: v })} /></Row>
          <Row label="Оценка:"><Switch size="small" checked={settings.showMark} onChange={v => patch({ showMark: v })} /></Row>
          <Row label="Расшифровка номеров:" hint="Под таблицей: какой номер какому пункту соответствует.">
            <Switch size="small" checked={settings.showLegend} onChange={v => patch({ showLegend: v })} />
          </Row>
          <Row label="Полосы строк:" hint="Подсветка каждой второй строки — глаз не соскальзывает на соседа.">
            <Switch size="small" checked={settings.zebra} onChange={v => patch({ zebra: v })} />
          </Row>
        </div>
      </div>

      <div className="tdfr-pages">
        {pages.map(renderSheet)}
      </div>
    </div>
  );
}
