import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Empty, Input, Modal, Select, Spin } from 'antd';
import {
  ClockCircleOutlined, PushpinOutlined, FolderOutlined, FileTextOutlined,
  ExperimentOutlined, AimOutlined, SunOutlined, SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import useIsMobile from '../../../hooks/useIsMobile';
import {
  pickerSections, filterPickerItems, sectionOfValue, NO_FOLDER,
} from '../../../utils/lessonWorkPicker';
import './lessonWorkPicker.css';

const SECTION_KEY = 'lessonPicker.section';

const readSection = () => {
  try { return localStorage.getItem(SECTION_KEY) || 'recent'; } catch { return 'recent'; }
};
const saveSection = (s) => {
  try { localStorage.setItem(SECTION_KEY, s); } catch { /* noop */ }
};

const sectionIcon = (s) => {
  if (s.key === 'recent') return <ClockCircleOutlined />;
  if (s.key === 'pinned') return <PushpinOutlined />;
  if (s.folder) return <FolderOutlined />;
  if (s.key === NO_FOLDER) return <FileTextOutlined />;
  if (s.key === 'tests') return <ExperimentOutlined />;
  if (s.key === 'geo') return <AimOutlined />;
  return <SunOutlined />;
};

const KIND_LABEL = { test: 'тест', geo: 'геометрия' };

/**
 * Окно выбора работы для урока: поиск, разделы (недавние, закреплённые,
 * папки, тесты, геометрия, каникулярные программы), фильтр по классу урока.
 * Логика — `utils/lessonWorkPicker.js`; здесь только раскладка.
 *
 * @param items  — пункты `buildPickerItems`
 * @param grade  — класс урока (номер), пусто — без фильтра
 * @param value  — выбранный пункт: окно откроется в его разделе
 * @param onPick — (value) => void; окно закрывается само
 */
export default function LessonWorkPickerModal({
  open, onClose, onPick, items, grade = '', value, loading = false, title = 'Выбор работы для урока',
}) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('recent');
  const [onlyGrade, setOnlyGrade] = useState(true);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setOnlyGrade(true);
    setSection(sectionOfValue(items, value) || readSection());
    // фокус — после анимации открытия
    const t = setTimeout(() => searchRef.current?.focus(), 80);
    return () => clearTimeout(t);
    // items намеренно не в зависимостях: раздел выбирается один раз при открытии
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const activeGrade = grade && onlyGrade ? String(grade) : '';
  const sections = useMemo(() => pickerSections(items, { grade: activeGrade }), [items, activeGrade]);
  // Раздел мог исчезнуть (сняли фильтр класса, пусто) — показываем недавние
  const current = sections.some((s) => s.key === section) ? section : 'recent';
  const { items: list, hiddenByGrade } = useMemo(
    () => filterPickerItems(items, { section: current, query, grade: activeGrade }),
    [items, current, query, activeGrade],
  );
  const searching = !!query.trim();

  const chooseSection = (s) => { setSection(s); saveSection(s); setQuery(''); };
  const pick = (v) => { onPick(v); onClose(); };

  const sectionList = isMobile ? (
    <Select
      className="lwp-section-select"
      value={current}
      onChange={chooseSection}
      options={sections.map((s) => ({ value: s.key, label: `${s.label} · ${s.count}` }))}
    />
  ) : (
    <nav className="lwp-sections" aria-label="Разделы">
      {sections.map((s) => (
        <button
          key={s.key}
          type="button"
          className={`lwp-section${!searching && s.key === current ? ' is-active' : ''}`}
          onClick={() => chooseSection(s.key)}
        >
          <span className="lwp-section-icon">{sectionIcon(s)}</span>
          <span className="lwp-section-label">{s.label}</span>
          <span className="lwp-section-count">{s.count}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={title}
      footer={null}
      width={isMobile ? '100%' : 860}
      style={isMobile ? { top: 0, maxWidth: '100vw', padding: 0 } : undefined}
      destroyOnHidden
      className="lwp-modal"
    >
      <div className="lwp-top">
        <Input
          ref={searchRef}
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Найти работу: слова в любом порядке, папка, тема…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onPressEnter={() => { if (list[0]) pick(list[0].value); }}
        />
        {grade ? (
          <Checkbox checked={onlyGrade} onChange={(e) => setOnlyGrade(e.target.checked)}>
            только {grade} класс
          </Checkbox>
        ) : null}
      </div>

      <div className="lwp-body">
        {sectionList}
        <div className="lwp-list" role="listbox" aria-label="Работы">
          {searching && (
            <div className="lwp-list-caption">Найдено: {list.length} — по всем разделам</div>
          )}
          {loading && !list.length ? (
            <div className="lwp-empty"><Spin /></div>
          ) : list.length ? list.map((it) => (
            <button
              key={it.value}
              type="button"
              role="option"
              aria-selected={it.value === value}
              className={`lwp-item${it.value === value ? ' is-selected' : ''}`}
              onClick={() => pick(it.value)}
            >
              <span className="lwp-item-title">{it.title}</span>
              <span className="lwp-item-meta">
                {it.date ? <span>{dayjs(it.date).format('DD.MM.YYYY')}</span> : null}
                {KIND_LABEL[it.kind] && <span className="lwp-chip">{KIND_LABEL[it.kind]}</span>}
                {it.pinned && <span className="lwp-chip"><PushpinOutlined /> закреплена</span>}
                {it.folder && (searching || current !== `folder:${it.folder}`) && (
                  <span className="lwp-chip"><FolderOutlined /> {it.folder}</span>
                )}
                {it.program && searching && <span className="lwp-chip">каникулы</span>}
                {it.grade && !activeGrade && <span className="lwp-chip">{it.grade} кл</span>}
                {it.issued > 0 && (
                  <span className="lwp-chip lwp-chip--issued">
                    выдана{it.issued > 1 ? ` ×${it.issued}` : ''}
                  </span>
                )}
              </span>
            </button>
          )) : (
            <div className="lwp-empty">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={searching ? 'Ничего не найдено' : 'Здесь пусто'} />
            </div>
          )}
          {hiddenByGrade > 0 && (
            <div className="lwp-more">
              <Button type="link" size="small" onClick={() => setOnlyGrade(false)}>
                Ещё {hiddenByGrade} — для других классов, показать
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
