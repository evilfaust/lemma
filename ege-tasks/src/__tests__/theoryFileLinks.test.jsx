import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMarkdownProcessor } from '../hooks/useMarkdownProcessor';
import { isImageMaterial } from '../shared/services/pb/filesClient';

const FILE_URL = 'https://files.l.oipav.ru/api/files/materials/abc123/metodichka_x1y2.pdf';

describe('useMarkdownProcessor (теория): файлы из Библиотеки', () => {
  it('ссылка на файл хранилища — скрепка, новая вкладка, переживает DOMPurify', async () => {
    const { result } = renderHook(() => useMarkdownProcessor(`См. [Методичка](${FILE_URL})`));
    await waitFor(() => expect(result.current).toContain('theory-file-link'));
    expect(result.current).toContain('target="_blank"');
    expect(result.current).toContain('rel="noopener noreferrer"');
    expect(result.current).toContain(`href="${FILE_URL}"`);
  });

  it('обычная внешняя ссылка — новая вкладка, но без скрепки', async () => {
    const { result } = renderHook(() => useMarkdownProcessor('[ФИПИ](https://fipi.ru/ege)'));
    await waitFor(() => expect(result.current).toContain('target="_blank"'));
    expect(result.current).not.toContain('theory-file-link');
  });

  it('якорная ссылка внутри статьи не трогается', async () => {
    const { result } = renderHook(() => useMarkdownProcessor('[к теореме](#teorema)'));
    await waitFor(() => expect(result.current).toContain('href="#teorema"'));
    expect(result.current).not.toContain('target=');
  });

  it('картинка из Библиотеки с размером — класс размера на <img>', async () => {
    const url = 'https://files.l.oipav.ru/api/files/materials/abc123/ris_1.png';
    const { result } = renderHook(() => useMarkdownProcessor(`![Рисунок](${url}){L}`));
    await waitFor(() => expect(result.current).toContain('theory-img--l'));
    expect(result.current).toContain(`src="${url}"`);
  });
});

describe('isImageMaterial', () => {
  it('по mime', () => {
    expect(isImageMaterial({ mime: 'image/png', file: 'x' })).toBe(true);
  });
  it('по расширению, когда mime пустой', () => {
    expect(isImageMaterial({ mime: '', file: 'scan_ab12.JPG' })).toBe(true);
  });
  it('PDF — не картинка', () => {
    expect(isImageMaterial({ mime: 'application/pdf', original_name: 'Учебник.pdf' })).toBe(false);
  });
});
