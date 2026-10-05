import { STUDENT_SITE } from './studentLogins';

/**
 * Карточки «логин + пароль» для раздачи ученикам (v3.9.294) — чистая сборка
 * текста и HTML без React. Печатается отдельной страницей (`window.open`):
 * своя вёрстка A4 без стилей приложения, только чёрная краска.
 * rows: [{ name, username, password }]
 */

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Список для вставки в мессенджер/таблицу: строка на ученика, через табуляцию. */
export function credentialsText(rows, site = STUDENT_SITE) {
  const lines = (rows || []).map((r) => `${r.name}\tлогин: ${r.username}\tпароль: ${r.password}`);
  return [`Вход: https://${site}`, ...lines].join('\n');
}

/** HTML-документ с карточками: 2 колонки × 5 рядов на A4, линии реза пунктиром. */
export function credentialCardsHtml(rows, { title = '', site = STUDENT_SITE } = {}) {
  const cards = (rows || []).map((r) => `
    <div class="card">
      <div class="top">Lemma · вход ученика${title ? ` · ${esc(title)}` : ''}</div>
      <div class="name">${esc(r.name)}</div>
      <table>
        <tr><td>Сайт</td><td class="v">${esc(site)}</td></tr>
        <tr><td>Логин</td><td class="v mono">${esc(r.username)}</td></tr>
        <tr><td>Пароль</td><td class="v mono">${esc(r.password)}</td></tr>
      </table>
      <div class="hint">При первом входе придумай свой пароль.</div>
    </div>`).join('');
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>Логины учеников${title ? ` — ${esc(title)}` : ''}</title>
<style>
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
  .sheet { display: grid; grid-template-columns: 1fr 1fr; }
  .card { height: 56mm; padding: 5mm 6mm; border: 0.3mm dashed #000; break-inside: avoid; page-break-inside: avoid; }
  .top { font-size: 8pt; letter-spacing: 0.3pt; text-transform: uppercase; }
  .name { font-size: 14pt; font-weight: bold; margin: 2.5mm 0 3mm; }
  table { border-collapse: collapse; font-size: 11pt; }
  td { padding: 0.8mm 3mm 0.8mm 0; vertical-align: baseline; }
  td.v { font-weight: bold; }
  .mono { font-family: "Courier New", monospace; font-size: 14pt; letter-spacing: 0.5pt; }
  .hint { margin-top: 3mm; font-size: 9pt; }
  .noprint { padding: 10px; font-size: 14px; }
  @media print { .noprint { display: none; } }
</style></head>
<body>
  <div class="noprint">Карточек: ${(rows || []).length}. Разрежьте по пунктиру и раздайте ученикам.
    <button onclick="window.print()">Печать</button></div>
  <div class="sheet">${cards}</div>
</body></html>`;
}

/** Открыть карточки в новой вкладке и вызвать печать. false — окно заблокировано. */
export function printCredentialCards(rows, opts) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(credentialCardsHtml(rows, opts));
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* окно закрыли */ } }, 300);
  return true;
}
