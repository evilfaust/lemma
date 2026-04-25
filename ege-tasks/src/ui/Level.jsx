/**
 * Level — кружок уровня сложности 1 / 2 / 3.
 */
export function Level({ n }) {
  const level = Math.max(1, Math.min(3, Number(n) || 1));
  return (
    <span className={`lemma-level lemma-level-${level}`}>{level}</span>
  );
}
