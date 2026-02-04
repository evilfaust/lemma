import { useState } from 'react';
import { message } from 'antd';
import html2pdf from 'html2pdf.js';
import { api } from '../services/pocketbase';
import { usePuppeteerPDF } from './usePuppeteerPDF';

/**
 * Хук для действий с листами работ (сохранение, печать, экспорт)
 */
export const useWorksheetActions = () => {
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pdfMethod, setPdfMethod] = useState('puppeteer'); // 'puppeteer' | 'legacy'

  const puppeteerPDF = usePuppeteerPDF();

  /**
   * Печать листа
   */
  const handlePrint = () => {
    window.print();
  };

  /**
   * Экспорт в PDF (основной метод с выбором)
   */
  const handleExportPDF = async (printRef, filename = 'Лист задач', options = {}) => {
    if (pdfMethod === 'puppeteer') {
      const success = await puppeteerPDF.exportToPDF(printRef, filename, options);

      // Fallback на старый метод если Puppeteer недоступен
      if (!success && !puppeteerPDF.serverAvailable) {
        message.warning('Переключаемся на резервный метод экспорта...');
        return handleExportPDFLegacy(printRef, filename);
      }

      return success;
    } else {
      return handleExportPDFLegacy(printRef, filename);
    }
  };

  /**
   * Экспорт в PDF (старый метод через html2pdf.js)
   */
  const handleExportPDFLegacy = async (printRef, filename = 'Лист задач') => {
    if (!printRef?.current) {
      message.error('Не найден элемент для экспорта');
      return false;
    }

    setExporting(true);
    message.loading({ content: 'Генерируем PDF (Legacy)...', key: 'pdf', duration: 0 });

    try {
      const opt = {
        margin: [7, 7, 7, 7], // мм
        filename: `${filename}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait'
        },
        pagebreak: {
          mode: 'css',
          before: '.page-break',
          avoid: ['.task-item', '.variant-header']
        }
      };

      await html2pdf().set(opt).from(printRef.current).save();
      message.success({ content: 'PDF успешно сохранён', key: 'pdf', duration: 2 });
      return true;
    } catch (error) {
      console.error('Error generating PDF:', error);
      message.error({ content: 'Ошибка при генерации PDF', key: 'pdf', duration: 2 });
      return false;
    } finally {
      setExporting(false);
    }
  };

  /**
   * Сохранение работы в БД
   */
  const handleSaveWork = async (workData, variants) => {
    setSaving(true);
    try {
      const work = await api.createWork({
        title: workData.title || 'Контрольная работа',
        topic: workData.topic || null,
        time_limit: workData.timeLimit ? parseInt(workData.timeLimit) : null,
      });

      for (const variant of variants) {
        const taskIds = variant.tasks.map(t => t.id);
        const order = variant.tasks.map((t, idx) => ({ taskId: t.id, position: idx }));

        await api.createVariant({
          work: work.id,
          number: variant.number,
          tasks: taskIds,
          order: order,
        });
      }

      message.success(`Работа "${workData.title}" успешно сохранена с ${variants.length} вариантами`);
      return work;
    } catch (error) {
      console.error('Error saving work:', error);
      message.error('Ошибка при сохранении работы');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  /**
   * Загрузка сохранённых работ
   */
  const handleLoadWorks = async () => {
    try {
      const works = await api.getWorks();
      return works;
    } catch (error) {
      console.error('Error loading works:', error);
      message.error('Ошибка при загрузке работ');
      throw error;
    }
  };

  /**
   * Загрузка конкретной работы
   */
  const handleLoadWork = async (workId) => {
    try {
      const work = await api.getWork(workId);
      const variantsData = await api.getVariantsByWork(workId);

      const loadedVariants = [];
      for (const variantData of variantsData) {
        const tasksIds = variantData.tasks || [];
        const order = variantData.order || [];

        const tasks = [];
        for (const taskId of tasksIds) {
          const task = await api.getTask(taskId);
          if (task) {
            tasks.push(task);
          }
        }

        // Сортируем по order
        if (order.length > 0) {
          tasks.sort((a, b) => {
            const posA = order.find(o => o.taskId === a.id)?.position ?? 999;
            const posB = order.find(o => o.taskId === b.id)?.position ?? 999;
            return posA - posB;
          });
        }

        loadedVariants.push({
          number: variantData.number,
          tasks: tasks,
        });
      }

      return { work, variants: loadedVariants };
    } catch (error) {
      console.error('Error loading work:', error);
      message.error('Ошибка при загрузке работы');
      throw error;
    }
  };

  /**
   * Удаление работы
   */
  const handleDeleteWork = async (workId) => {
    try {
      const variantsData = await api.getVariantsByWork(workId);
      for (const variant of variantsData) {
        await api.deleteVariant(variant.id);
      }

      await api.deleteWork(workId);
      message.success('Работа удалена');
    } catch (error) {
      console.error('Error deleting work:', error);
      message.error('Ошибка при удалении работы');
      throw error;
    }
  };

  return {
    saving,
    exporting: exporting || puppeteerPDF.exporting,
    handlePrint,
    handleExportPDF,
    handleExportPDFLegacy,
    handleSaveWork,
    handleLoadWorks,
    handleLoadWork,
    handleDeleteWork,
    // Настройки PDF
    pdfMethod,
    setPdfMethod,
    puppeteerAvailable: puppeteerPDF.serverAvailable,
  };
};
