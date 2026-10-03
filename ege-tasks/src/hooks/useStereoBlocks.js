import { createElement, useEffect } from 'react';

/**
 * Оживляет блоки ```stereo в HTML статьи: в каждый `.stereo-block` с
 * исходником (`data-stereo-spec`, его кладёт useMarkdownProcessor) ставится
 * React-корень с крутящимся чертежом (TheoryStereoBlock), а статичная
 * картинка блока прячется классом `stereo-block--live` — для печати и PDF
 * она остаётся (theoryStereo.css). Компонент и движок грузятся лениво,
 * только если в статье есть такие блоки.
 *
 * Как useGeoGebraInjection: перезапускается на каждый новый html (React
 * заменяет innerHTML контейнера — прежние корни уходят вместе с ним).
 *
 * @param {React.RefObject} containerRef — контейнер с HTML статьи
 * @param {string} html — текущий HTML (перезапуск эффекта)
 * @param {{ enabled?: boolean }} [opts]
 */
export function useStereoBlocks(containerRef, html, { enabled = true } = {}) {
  useEffect(() => {
    const container = containerRef?.current;
    if (!enabled || !container) return undefined;
    const blocks = [...container.querySelectorAll('.stereo-block[data-stereo-spec]')];
    if (!blocks.length) return undefined;

    let cancelled = false;
    const mounted = [];
    Promise.all([
      import('react-dom/client'),
      import('../components/stereo/TheoryStereoBlock'),
    ]).then(([{ createRoot }, mod]) => {
      if (cancelled) return;
      for (const el of blocks) {
        if (!el.isConnected || el.querySelector(':scope > .stereo-live-block')) continue;
        const mount = document.createElement('div');
        mount.className = 'stereo-live-block';
        el.insertBefore(mount, el.firstChild);
        el.classList.add('stereo-block--live');
        const root = createRoot(mount);
        root.render(createElement(mod.default, { spec: el.getAttribute('data-stereo-spec') }));
        mounted.push({ root, mount, el });
      }
    }).catch(() => { /* блок остаётся картинкой */ });

    return () => {
      cancelled = true;
      const list = mounted.splice(0);
      // DOM чистим сразу (следующий запуск может взять тот же блок), а сам
      // корень снимаем после коммита — синхронный unmount посреди него React
      // не любит.
      for (const { mount, el } of list) {
        mount.remove();
        el.classList.remove('stereo-block--live');
      }
      if (list.length) setTimeout(() => list.forEach(({ root }) => root.unmount()), 0);
    };
  }, [html, enabled]); // containerRef — стабильный ref
}
