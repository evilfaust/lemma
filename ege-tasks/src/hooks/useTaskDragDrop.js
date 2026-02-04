import { useState } from 'react';
import { message } from 'antd';

/**
 * Хук для управления drag & drop задач между вариантами
 */
export const useTaskDragDrop = (variants, setVariants) => {
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverTask, setDragOverTask] = useState(null);

  /**
   * Начало перетаскивания задачи
   */
  const handleDragStart = (e, variantIndex, taskIndex) => {
    setDraggedTask({ variantIndex, taskIndex });
    e.dataTransfer.effectAllowed = 'move';
  };

  /**
   * Перетаскивание над задачей
   */
  const handleDragOver = (e, variantIndex, taskIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTask({ variantIndex, taskIndex });
  };

  /**
   * Выход из зоны задачи
   */
  const handleDragLeave = () => {
    setDragOverTask(null);
  };

  /**
   * Отпускание задачи
   */
  const handleDrop = (e, targetVariantIndex, targetTaskIndex) => {
    e.preventDefault();

    if (!draggedTask) return;

    const { variantIndex: sourceVariantIndex, taskIndex: sourceTaskIndex } = draggedTask;

    // Если перетащили на то же место
    if (sourceVariantIndex === targetVariantIndex && sourceTaskIndex === targetTaskIndex) {
      setDraggedTask(null);
      setDragOverTask(null);
      return;
    }

    const newVariants = [...variants];
    const sourceTask = newVariants[sourceVariantIndex].tasks[sourceTaskIndex];

    // Удаляем задачу из исходного варианта
    newVariants[sourceVariantIndex].tasks.splice(sourceTaskIndex, 1);

    // Вставляем задачу в целевой вариант
    newVariants[targetVariantIndex].tasks.splice(targetTaskIndex, 0, sourceTask);

    setVariants(newVariants);
    setDraggedTask(null);
    setDragOverTask(null);
    message.success('Задача перемещена');
  };

  /**
   * Завершение перетаскивания
   */
  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverTask(null);
  };

  /**
   * Проверка, перетаскивается ли задача
   */
  const isDragging = (variantIndex, taskIndex) => {
    return draggedTask?.variantIndex === variantIndex && draggedTask?.taskIndex === taskIndex;
  };

  /**
   * Проверка, находится ли курсор над задачей
   */
  const isDragOver = (variantIndex, taskIndex) => {
    return dragOverTask?.variantIndex === variantIndex && dragOverTask?.taskIndex === taskIndex;
  };

  return {
    draggedTask,
    dragOverTask,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    isDragging,
    isDragOver,
  };
};
