import { intervalGapLabels } from '../../../utils/lab/intervalContract';

const cycle = (value, choices) => choices[(choices.indexOf(value) + 1) % choices.length];
const signLabel = (value) => value === 1 ? '+' : value === -1 ? '−' : '?';
const pointLabel = (value) => value === true ? '●' : value === false ? '○' : '?';

export default function IntervalBoard({ current, step, value, answers, onChange, disabled }) {
  const confirmed = (key) => {
    if (step === 'roots' || step === 'order') return null;
    const row = answers[`${current.key}.${key}`];
    return row?.correct ? row.value : null;
  };
  const ordering = step === 'order';
  const roots = current.roots ?? Array.from({ length: current.rootCount }, (_, i) => ordering ? value[i] : null);
  const gaps = intervalGapLabels(roots);
  const changes = step === 'changes' ? value : confirmed('changes');
  const points = step === 'points' ? value : confirmed('points');
  const signs = step === 'signs' ? value : confirmed('signs');
  const shaded = step === 'answer' ? value.gaps : confirmed('answer')?.gaps;
  const set = (i, next) => onChange(value.map((v, idx) => idx === i ? next : v));
  const toggleGap = (i) => onChange({ ...value, gaps: value.gaps.map((v, idx) => idx === i ? !v : v) });
  const cells = [];
  for (let i = 0; i <= roots.length; i++) {
    cells.push(
      <div className={`li-gap${shaded?.[i] ? ' li-gap-shaded' : ''}`} key={`gap${i}`}>
        {step === 'signs' ? (
          <button type="button" disabled={disabled} aria-label={`Знак ${gaps[i]}: ${signLabel(signs[i])}`} onClick={() => set(i, cycle(signs[i], [null, 1, -1]))}>{signLabel(signs[i])}</button>
        ) : step === 'answer' ? (
          <button type="button" disabled={disabled} aria-pressed={shaded[i]} aria-label={`Заштриховать промежуток ${gaps[i]}`} onClick={() => toggleGap(i)}>{signLabel(signs?.[i])}</button>
        ) : signs && <span className="li-mark">{signLabel(signs[i])}</span>}
      </div>,
    );
    if (i === roots.length) continue;
    const root = roots[i];
    cells.push(
      <div className="li-point" key={`point${i}`}>
        <div className="li-point-top">
          {step === 'changes' ? (
            <button type="button" disabled={disabled} aria-label={`Отметить чётную кратность в точке ${root}`} aria-pressed={changes[i] === false} onClick={() => set(i, changes[i] === false)}>{changes[i] === false ? '!' : '·'}</button>
          ) : changes?.[i] === false && <span className="li-mark" aria-label="Чётная кратность">!</span>}
        </div>
        {step === 'points' ? (
          <button className="li-dot-button" type="button" disabled={disabled} aria-label={`Точка ${root}: ${points[i] == null ? 'не отмечена' : points[i] ? 'закрашена' : 'выколота'}`} onClick={() => set(i, cycle(points[i], [null, true, false]))}>{pointLabel(points[i])}</button>
        ) : <span className="li-dot" aria-label={points?.[i] == null ? undefined : points[i] ? 'Закрашенная точка' : 'Выколотая точка'}>{points?.[i] == null ? '│' : pointLabel(points[i])}</span>}
        {ordering && root != null ? (
          <button className="li-order-label" type="button" disabled={disabled} aria-label={`Убрать ${root} с прямой`} onClick={() => onChange(value.filter((_, j) => j !== i))}>{root}</button>
        ) : <b>{root ?? '·'}</b>}
      </div>,
    );
  }
  return <>
    <div className="li-board-scroll" role="group" aria-label="Числовая прямая">
      <div className="li-board" style={{ gridTemplateColumns: `repeat(${roots.length}, minmax(36px, 1fr) 36px) minmax(36px, 1fr)` }}>{cells}</div>
    </div>
    {ordering && <div className="li-choices" aria-label="Найденные корни">
      {current.rootChoices.map(root => <button type="button" key={root} disabled={disabled || value.includes(root)} onClick={() => onChange([...value, root])}>{root}</button>)}
    </div>}
  </>;
}
