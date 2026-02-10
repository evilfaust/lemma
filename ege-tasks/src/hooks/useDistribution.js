import { useState } from 'react';
import { App } from 'antd';

/**
 * Универсальный хук для управления распределением задач по ключевому полю.
 *
 * Используется для распределения по тегам (keyField='tag') и по сложности (keyField='difficulty').
 *
 * @param {string} keyField - имя ключевого поля ('tag' | 'difficulty')
 * @param {Object} options
 * @param {Function} options.onTotalChange - колбэк при изменении суммы (total) => void
 * @param {string} options.itemLabel - название элемента для сообщений об ошибках (напр. 'тег', 'уровень сложности')
 */
const useDistribution = (keyField, { onTotalChange, itemLabel = 'элемент' } = {}) => {
  const { message } = App.useApp();
  const [items, setItems] = useState([]);

  const calcTotal = (arr) => arr.reduce((sum, item) => sum + (item.count || 0), 0);

  const notifyTotalChange = (arr) => {
    if (onTotalChange) {
      onTotalChange(calcTotal(arr));
    }
  };

  const addItem = () => {
    const newItems = [...items, { [keyField]: null, count: 1 }];
    setItems(newItems);
    notifyTotalChange(newItems);
  };

  const removeItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    notifyTotalChange(newItems);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
    if (field === 'count') {
      notifyTotalChange(newItems);
    }
  };

  const getTotal = () => calcTotal(items);

  /**
   * Валидация: все ключевые поля заполнены и уникальны.
   * @param {number} [expectedTotal] - ожидаемая сумма (если передана, проверяется совпадение)
   * @returns {boolean}
   */
  const validate = (expectedTotal) => {
    for (let i = 0; i < items.length; i++) {
      if (!items[i][keyField]) {
        message.error(`Выберите ${itemLabel} для строки ${i + 1}`);
        return false;
      }
    }

    const selected = items.map(item => item[keyField]);
    const unique = new Set(selected);
    if (selected.length !== unique.size) {
      message.error(`Каждый ${itemLabel} можно выбрать только один раз`);
      return false;
    }

    if (expectedTotal !== undefined) {
      const total = getTotal();
      if (total !== expectedTotal) {
        message.error(`Сумма задач (${total}) должна равняться общему количеству (${expectedTotal})`);
        return false;
      }
    }

    return true;
  };

  const reset = () => {
    setItems([]);
  };

  return {
    items,
    setItems,
    addItem,
    removeItem,
    updateItem,
    getTotal,
    validate,
    reset,
  };
};

export { useDistribution };
