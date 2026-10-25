// RefreshFromSdamgiaModal — «Перепарсить задачу с Решу ЕГЭ» (v3.9.401).
//
// Для задачи с task.sdamgia_url:
//   1. При открытии сразу качает страницу через /parse-sdamgia (разбор —
//      pocketbase/sdamgia-lib.mjs).
//   2. Сравнивает свежий разбор с ТЕКУЩЕЙ ФОРМОЙ редактора (учитель мог уже
//      поправить руками): «Как выглядит» — два рендера рядом, «Что поменяется»
//      — построчно с подсветкой слов (utils/textDiff.js).
//   3. Галочки — какие поля взять. LLM (/latex-fix) — только по кнопке у поля:
//      он умеет переписать текст, а не только формулы.
//   4. «Подставить в форму» — выбранное уходит в форму редактора (onApply),
//      в базу ничего не пишется: сохраняет учитель обычной кнопкой, отменить —
//      закрыть редактор без сохранения. Исключение — «Перезагрузить картинки»:
//      task_images пересоздаются сразу.
// Правила (что изменилось, что выбрать, флаг LaTeX) — utils/sdamgiaRefresh.js.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, Button, Space, Checkbox, Alert, Spin, Segmented,
  Typography, Tag, App, Tooltip,
} from 'antd';
import { ReloadOutlined, ExportOutlined } from '@ant-design/icons';
import pb, { api, aiHeaders } from '../services/pocketbase';
import { useAuth } from '../contexts/AuthContext';
import TaskStatementRenderer, { rewriteImageUrls } from './TaskStatementRenderer';
import { diffLines, changedLineCount } from '../utils/textDiff';
import {
  REFRESH_FIELDS, LLM_FIELDS, freshFromProblem, isChanged, canApply,
  defaultSelection, brokenFormulaCount, pickSelected, reviewFlagAfter,
} from '../utils/sdamgiaRefresh';
import './RefreshFromSdamgiaModal.css';

const { Text } = Typography;

const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';

async function fetchFresh(sdamgiaUrl) {
  const res = await fetch(`${PDF_SERVICE_URL}/parse-sdamgia`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: sdamgiaUrl }),
  });
  if (!res.ok) throw new Error(`parse-sdamgia: HTTP ${res.status}`);
  const data = await res.json();
  const problem = data.problems?.[0];
  if (!problem) throw new Error('Задача не найдена на странице «Решу ЕГЭ»');
  return freshFromProblem(problem);
}

async function llmFix(text, field) {
  const res = await fetch(`${PDF_SERVICE_URL}/latex-fix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...aiHeaders() },
    body: JSON.stringify({ text, role: field.replace('_md', '') }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.text || text;
}

/** Удалить task_images задачи и скачать свежие через прокси /fetch-image. */
async function reloadTaskImages(taskId, fresh) {
  const existing = await pb.collection('task_images').getFullList({ filter: `task = "${taskId}"` });
  for (const rec of existing) await pb.collection('task_images').delete(rec.id);
  const groups = [
    ['condition', fresh.condition_images],
    ['solution', fresh.solution_images],
    ['criteria', fresh.criteria_images],
  ];
  let failed = 0;
  for (const [role, imgs] of groups) {
    for (const img of imgs || []) {
      try {
        const r = await fetch(`${PDF_SERVICE_URL}/fetch-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: img.url }),
        });
        if (!r.ok) { failed++; continue; }
        const blob = await r.blob();
        const ct = r.headers.get('content-type') || blob.type || 'image/png';
        const ext = ct.includes('svg') ? 'svg' : ct.includes('jpeg') ? 'jpg'
          : ct.includes('webp') ? 'webp' : ct.includes('gif') ? 'gif' : 'png';
        await api.createTaskImage({
          task: taskId,
          role,
          order: img.order,
          fileBlob: blob,
          fileName: `${img.file_id || `${role}_${img.order || 1}`}.${ext}`,
          sdamgia_file_id: img.file_id,
          original_url: img.url,
        });
      } catch (e) {
        failed++;
        console.warn(`[refresh] img ${img.url}: ${e.message}`);
      }
    }
  }
  return failed;
}

const flatImages = (grouped) => [
  ...(grouped?.condition || []), ...(grouped?.solution || []), ...(grouped?.criteria || []),
];

