import { Breadcrumb } from 'antd';

/**
 * PageHeader — шапка страницы.
 * crumbs: string[]  — хлебные крошки
 * title: string     — H1
 * lede: string      — подзаголовок под H1
 * actions: ReactNode — кнопки справа
 */
export function PageHeader({ crumbs, title, lede, actions, style }) {
  const breadcrumbItems = crumbs?.map((label, i) => ({
    title: label,
    key: i,
  }));

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: 20,
      paddingBottom: 16,
      borderBottom: '1px solid var(--rule-soft)',
      ...style,
    }}>
      <div>
        {crumbs?.length > 0 && (
          <Breadcrumb
            items={breadcrumbItems}
            style={{ marginBottom: 6 }}
          />
        )}
        <h1 style={{
          fontSize: 'var(--page-title-size)',
          fontWeight: 'var(--page-title-weight)',
          letterSpacing: 'var(--page-title-tracking)',
          margin: 0,
          color: 'var(--ink)',
          lineHeight: 1.15,
          fontFamily: 'var(--font-body)',
        }}>
          {title}
        </h1>
        {lede && (
          <div style={{
            fontSize: 13,
            color: 'var(--ink-3)',
            marginTop: 4,
            lineHeight: 1.5,
          }}>
            {lede}
          </div>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 16 }}>
          {actions}
        </div>
      )}
    </div>
  );
}
