import { useEffect, useMemo, useState } from 'react';
import { Button, Tooltip } from 'antd';
import {
  LeftOutlined, RightOutlined, UndoOutlined, ZoomInOutlined, ZoomOutOutlined,
} from '@ant-design/icons';
import StereoCanvas from './StereoCanvas';
import { parseStereoBlock } from '../../utils/stereo/dsl';
import { evaluateScene } from '../../utils/stereo/scene';
import { describeOp } from '../../utils/stereo/commands';
import { clampCamera } from '../../utils/stereo/camera';
import './theoryStereo.css';

const ZOOM_STEP = 1.25;

/**
 * Живой блок ```stereo в статье теории: чертёж крутится (мышь, палец),
 * масштаб — кнопками, щипком или Ctrl/⌘ + колёсико (простое колёсико
 * листает статью). Если в блоке есть построения — их можно листать по шагам,
 * начиная с готового чертежа. Ракурс и размер — из самого блока («вид»,
 * «размер»). Печать и PDF берут статичную картинку блока — её этот компонент
 * не трогает (см. useStereoBlocks).
 *
 * steps={false} — без листания шагов (чертёж условия задачи: шаги там — это
 * данные точки, показываются сразу все).
 */
export default function TheoryStereoBlock({ spec, steps: withSteps = true }) {
  const parsed = useMemo(() => parseStereoBlock(spec), [spec]);
  const { scene, size } = parsed;
  const camera0 = parsed.camera;
  const total = scene.ops.length;
  const [camera, setCamera] = useState(camera0);
  const [step, setStep] = useState(total);
  const [flash, setFlash] = useState(null);

  useEffect(() => { setCamera(camera0); setStep(total); }, [camera0, total]);

  useEffect(() => {
    if (flash == null) return undefined;
    const t = setTimeout(() => setFlash(null), 1600);
    return () => clearTimeout(t);
  }, [flash]);

  const model = useMemo(() => {
    try { return evaluateScene(scene, { upTo: step }); } catch { return null; }
  }, [scene, step]);

  const opsById = useMemo(() => Object.fromEntries(scene.ops.map((o, i) => [o.id || `s${i}`, o])), [scene]);

  const go = (k) => {
    const n = Math.max(0, Math.min(total, k));
    setStep(n);
    setFlash(n > step && n > 0 ? n - 1 : null);
  };
  const zoom = (k) => setCamera((c) => clampCamera({ ...c, zoom: (c.zoom || 1) * k }));

  const current = step > 0 && step < total ? scene.ops[step - 1] : null;
  let caption;
  if (step === total) caption = total ? `Всё построение · шагов: ${total}` : null;
  else if (step === 0) caption = 'Само тело';
  else caption = `Шаг ${step} из ${total}: ${describeOp(current, opsById)}${current.note ? ` — ${current.note}` : ''}`;

  if (!model) return null;
  return (
    <div className="theory-stereo" style={{ maxWidth: size.width }}>
      <div className="theory-stereo-stage" style={{ height: size.height }}>
        <StereoCanvas
          model={model}
          camera={camera}
          onCameraChange={setCamera}
          flashStep={flash}
          wheelZoom="modifier"
          ariaLabel="Стереочертёж: крутите мышью или пальцем"
          style={{ minHeight: 0 }}
        />
        <div className="theory-stereo-tools">
          <Tooltip title="Крупнее (Ctrl + колёсико)">
            <Button size="small" type="text" icon={<ZoomInOutlined />} aria-label="Крупнее" onClick={() => zoom(ZOOM_STEP)} />
          </Tooltip>
          <Tooltip title="Мельче">
            <Button size="small" type="text" icon={<ZoomOutOutlined />} aria-label="Мельче" onClick={() => zoom(1 / ZOOM_STEP)} />
          </Tooltip>
          <Tooltip title="Исходный вид">
            <Button size="small" type="text" icon={<UndoOutlined />} aria-label="Исходный вид" onClick={() => setCamera(camera0)} />
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
