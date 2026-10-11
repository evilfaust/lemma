/**
 * Ссылки на календарь учителя по подписке (v3.9.352, хук
 * pocketbase/pb_hooks/calendar_feed.pb.js).
 *
 *   https  — сама лента .ics (вставить в Google / Яндекс / Outlook «по URL»);
 *   webcal — та же лента для Apple: iPhone и Mac по такой ссылке сразу
 *            открывают окно «Подписаться на календарь»;
 *   google — страница Google Календаря «добавить по ссылке».
 */
export function calendarFeedLinks(baseUrl, token) {
  if (!token) return null;
  const https = `${String(baseUrl || '').replace(/\/+$/, '')}/api/calendar/feed/${token}.ics`;
  const webcal = https.replace(/^https?:\/\//, 'webcal://');
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
  };
}
