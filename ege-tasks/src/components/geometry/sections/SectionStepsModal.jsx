import { useEffect, useMemo, useState } from 'react';
import { Button, Modal, Space, Typography } from 'antd';
import { LeftOutlined, RightOutlined, UndoOutlined } from '@ant-design/icons';
import StereoCanvas from '../../stereo/StereoCanvas';
import MathRenderer from '../../MathRenderer';
import { evaluateScene } from '../../../utils/stereo/scene';
import { describeOp } from '../../../utils/stereo/commands';
import { DEFAULT_CAMERA } from '../../../utils/stereo/camera';

const { Text } = Typography;

/**
 * Решение сгенерированного задания по шагам: тот же холст, что у
 * стереоредактора и пособия ученика. ◀ ▶ (и стрелки) листают построение,
 * чертёж можно крутить.
 */
export default function SectionStepsModal({ task, open, onClose }) {
  const first = task?.scene.ops.length || 0;
  const total = task?.solutionScene.ops.length || 0;
  const [step, setStep] = useState(first);
  const [camera, setCamera] = useState(DEFAULT_CAMERA);
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    if (open) { setStep(first); setCamera(DEFAULT_CAMERA); }
  }, [open, task, first]);

  const model = useMemo(() => {
    if (!task) return null;
    try { return evaluateScene(task.solutionScene, { upTo: step }); } catch { return null; }
  }, [task, step]);

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

  if (!task) return null;
  const opsById = Object.fromEntries(task.solutionScene.ops.map((o) => [o.id, o]));
  const current = step > first ? task.solutionScene.ops[step - 1] : null;

  return (
    <Modal
      title="Решение по шагам"
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      destroyOnHidden
    >
      <div style={{ fontSize: 14, marginBottom: 8 }}><MathRenderer text={task.statement} /></div>
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
          onClick={() => setCamera(DEFAULT_CAMERA)}
        >
          ракурс
        </Button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
        <Button icon={<LeftOutlined />} disabled={step <= first} onClick={() => go(step - 1)} />
        <div style={{ flex: 1, minHeight: 22 }}>
          {current
            ? <Text>Шаг {step - first} из {total - first}: {describeOp(current, opsById)}</Text>
            : <Text type="secondary">Данные точки. Листайте ▶ — построение по шагам</Text>}
        </div>
        <Button icon={<RightOutlined />} disabled={step >= total} onClick={() => go(step + 1)} />
      </div>
      <Space style={{ marginTop: 8 }}>
        <Text type="secondary">Ответ:</Text>
        <MathRenderer text={task.answer} />
      </Space>
    </Modal>
  );
}
