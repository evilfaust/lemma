import { pb, _logAudit } from './client.js';

// Календарь учителя по подписке (v3.9.352): токен ленты .ics живёт в скрытом
// поле teachers.calendar_token, читать и менять его можно только через хук
// pocketbase/pb_hooks/calendar_feed.pb.js. Ссылки собирает
// utils/calendarFeedLink.js.
export const calendarFeedApi = {
  // Токен ленты (хук создаёт его при первом запросе). null — хука нет на
  // сервере или вход истёк: окно подписки покажет ошибку.
  async getCalendarFeedToken() {
    try {
      const res = await pb.send('/api/calendar/link', { method: 'GET', requestKey: null });
      return res?.token || null;
    } catch (error) {
      console.error('Error fetching calendar feed token:', error);
      return null;
    }
  },

  // Новая ссылка: старая перестаёт работать у всех, кто на неё подписан.
  async resetCalendarFeedToken() {
    const res = await pb.send('/api/calendar/link', { method: 'POST', requestKey: null });
    _logAudit('update', 'teachers', pb.authStore.model?.id || '', 'новая ссылка на календарь по подписке');
    return res?.token || null;
  },
};
