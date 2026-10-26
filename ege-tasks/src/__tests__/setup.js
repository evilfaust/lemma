import '@testing-library/jest-dom';

// jsdom не реализует matchMedia — нужно для Ant Design responsive grid
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom не реализует ResizeObserver — Ant Design Tooltip/Popover полагается на него
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Стили Ant Design (CSS-in-JS) — в документе, но без правил. jsdom считает
// каскад по ВСЕМ правилам для каждого элемента, а getByRole({ name }) спрашивает
// видимость у каждого кандидата: тысячи правил Ant съедали ~70 % времени
// тестов с окнами (журнал класса: 49 с → 7 с). Тег <style> остаётся на месте
// (Ant сам его находит и снимает), innerHTML хранит текст — Ant сверяет его
// при обновлении. Видимость в тестах держится на inline-стилях Ant
// (display:none у закрытых окон и списков), не на его CSS.
if (typeof window !== 'undefined') {
  const isAntStyle = (n) => n && n.nodeName === 'STYLE'
    && (n.hasAttribute('data-css-hash') || n.hasAttribute('data-rc-order') || n.hasAttribute('data-token-hash'));
  const mute = (n) => {
    if (!isAntStyle(n) || n.__lemmaMuted) return;
    let css = n.innerHTML;
    n.textContent = '';
    n.__lemmaMuted = true;
    Object.defineProperty(n, 'innerHTML', { configurable: true, get: () => css, set: (v) => { css = v; } });
  };
  const insertBefore = Node.prototype.insertBefore;
  const appendChild = Node.prototype.appendChild;
  Node.prototype.insertBefore = function (n, ref) { mute(n); return insertBefore.call(this, n, ref); };
  Node.prototype.appendChild = function (n) { mute(n); return appendChild.call(this, n); };
}
