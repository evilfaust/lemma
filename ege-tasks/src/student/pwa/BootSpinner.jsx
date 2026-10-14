/**
 * Крутилка загрузки ученического приложения (v3.9.373) — та же, что заставка
 * запуска в `student.html` (стили `.boot*` лежат там же, в <head>). `inline` —
 * без логотипа и фона, для загрузки отдельного экрана внутри уже открытого
 * приложения.
 */
export default function BootSpinner({ inline = false, text = 'Загружаем…' }) {
  return (
    <div className={`boot${inline ? ' boot--inline' : ''}`} role="status" aria-label="Загрузка">
      {!inline && <img className="boot-logo" src="/pwa/icon-192.png" alt="" />}
      <div className="boot-spinner" />
      {text && <div>{text}</div>}
    </div>
  );
}
