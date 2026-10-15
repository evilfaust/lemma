import { useEffect, useMemo, useState } from 'react';
import { Button, Tooltip } from 'antd';
import { LeftOutlined, RightOutlined, UndoOutlined } from '@ant-design/icons';
import PlanimCanvas from './PlanimCanvas';
import { parsePlanimBlock } from '../../utils/planim/dsl';
import { evaluateScene } from '../../utils/planim/scene';
import { describeOp } from '../../utils/planim/commands';
import { firstManualStep } from './StudentPlanimManual';
import '../stereo/theoryStereo.css';

/**
 * Живой планиметрический чертёж по исходнику ```planim (v3.9.377, работа по
 * геометрии у ученика): лист можно сдвигать и увеличивать (палец, колёсико),
 * строить нельзя. steps — листать построение по шагам: сначала сама фигура,
 * потом ▶ (как пособие /s/<id>); без steps — сразу готовый чертёж.
 */
export default function PlanimLiveBlock({ spec, steps: withSteps = false }) {
  const parsed = useMemo(() => parsePlanimBlock(spec), [spec]);
  const { scene, size } = parsed;
  const total = scene.ops.length;
  const base = useMemo(() => firstManualStep(scene.ops), [scene]);
  const [step, setStep] = useState(withSteps ? base : total);
  const [view, setView] = useState(null);
  const [flash, setFlash] = useState(null);

  useEffect(() => { setStep(withSteps ? base : total); setView(null); }, [withSteps, base, total]);

  useEffect(() => {
    if (flash == null) return undefined;
    const t = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(t);
  }, [flash]);

  const full = useMemo(() => {
    try { return evaluateScene(scene); } catch { return null; }
  }, [scene]);
  const model = useMemo(() => {
    try { return evaluateScene(scene, { upTo: step }); } catch { return null; }
  }, [scene, step]);

  const go = (k) => {
    const n = Math.max(0, Math.min(total, k));
    setStep(n);
    setFlash(n > step && n > 0 ? n - 1 : null);
  };

  if (!model || !full) return null;
  const current = step > 0 ? model.steps?.[step - 1] : null;
  let caption;
  if (step >= total) caption = total ? `Готовый чертёж · шагов: ${total}` : null;
  else if (step <= base) caption = 'Сначала — сама фигура. Листайте построение ▶';
  else caption = `Шаг ${step} из ${total}: ${current ? describeOp(current.op) : ''}${current?.op?.note ? ` — ${current.op.note}` : ''}`;

  return (
    <div className="theory-stereo planim-live" style={{ maxWidth: size.width }}>
      <div className="theory-stereo-stage" style={{ height: size.height }}>
        <PlanimCanvas
          model={model}
          fitModel={full}
          view={view}
          onViewChange={setView}
          flashStep={flash}
          showGrid={false}
          showHidden={false}
          cursor="grab"
          style={{ width: '100%', height: '100%' }}
          ariaLabel="Чертёж — его можно сдвигать и увеличивать"
        />
        <div className="theory-stereo-tools">
          <Tooltip title="Исходный вид">
            <Button size="small" type="text" icon={<UndoOutlined />} aria-label="Исходный вид" onClick={() => setView(null)} />
          </Tooltip>
        </div>
      </div>
      {withSteps && total > 0 && (
        <div className="theory-stereo-steps">
          <Button size="small" icon={<LeftOutlined />} disabled={step <= 0} onClick={() => go(step - 1)} aria-label="Предыдущий шаг" />
          <span className="theory-stereo-caption">{caption}</span>
          <Button size="small" icon={<RightOutlined />} disabled={step >= total} onClick={() => go(step + 1)} aria-label="Следующий шаг" />
        </div>
      )}
    </div>
  );
}
