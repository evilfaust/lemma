export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* Запасной способ для браузеров без доступа к Clipboard API. */ }
  const el = document.createElement('textarea');
  el.value = text;
  el.style.cssText = 'position:fixed;opacity:0;';
  document.body.appendChild(el);
  try {
    el.select();
    return !!document.execCommand('copy');
  } catch {
    return false;
  } finally {
    el.remove();
  }
}
