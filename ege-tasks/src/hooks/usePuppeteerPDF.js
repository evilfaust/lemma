import { useState, useCallback } from 'react';
import { App } from 'antd';

/**
 * Хук для экспорта в PDF через Puppeteer на сервере
 * Обеспечивает высокое качество PDF с идеальным рендерингом KaTeX
 */
export const usePuppeteerPDF = () => {
  const { message } = App.useApp();
  const [exporting, setExporting] = useState(false);
  const [serverAvailable, setServerAvailable] = useState(true);

  const PDF_SERVICE_URL = import.meta.env.VITE_PDF_SERVICE_URL || 'http://localhost:3001';

  /**
   * Проверка доступности PDF сервиса
   */
  const checkServer = useCallback(async () => {
    try {
      const response = await fetch(`${PDF_SERVICE_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        const available = data.status === 'ok';
        setServerAvailable(available);
        return available;
      }

      setServerAvailable(false);
      return false;
    } catch (error) {
      console.error('PDF service health check failed:', error);
      setServerAvailable(false);
      return false;
    }
  }, [PDF_SERVICE_URL]);

  /**
   * Подготовка HTML со всеми встроенными стилями
   */
  const prepareHTML = useCallback((element) => {
    // Собираем все стили из документа
    const styles = [];

    // Встроенные стили из <style> тегов
    Array.from(document.querySelectorAll('style')).forEach(styleEl => {
      styles.push(styleEl.textContent);
    });

    // Стили из CSS файлов
    Array.from(document.styleSheets).forEach(styleSheet => {
      try {
        Array.from(styleSheet.cssRules || []).forEach(rule => {
          styles.push(rule.cssText);
        });
      } catch (e) {
        // CORS может блокировать доступ к некоторым стилям
        console.warn('Cannot access stylesheet:', styleSheet.href);
      }
    });

    // Формируем полный HTML документ
    const html = `
      <!DOCTYPE html>
      <html lang="ru">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>PDF Document</title>

          <!-- KaTeX CSS -->
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous">

          <!-- Встроенные стили -->
          <style>
            * {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }

            body {
              margin: 0;
              padding: 0;
              background: white;
            }

            /* Стили для печати */
            @media print {
              .no-print {
                display: none !important;
              }

              .page-break {
                page-break-before: always;
                break-before: page;
              }

              .avoid-break {
                page-break-inside: avoid;
                break-inside: avoid;
              }
            }

            ${styles.join('\n')}
          </style>
        </head>
        <body>
          ${element.outerHTML}
        </body>
      </html>
    `;

    return html;
  }, []);

  /**
   * Экспорт в PDF через Puppeteer
   */
  const exportToPDF = useCallback(async (printRef, filename = 'document', options = {}) => {
    if (!printRef?.current) {
      message.error('Элемент для экспорта не найден');
      return false;
    }

    setExporting(true);
    const hideLoadingMessage = message.loading('Генерируем PDF высокого качества...', 0);

    try {
      // Проверяем доступность сервера
      const available = await checkServer();
      if (!available) {
        throw new Error('PDF сервис недоступен. Используйте резервный метод.');
      }

      // Подготавливаем HTML
      const html = prepareHTML(printRef.current);

      // Отправляем на сервер
      const response = await fetch(`${PDF_SERVICE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html,
          filename: `${filename}.pdf`,
          options: {
            format: options.format || 'A4',
            marginTop: options.marginTop || '5mm',
            marginBottom: options.marginBottom || '5mm',
            marginLeft: options.marginLeft || '5mm',
            marginRight: options.marginRight || '5mm',
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      // Скачиваем PDF
      const blob = await response.blob();

      // Создаём ссылку для скачивания
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}.pdf`;
      document.body.appendChild(link);
      link.click();

      // Очистка
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      hideLoadingMessage();
      message.success('PDF успешно сохранён');
      return true;

    } catch (error) {
      console.error('Puppeteer PDF export error:', error);
      hideLoadingMessage();

      // Показываем ошибку
      if (error.message.includes('недоступен')) {
        message.warning({
          content: error.message,
          duration: 3,
        });
      } else {
        message.error({
          content: `Ошибка генерации PDF: ${error.message}`,
          duration: 4,
        });
      }

      return false;
    } finally {
      setExporting(false);
    }
  }, [PDF_SERVICE_URL, checkServer, prepareHTML]);

  return {
    exporting,
    serverAvailable,
    exportToPDF,
    checkServer,
  };
};
