import { useEffect } from 'react';

/**
 * Внедряет GeoGebra-изображения в DOM-узлы с классом .geogebra-embed
 * после рендера HTML из Markdown.
 *
 * @param {React.RefObject} containerRef - ссылка на DOM-контейнер с HTML
 * @param {string} html - текущий HTML (для перезапуска эффекта при изменении)
 * @param {Map<string, object>} appletsById - Map: id → { previewImage, caption }
 */
export function useGeoGebraInjection(containerRef, html, appletsById) {
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const embeds = container.querySelectorAll('.geogebra-embed');
    embeds.forEach((el) => {
      const blockId = el.getAttribute('data-geogebra-id') || '';
      const applet = appletsById.get(blockId);
      el.innerHTML = '';

      if (applet?.previewImage) {
        el.removeAttribute('style');
        const wrapper = document.createElement('div');
        wrapper.className = 'theory-ggb-block';

        const img = document.createElement('img');
        img.className = 'theory-ggb-image';
        img.src = applet.previewImage;
        img.alt = applet.caption || blockId;
        wrapper.appendChild(img);

        if (applet.caption) {
          const cap = document.createElement('div');
          cap.className = 'theory-ggb-caption';
          cap.textContent = applet.caption;
          wrapper.appendChild(cap);
        }

        el.appendChild(wrapper);
      } else if (blockId) {
        // Показываем плейсхолдер: блок создан, но PNG ещё не сохранён
        const placeholder = document.createElement('div');
        placeholder.className = 'theory-ggb-placeholder';
        placeholder.textContent = `GeoGebra: блок «${blockId}» — нарисуйте чертёж и нажмите «Снять PNG»`;
        el.appendChild(placeholder);
      }
    });
  }, [html, appletsById]); // containerRef — стабильный ref, не нужен в deps
}