/** Построчное сравнение: неизменное схлопывается до строки контекста. */
function DiffView({ before, after }) {
  const diff = useMemo(() => diffLines(before, after), [before, after]);
  const rows = [];
  let inGap = false;
  diff.forEach((d, i) => {
    if (d.type === 'same') {
      const near = (k) => diff[k] && diff[k].type !== 'same';
      if (near(i - 1) || near(i + 1)) {
        rows.push(<div key={i} className="rfs-line rfs-line--same">{d.text || ' '}</div>);
        inGap = false;
      } else if (!inGap) {
        rows.push(<div key={i} className="rfs-line rfs-line--gap">⋯</div>);
        inGap = true;
      }
      return;
    }
    inGap = false;
    if (d.type === 'del') rows.push(<div key={i} className="rfs-line rfs-line--del">{d.text || ' '}</div>);
    if (d.type === 'add') rows.push(<div key={i} className="rfs-line rfs-line--add">{d.text || ' '}</div>);
    if (d.type === 'change') {
      rows.push(
        <div key={`${i}-d`} className="rfs-line rfs-line--del">
          {d.words.filter(w => w.type !== 'add').map((w, k) => (w.type === 'del' ? <del key={k}>{w.text}</del> : <span key={k}>{w.text}</span>))}
        </div>,
        <div key={`${i}-a`} className="rfs-line rfs-line--add">
          {d.words.filter(w => w.type !== 'del').map((w, k) => (w.type === 'add' ? <ins key={k}>{w.text}</ins> : <span key={k}>{w.text}</span>))}
        </div>,
      );
    }
  });
  return <div className="rfs-diff">{rows}</div>;
}

