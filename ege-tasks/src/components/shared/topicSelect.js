/**
 * Общие настройки селектов темы и подтемы (v3.9.398–399): на планшете поле
 * узкое, а подтема бывает в 90 символов — список открывается шире поля, с
 * переносом длинных названий, а на сенсорном экране без поиска: клавиатура
 * закрывала бы список, тему выбирают пролистыванием.
 *
 *   <Select … {...TOPIC_SELECT} />   — последним атрибутом: он решает showSearch.
 *
 * Подпись темы — `topicOptionLabel` (utils/topicLabel.js): «№5 · Начала
 * теории вероятностей» без повтора «ЕГЭ-База. №5».
 */
import './topicSelect.css';

export { topicOptionLabel } from '../../utils/topicLabel';

/** Пальцевый экран (iPad, телефон). Устройство не меняется — считаем один раз. */
export const IS_TOUCH = (() => {
  try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; }
})();

export const TOPIC_SELECT = {
  popupMatchSelectWidth: 420,
  popupClassName: 'topic-select-popup',
  listHeight: 360,
  // Строки разной высоты (перенос) — виртуальный список считал бы их по 32 px.
  virtual: false,
  showSearch: !IS_TOUCH,
};
