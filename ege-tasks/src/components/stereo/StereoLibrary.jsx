import { useCallback, useEffect, useState } from 'react';
import {
  Alert, App, Button, Drawer, Empty, Input, Space, Switch, Tooltip,
} from 'antd';
import {
  CopyOutlined, DeleteOutlined, EditOutlined, FolderOpenOutlined, SaveOutlined,
} from '@ant-design/icons';
import { api } from '../../shared/services/pocketbase';
import { manualLink } from '../../utils/stereo/room';
import StereoGroupsSelect from './StereoGroupsSelect';

const fmtDate = (s) => {
  const d = new Date(String(s).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Чем отличаются библиотеки стерео- и планиметрических чертежей: запись одна
// (stereo_scenes), различает их поле kind.
const KINDS = {
  stereo: {
    list: () => api.getStereoScenes(),
    create: ({ title, scene, camera }) => api.createStereoScene({ title, scene, camera }),
    patch: (scene, camera) => ({ scene, camera }),
    placeholder: 'Название, например «Сечение куба через M, N, K»',
    help: 'листать шаги и крутить чертёж можно без входа',
  },
  planim: {
    list: () => api.getPlanimScenes(),
    create: ({ title, scene }) => api.createPlanimScene({ title, scene }),
    patch: (scene) => ({ scene }),
    placeholder: 'Название, например «Высота и медиана треугольника»',
    help: 'листать шаги построения можно без входа',
  },
};

/**
 * Библиотека чертежей: сохранить текущий, открыть сохранённый, открыть
 * ученикам пошаговое пособие по ссылке (student.oipav.ru/s/<id>) и отметить,
 * в кабинете каких классов оно появится (младшим — не чертежи старшей школы).
 * kind — 'stereo' | 'planim'.
 */
export default function StereoLibrary({
  open, onClose, scene, camera, currentDoc, dirty, onOpen, onSaved, canEdit, kind = 'stereo',
}) {
  const K = KINDS[kind] || KINDS.stereo;
  const { message, modal } = App.useApp();
  const [list, setList] = useState(undefined);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [rename, setRename] = useState(null); // { id, title }

  const reload = useCallback(async () => {
    try {
      setList(await K.list());
    } catch (e) {
      setList([]);
      message.error(e?.message || 'Не удалось загрузить библиотеку');
    }
  }, [message, K]);

  useEffect(() => { if (open) reload(); }, [open, reload]);

  const saveNew = async () => {
    const t = (title || '').trim();
    if (!t) { message.warning('Назовите чертёж'); return; }
    setBusy(true);
    try {
      const rec = await K.create({ title: t, scene, camera });
      onSaved({ id: rec.id, title: rec.title });
      setTitle('');
      message.success('Чертёж сохранён');
      reload();
    } catch (e) {
      message.error(e?.message || 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const saveCurrent = async () => {
    setBusy(true);
    try {
      await api.updateStereoScene(currentDoc.id, K.patch(scene, camera));
      onSaved(currentDoc);
      message.success('Изменения сохранены');
      reload();
    } catch (e) {
      message.error(e?.message || 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const openDoc = (item) => {
    const go = async () => {
      try {
        const rec = await api.getStereoScene(item.id);
        onOpen(rec);
        onClose();
      } catch (e) {
        message.error(e?.message || 'Не удалось открыть');
      }
    };
    if (!dirty) { go(); return; }
    modal.confirm({
      title: 'Открыть другой чертёж?',
      content: 'Несохранённые изменения текущего чертежа пропадут (Ctrl+Z их вернёт).',
      okText: 'Открыть',
      cancelText: 'Отмена',
      onOk: go,
    });
  };

  const togglePublic = async (item, value) => {
    try {
      await api.updateStereoScene(item.id, { public: value });
      setList((l) => l.map((x) => (x.id === item.id ? { ...x, public: value } : x)));
    } catch (e) {
      message.error(e?.message || 'Не удалось изменить доступ');
    }
  };

  const saveGroups = async (item, groups) => {
    const prev = item.groups;
    setList((l) => l.map((x) => (x.id === item.id ? { ...x, groups } : x)));
    try {
      await api.updateStereoScene(item.id, { groups });
    } catch (e) {
      setList((l) => l.map((x) => (x.id === item.id ? { ...x, groups: prev } : x)));
      message.error(e?.message || 'Не удалось сохранить классы');
    }
  };

  const copyLink = async (item) => {
    const link = manualLink(item.id);
    try {
      await navigator.clipboard.writeText(link.full);
      message.success('Ссылка скопирована');
    } catch {
      message.info(link.full);
    }
  };

  const saveRename = async () => {
    const t = rename.title.trim();
    if (!t) { setRename(null); return; }
    try {
      await api.updateStereoScene(rename.id, { title: t });
      setList((l) => l.map((x) => (x.id === rename.id ? { ...x, title: t } : x)));
      if (currentDoc?.id === rename.id) onSaved({ id: rename.id, title: t }, { keepDirty: true });
    } catch (e) {
      message.error(e?.message || 'Не удалось переименовать');
    }
    setRename(null);
  };

  const remove = (item) => modal.confirm({
    title: `Удалить «${item.title}»?`,
    content: item.public ? 'Ссылка у учеников перестанет работать.' : 'Чертёж будет удалён из библиотеки.',
    okText: 'Удалить',
    okButtonProps: { danger: true },
    cancelText: 'Отмена',
    onOk: async () => {
      await api.deleteStereoScene(item.id);
      if (currentDoc?.id === item.id) onSaved(null);
      reload();
    },
  });

  return (
    <Drawer title="Библиотека чертежей" open={open} onClose={onClose} width={440} destroyOnHidden>
      {list === null ? (
        <Alert type="info" showIcon message="Библиотека появится после обновления базы" />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={14}>
          {canEdit && (
            <div className="stereo-lib__save">
              {currentDoc && (
                <Button
                  type="primary"
                  block
                  icon={<SaveOutlined />}
                  loading={busy}
                  disabled={!dirty}
                  onClick={saveCurrent}
                >
                  {dirty ? `Сохранить «${currentDoc.title}»` : `«${currentDoc.title}» сохранён`}
                </Button>
              )}
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onPressEnter={saveNew}
                  maxLength={200}
                  placeholder={currentDoc ? 'Сохранить как новый: название' : K.placeholder}
                />
                <Button icon={<SaveOutlined />} onClick={saveNew} loading={busy}>Сохранить</Button>
              </Space.Compact>
            </div>
          )}

          {list === undefined ? null : list.length === 0 ? (
            <Empty description="Сохранённых чертежей пока нет" />
          ) : (
            <ul className="stereo-lib__list">
              {list.map((item) => (
                <li key={item.id} className={`stereo-lib__item${currentDoc?.id === item.id ? ' is-current' : ''}`}>
                  <div className="stereo-lib__main">
                    {rename?.id === item.id ? (
                      <Input
                        size="small"
                        autoFocus
                        value={rename.title}
                        maxLength={200}
                        onChange={(e) => setRename({ ...rename, title: e.target.value })}
                        onPressEnter={(e) => e.target.blur()}
                        onBlur={saveRename}
                      />
                    ) : (
                      <button type="button" className="stereo-lib__title" onClick={() => openDoc(item)}>
                        <FolderOpenOutlined /> {item.title}
                      </button>
                    )}
                    <div className="stereo-lib__meta">{fmtDate(item.updated)}</div>
                  </div>
                  {canEdit && (
                    <div className="stereo-lib__actions">
                      <Tooltip title={item.public ? 'Ученики видят пособие по ссылке' : 'Открыть ученикам пошаговое пособие'}>
                        <Switch size="small" checked={!!item.public} onChange={(v) => togglePublic(item, v)} />
                      </Tooltip>
                      {item.public && (
                        <Tooltip title={manualLink(item.id).short}>
                          <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => copyLink(item)} aria-label="Скопировать ссылку" />
                        </Tooltip>
                      )}
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => setRename({ id: item.id, title: item.title })} aria-label="Переименовать" />
                      <Button size="small" type="text" icon={<DeleteOutlined />} onClick={() => remove(item)} aria-label="Удалить" />
                    </div>
                  )}
                  {/* Поля groups нет до миграции 1787500000 — тогда и выбора нет. */}
                  {canEdit && item.public && Array.isArray(item.groups) && (
                    <div className="stereo-lib__groups">
                      <StereoGroupsSelect
                        size="small"
                        value={item.groups}
                        onChange={(v) => saveGroups(item, v)}
                        placeholder="В кабинете каких классов показать"
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="stereo-cmd-help">
            Переключатель открывает чертёж ученикам как пошаговое пособие:
            ссылка <code>student.oipav.ru/s/…</code>, {K.help}. Подписи к
            шагам — из журнала редактора. Отмеченные классы увидят пособие в
            личном кабинете; по ссылке оно открыто всем.
          </div>
        </Space>
      )}
    </Drawer>
  );
}