export default function RefreshFromSdamgiaModal({ task, current, images, open, onClose, onApply }) {
  const { message } = App.useApp();
  const { aiEnabled } = useAuth();
  const [phase, setPhase] = useState('loading'); // loading | preview | error | applying
  const [error, setError] = useState('');
  const [fresh, setFresh] = useState(null);
  const [selected, setSelected] = useState({});
  const [view, setView] = useState('rendered');
  const [reloadImages, setReloadImages] = useState(false);
  const [llmBusy, setLlmBusy] = useState(null);
  const loadToken = useRef(0);

  const load = async () => {
    const token = ++loadToken.current;
    setPhase('loading');
    setError('');
    try {
      const data = await fetchFresh(task.sdamgia_url);
      if (token !== loadToken.current) return;
      setFresh(data);
      setSelected(defaultSelection(current, data));
      setPhase('preview');
    } catch (e) {
      if (token !== loadToken.current) return;
      setError(e.message);
      setPhase('error');
    }
  };

  useEffect(() => {
    if (open && task?.sdamgia_url) {
      setReloadImages(false);
      load();
    }
    if (!open) loadToken.current++;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const handleLlm = async (key) => {
    setLlmBusy(key);
    try {
      const fixed = await llmFix(fresh[key], key);
      if (fixed === fresh[key]) {
        message.info('LLM не нашёл, что исправить');
      } else {
        setFresh(f => ({ ...f, [key]: fixed }));
        setSelected(s => ({ ...s, [key]: canApply(current?.[key], fixed) }));
      }
    } catch (e) {
      message.error(`LLM: ${e.message}`);
    } finally {
      setLlmBusy(null);
    }
  };

  const freshImageCount = fresh
    ? (fresh.condition_images.length + fresh.solution_images.length + fresh.criteria_images.length)
    : 0;
  const chosen = REFRESH_FIELDS.filter(f => selected[f.key]);

  const handleApply = async () => {
    const fields = pickSelected(fresh, selected);
    let imgs = images;
    if (reloadImages) {
      setPhase('applying');
      try {
        const failed = await reloadTaskImages(task.id, fresh);
        imgs = await api.getTaskImages(task.id);
        if (failed) message.warning(`Не скачалось картинок: ${failed}`);
      } catch (e) {
        message.error(`Картинки: ${e.message}`);
        setPhase('preview');
        return;
      }
    }
    // Как при импорте (born-local): ссылки «Решу» на чертежи — на наши файлы.
    const all = flatImages(imgs);
    for (const k of ['statement_md', 'solution_md', 'criteria_md']) {
      if (k in fields) fields[k] = rewriteImageUrls(fields[k], all);
    }
    onApply?.(fields, {
      needsReview: reviewFlagAfter(current, fields),
      imagesReloaded: reloadImages,
    });
    onClose?.();
  };

  const renderField = (f) => {
    const before = current?.[f.key] ?? '';
    const after = fresh?.[f.key] ?? '';
    const changed = isChanged(before, after);
    const empty = after === '' || after == null;
    const applicable = canApply(before, after);
    const broken = !f.numeric ? brokenFormulaCount(after) : 0;
    const lines = changed && !f.numeric ? changedLineCount(diffLines(String(before), String(after))) : 0;
    const roleImgs = f.key === 'solution_md' ? images?.solution : f.key === 'criteria_md' ? images?.criteria : images?.condition;

    return (
      <div key={f.key} className={`rfs-field${applicable ? '' : ' rfs-field--quiet'}`}>
        <div className="rfs-field-head">
          <Checkbox
            checked={!!selected[f.key]}
            disabled={!applicable}
            onChange={(e) => setSelected(s => ({ ...s, [f.key]: e.target.checked }))}
          >
            <strong>{f.label}</strong>
          </Checkbox>
          {empty && <Tag>на «Решу» пусто</Tag>}
          {!empty && !changed && <Tag>совпадает</Tag>}
          {changed && !empty && <Tag color="processing">{lines ? `изменено строк: ${lines}` : 'изменено'}</Tag>}
          {broken > 0 && (
            <Tooltip title="KaTeX не рисует эти формулы — обычно это ошибки самой записи на «Решу»">
              <Tag color="warning">⚠ не рисуется формул: {broken}</Tag>
            </Tooltip>
          )}
          {aiEnabled && LLM_FIELDS.has(f.key) && !empty && (
            <Button
              size="small"
              type={broken > 0 ? 'primary' : 'default'}
              ghost={broken > 0}
              loading={llmBusy === f.key}
              disabled={!!llmBusy && llmBusy !== f.key}
              onClick={() => handleLlm(f.key)}
            >
              🤖 Починить LaTeX
            </Button>
          )}
        </div>
        {changed && !empty && (
          f.numeric || f.singleLine ? (
            <div className="rfs-inline-change">
              <span className="rfs-old">{f.numeric ? (before ?? '—') : <TaskStatementRenderer text={String(before) || '—'} />}</span>
              <span className="rfs-arrow">→</span>
              <span className="rfs-new">{f.numeric ? after : <TaskStatementRenderer text={String(after)} />}</span>
            </div>
          ) : view === 'diff' ? (
            <DiffView before={String(before)} after={String(after)} />
          ) : (
            <div className="rfs-sides">
              <div className="rfs-side rfs-side--old">
                <Text type="secondary" className="rfs-side-label">Сейчас в форме</Text>
                <div className="task-statement"><TaskStatementRenderer text={String(before) || '(пусто)'} images={roleImgs || []} /></div>
              </div>
              <div className="rfs-side rfs-side--new">
                <Text type="secondary" className="rfs-side-label">С «Решу ЕГЭ»</Text>
                <div className="task-statement"><TaskStatementRenderer text={String(after)} images={roleImgs || []} /></div>
              </div>
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <Modal
      title={(
        <Space wrap>
          <ReloadOutlined />
          <span>Перепарсить с «Решу ЕГЭ»</span>
          {task?.sdamgia_id && <Tag color="green">id {task.sdamgia_id}</Tag>}
          {task?.sdamgia_url && (
            <Button type="link" size="small" icon={<ExportOutlined />} href={task.sdamgia_url} target="_blank" rel="noopener noreferrer">
              открыть на сайте
            </Button>
          )}
        </Space>
      )}
      open={open}
      onCancel={onClose}
      width={1180}
      style={{ maxWidth: '96vw', top: 24 }}
      maskClosable={phase !== 'applying'}
      footer={phase === 'preview' ? (
        <div className="rfs-footer">
          <Checkbox checked={reloadImages} onChange={(e) => setReloadImages(e.target.checked)} disabled={!freshImageCount}>
            Перезагрузить картинки ({freshImageCount}) — сразу в базе
          </Checkbox>
          <Space>
            <Button onClick={onClose}>Отмена</Button>
            <Button type="primary" onClick={handleApply} disabled={!chosen.length && !reloadImages}>
              {chosen.length ? `Подставить в форму: ${chosen.map(f => f.label.toLowerCase()).join(', ')}` : 'Только картинки'}
            </Button>
          </Space>
        </div>
      ) : null}
    >
      {phase === 'loading' && (
        <div className="rfs-center"><Spin size="large" /><div>Качаем и разбираем страницу задачи…</div></div>
      )}
      {phase === 'applying' && (
        <div className="rfs-center"><Spin size="large" /><div>Перезагружаем картинки…</div></div>
      )}
      {phase === 'error' && (
        <Alert
          type="error"
          showIcon
          message="Не удалось получить задачу"
          description={error}
          action={<Button onClick={load}>Ещё раз</Button>}
        />
      )}
      {phase === 'preview' && fresh && (
        <>
          <div className="rfs-toolbar">
            <Text type="secondary">
              Сравнение с тем, что сейчас в форме. Выбранное подставится в форму — сохраните задачу
              как обычно (или закройте редактор без сохранения, чтобы всё отменить).
            </Text>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: 'rendered', label: 'Как выглядит' },
                { value: 'diff', label: 'Что поменяется' },
              ]}
            />
          </div>
          {REFRESH_FIELDS.map(renderField)}
        </>
      )}
    </Modal>
  );
}
