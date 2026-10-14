import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import PullToRefresh from '../student/pwa/PullToRefresh';
import BootSpinner from '../student/pwa/BootSpinner';
import { useBlockAppReload } from '../student/pwa/useAppUpdate';
import {
  pullOffset, pullReady, PULL_MAX, PULL_READY, canStartPull,
} from '../student/pwa/pullGesture';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const touchEvent = (type, target, points) => {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  const list = points.map(([x, y]) => ({ clientX: x, clientY: y }));
  Object.defineProperty(ev, 'touches', { value: type === 'touchend' ? [] : list });
  target.dispatchEvent(ev);
  return ev;
};

/** Провести пальцем от y0 до y1 по элементу. */
function swipe(target, y0, y1, { x0 = 100, x1 = 100 } = {}) {
  touchEvent('touchstart', target, [[x0, y0]]);
  const steps = 6;
  let ev;
  for (let i = 1; i <= steps; i += 1) {
    ev = touchEvent('touchmove', target, [[x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps]]);
  }
  touchEvent('touchend', target, []);
  return ev;
}

describe('правила жеста', () => {
  it('сдвиг растёт и упирается в потолок', () => {
    expect(pullOffset(-10)).toBe(0);
    expect(pullOffset(20)).toBeGreaterThan(10);
    expect(pullOffset(50)).toBeLessThan(PULL_READY);
    expect(pullReady(pullOffset(100))).toBe(true);
    expect(pullOffset(5000)).toBe(PULL_MAX);
  });

  it('не с холста чертежа, не из поля, не из прокрученного блока', () => {
    document.body.innerHTML = `
      <div id="page"><p id="text">текст</p>
        <div class="stereo-canvas"><svg><g id="fig"></g></svg></div>
        <input id="inp" />
        <div id="box"><span id="inner">x</span></div>
      </div>`;
    const $ = (id) => document.getElementById(id);
    expect(canStartPull($('text'))).toBe(true);
    expect(canStartPull($('text'), { scrollTop: 40 })).toBe(false);
    expect(canStartPull($('fig'))).toBe(false);
    expect(canStartPull($('inp'))).toBe(false);
    Object.defineProperty($('box'), 'scrollTop', { value: 30 });
    expect(canStartPull($('inner'))).toBe(false);
  });
});

describe('PullToRefresh', () => {
  it('потянул достаточно — обновляет', () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn();
    const { container } = render(<><p id="t">лента</p><PullToRefresh enabled onRefresh={onRefresh} /></>);
    const t = container.querySelector('#t');
    let ev;
    act(() => { ev = swipe(t, 100, 260); });
    expect(ev.defaultPrevented).toBe(true); // страница не пружинит
    expect(container.querySelector('.pwa-ptr.is-refreshing')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(300); });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('чуть-чуть, вверх или вбок — не обновляет', () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn();
    const { container } = render(<><p id="t">лента</p><PullToRefresh enabled onRefresh={onRefresh} /></>);
    const t = container.querySelector('#t');
    act(() => { swipe(t, 100, 140); });
    act(() => { swipe(t, 300, 100); });
    act(() => { swipe(t, 100, 160, { x1: 300 }); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(onRefresh).not.toHaveBeenCalled();
    expect(container.querySelector('.pwa-ptr')).toBeNull();
  });

  it('во время теста не срабатывает', () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn();
    const Test = () => { useBlockAppReload(true); return <p id="t">тест</p>; };
    const { container } = render(<><Test /><PullToRefresh enabled onRefresh={onRefresh} /></>);
    act(() => { swipe(container.querySelector('#t'), 100, 300); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('в браузере (не установлено) молчит — там свой жест', () => {
    const onRefresh = vi.fn();
    const { container } = render(<><p id="t">x</p><PullToRefresh enabled={false} onRefresh={onRefresh} /></>);
    let ev;
    act(() => { ev = swipe(container.querySelector('#t'), 100, 300); });
    expect(ev.defaultPrevented).toBe(false);
    expect(container.querySelector('.pwa-ptr')).toBeNull();
  });
});

describe('заставка запуска', () => {
  it('в student.html есть крутилка до загрузки скриптов, её стили — там же', () => {
    const html = readFileSync(resolve(__dirname, '../../student.html'), 'utf8');
    const root = html.slice(html.indexOf('<div id="root">'), html.indexOf('<script type="module"'));
    expect(root).toMatch(/class="boot-spinner"/);
    expect(html).toMatch(/\.boot-spinner\s*\{/);
    expect(html).toMatch(/student-theme/); // тёмная тема до первой отрисовки
  });

  it('BootSpinner — те же классы', () => {
    const { container } = render(<BootSpinner inline />);
    expect(container.querySelector('.boot.boot--inline .boot-spinner')).not.toBeNull();
  });
});
