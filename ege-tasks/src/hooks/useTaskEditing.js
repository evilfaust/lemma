import { useState } from 'react';
import { message } from 'antd';
import { api } from '../services/pocketbase';

/**
 * Хук для управления заменой и редактированием задач в вариантах.
 * Инкапсулирует состояния модальных окон и обработчики.
 *
 * @param {Array} variants - массив вариантов
 * @param {Function} setVariants - сеттер вариантов
 * @returns {Object} обработчики и состояния для модалок замены/редактирования
 */
export const useTaskEditing = (variants, setVariants) => {
  // Замена задачи
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [taskToReplace, setTaskToReplace] = useState(null);

  // Редактирование задачи
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState(null);

  /**
   * Открыть модалку замены задачи
   */
  const handleReplaceTask = (variantIndex, taskIndex, task) => {
    setTaskToReplace({ variantIndex, taskIndex, task });
    setReplaceModalVisible(true);
  };

  /**
   * Подтвердить замену задачи
   */
  const handleConfirmReplace = (newTask) => {
    const { variantIndex, taskIndex } = taskToReplace;
    const newVariants = [...variants];
    newVariants[variantIndex].tasks[taskIndex] = newTask;
    setVariants(newVariants);
    setReplaceModalVisible(false);
    message.success('Задача успешно заменена');
  };

  /**
   * Отменить замену задачи
   */
  const handleCancelReplace = () => {
    setReplaceModalVisible(false);
    setTaskToReplace(null);
  };

  /**
   * Открыть модалку редактирования задачи
   */
  const handleEditTask = (task) => {
    setTaskToEdit(task);
    setEditModalVisible(true);
  };

  /**
   * Сохранить изменения задачи в БД и обновить варианты
   */
  const handleSaveEdit = async (taskId, values) => {
    try {
      await api.updateTask(taskId, values);
      const newVariants = variants.map(variant => ({
        ...variant,
        tasks: variant.tasks.map(t => (t.id === taskId ? { ...t, ...values } : t)),
      }));
      setVariants(newVariants);
      setEditModalVisible(false);
      setTaskToEdit(null);
      message.success('Задача успешно обновлена');
    } catch (error) {
      message.error('Ошибка при сохранении задачи');
      throw error;
    }
  };

  /**
   * Удалить задачу из БД и из всех вариантов
   */
  const handleDeleteEdit = async (taskId) => {
    await api.deleteTask(taskId);
    const newVariants = variants.map(variant => ({
      ...variant,
      tasks: variant.tasks.filter(t => t.id !== taskId),
    }));
    setVariants(newVariants);
    setEditModalVisible(false);
    setTaskToEdit(null);
    message.success('Задача удалена');
  };

  return {
    // Замена
    replaceModalVisible,
    taskToReplace,
    handleReplaceTask,
    handleConfirmReplace,
    handleCancelReplace,

    // Редактирование
    editModalVisible,
    taskToEdit,
    handleEditTask,
    handleSaveEdit,
    handleDeleteEdit,
    handleCancelEdit: () => {
      setEditModalVisible(false);
      setTaskToEdit(null);
    },
  };
};
