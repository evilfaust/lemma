/**
 * ConfigBlock — карточка секции генератора с toggle-переключателем.
 * Активная секция: синяя граница + лёгкий градиент.
 * Неактивная: нейтральная граница + bg-raised.
 *
 * Props:
 *   title     string    — заголовок секции
 *   enabled   boolean   — включена ли секция (default true)
 *   onToggle  function  — колбэк переключения (если не передан — toggle не рендерится)
 *   children  ReactNode — дополнительные настройки внутри карточки
 *   style     object    — доп. стили
 */
export function ConfigBlock({ title, enabled = true, onToggle, children, style }) {
  return (
    <div style={{
      padding: '12px 14px',
      border: `1px solid ${enabled ? 'var(--accent)' : 'var(--rule)'}`,
      borderRadius: 'var(--radius)',
      background: enabled
        ? 'linear-gradient(180deg, var(--accent-soft) 0%, var(--bg-raised) 100%)'
        : 'var(--bg-raised)',
      transition: 'border-color .15s, background .15s',
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Toggle */}
        {onToggle !== undefined && (
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={enabled}
            style={{
              flexShrink: 0,
              width: 32,
              height: 18,
              borderRadius: 999,
              background: enabled ? 'var(--accent)' : 'var(--bg-sunken)',
              border: enabled ? 'none' : '1px solid var(--rule)',
              position: 'relative',
              cursor: 'pointer',
              transition: 'background .15s, border-color .15s',
              marginTop: 2,
              padding: 0,
              outline: 'none',
            }}
          >
            <span style={{
              position: 'absolute',
              top: 3,
              left: enabled ? 15 : 3,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 2px rgba(0,0,0,.18)',
              transition: 'left .15s',
              display: 'block',
            }} />
          </button>
        )}

        {/* Содержимое */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 600,
            fontSize: 13,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
            lineHeight: 1.3,
            marginBottom: children ? 10 : 0,
          }}>
            {title}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * ConfigRow — строка метки + контрол внутри ConfigBlock.
 * label string, children ReactNode
 */
export function ConfigRow({ label, children, style }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 8,
      ...style,
    }}>
      <span style={{
        fontSize: 11,
        color: 'var(--ink-3)',
        fontWeight: 500,
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

/**
 * ConfigLabel — eyebrow-метка внутри ConfigBlock (верхний колонтитул секции настроек).
 */
export function ConfigLabel({ children }) {
  return (
    <div style={{
      fontSize: 9.5,
      textTransform: 'uppercase',
      letterSpacing: '0.09em',
      fontWeight: 600,
      color: 'var(--ink-3)',
      marginBottom: 6,
    }}>
      {children}
    </div>
  );
}
