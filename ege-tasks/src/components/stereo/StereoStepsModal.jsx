import { useEffect, useMemo, useState } from 'react';
import { Button, Modal } from 'antd';
import { LeftOutlined, RightOutlined, UndoOutlined } from '@ant-design/icons';
import StereoCanvas from './StereoCanvas';
import { evaluateScene } from '../../utils/stereo/scene';
import { describeOp } from '../../utils/stereo/commands';
import { DEFAULT_CAMERA } from '../../utils/stereo/camera';

/**
 * Построение по шагам для любой стереосцены (тело + журнал): тот же холст,
 * что у редактора и пособия ученика. ◀ ▶ и стрелки листают шаги, чертёж
 * крутится.
 *
 * @param {{body, ops}} scene
 * @param {object} [camera] — ракурс по умолчанию
 * @param {number} [firstStep=0] — с какого шага начинать (данные точки задания
 *   уже стоят — шаги решения идут после них)
 * @param {ReactNode} [header] / [footer] — условие, ответ, свои кнопки
 */
export default function StereoStepsModal({
  open, onClose, scene, camera: camera0 = DEFAULT_CAMERA, firstStep = 0,
  title = 'Построение по шагам', header = null, footer = null,
}) {
  const total = scene?.ops?.length || 0;
  const first = Math.min(firstStep, total);
  const [step, setStep] = useState(first);
  const [camera, setCamera] = useState(camera0);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    if (open) { setStep(first); setCamera(camera0 || DEFAULT_CAMERA); }
  }, [open, scene, first, camera0]);

  const model = useMemo(() => {
    if (!scene) return null;
    try { return evaluateScene(scene, { upTo: step }); } catch { return null; }
  }, [scene, step]);

  const go = (k) => {
    const n = Math.max(first, Math.min(total, k));
    setStep(n);
    setFlash(n > 0 ? n - 1 : null);
  };

  useEffect(() => {
    if (flash == null) return undefined;
    const t = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(t);
  }, [flash]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(step + 1);
      if (e.key === 'ArrowLeft') go(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!scene) return null;
  const opsById = Object.fromEntries(scene.ops.map((o, i) => [o.id || `s${i}`, o]));
  const current = step > first ? scene.ops[step - 1] : null;

  return (
    <Modal title={title} open={open} onCancel={onClose} footer={null} width={760} zIndex={1200} destroyOnHidden>
      {header}
      <div style={{ height: 380, border: '1px solid #f0f0f0', borderRadius: 8, position: 'relative' }}>
        {model && (
          <StereoCanvas
            model={model}
            camera={camera}
            onCameraChange={setCamera}
            flashStep={flash}
            style={{ width: '100%', height: '100%' }}
          />
        )}
        <Button
          size="small"
          type="text"
          icon={<UndoOutlined />}
          style={{ position: 'absolute', right: 6, bottom: 6 }}
          onClick={() => setCamera(camera0 || DEFAULT_CAMERA)}
        >
          ракурс
        </Button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
        <Button icon={<LeftOutlined />} disabled={step <= first} onClick={() => go(step - 1)} aria-label="Предыдущий шаг" />
        <div style={{ flex: 1, minHeight: 22 }}>
          {current
            ? <>Шаг {step - first} из {total - first}: {describeOp(current, opsById)}{current.note ? ` — ${current.note}` : ''}</>
            : <span style={{ color: '#8c8c8c' }}>{first > 0 ? 'Данные точки.' : 'Само тело.'} Листайте ▶ — построение по шагам</span>}
        </div>
        <Button icon={<RightOutlined />} disabled={step >= total} onClick={() => go(step + 1)} aria-label="Следующий шаг" />
      </div>
      {footer && <div style={{ marginTop: 8 }}>{footer}</div>}
    </Modal>
  );
}
