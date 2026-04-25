import { Chip, topicTint } from './Chip';

/**
 * WorkRow — строка работы в списке «Мои работы».
 * work: { title, sub, date, cls, tasks, var, grade, draft, active, code, kind, tint }
 * onClick: () => void
 * actions: ReactNode (иконки-кнопки справа)
 */
export function WorkRow({ work, onClick, actions }) {
  const gradeColor = work.grade == null
    ? 'var(--ink-4)'
    : work.grade >= 4
      ? 'var(--lvl-1)'
      : work.grade >= 3
        ? 'var(--lvl-2)'
        : 'var(--lvl-3)';

  const tint = work.tint || topicTint(work.kind || '');

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '13px 16px',
        border: '1px solid var(--rule)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-raised)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background .12s, border-color .12s, box-shadow .12s',
      }}
      onMouseEnter={e => {
        if (!onClick) return;
        e.currentTarget.style.background = 'var(--bg-hover)';
        e.currentTarget.style.borderColor = '#d1d5db';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(13,19,33,.05)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--bg-raised)';
        e.currentTarget.style.borderColor = 'var(--rule)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Код */}
      <div style={{
        width: 100,
        flexShrink: 0,
        fontFamily: 'var(--font-mono)',
        fontSize: 11.5,
        color: 'var(--ink-3)',
        letterSpacing: '0.02em',
      }}>
        {work.code}
      </div>

      {/* Название + подзаголовок */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {work.title}
          </span>
          {work.draft && (
            <span style={{ fontSize: 11, fontWeight: 500, padding: '1px 6px', borderRadius: 4, background: 'var(--c-amber-soft)', color: 'var(--c-amber)' }}>
              черновик
            </span>
          )}
          {work.active && (
            <span style={{ fontSize: 11, fontWeight: 500, padding: '1px 6px', borderRadius: 4, background: 'var(--lvl-1)', color: '#fff', opacity: 0.9 }}>
              активна
            </span>
          )}
        </div>
        {work.sub && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{work.sub}</div>
        )}
      </div>

      {/* Тип */}
      {work.kind && <Chip tint={tint}>{work.kind}</Chip>}

      {/* Класс */}
      {work.cls && (
        <div style={{ fontSize: 13, color: 'var(--ink-3)', flexShrink: 0, width: 64 }}>{work.cls}</div>
      )}

      {/* Задачи */}
      {work.tasks != null && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)', width: 40, textAlign: 'right', flexShrink: 0 }}>
          {work.tasks}
        </div>
      )}

      {/* Варианты */}
      {work.var != null && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)', width: 32, textAlign: 'right', flexShrink: 0 }}>
          {work.var}
        </div>
      )}

      {/* Средний балл */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: gradeColor, width: 36, textAlign: 'right', flexShrink: 0 }}>
        {work.grade != null ? work.grade : '—'}
      </div>

      {/* Дата */}
      {work.date && (
        <div style={{ fontSize: 12, color: 'var(--ink-3)', flexShrink: 0, width: 56 }}>{work.date}</div>
      )}

      {/* Действия */}
      {actions && (
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </div>
  );
}
