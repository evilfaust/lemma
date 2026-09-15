import { pb, _logAudit } from './client.js';
import { PB_BASE_URL } from '../pocketbaseUrl';

// ТДФ — Теоремы, Определения, Формулы.
// Коллекции общие для всех учителей (банк, как tasks/theory): owner здесь не
// проставляется — см. миграцию 1783300000, раздел «банк читается как раньше».

// Поля пункта, достаточные для сводки на главной и для списков: без
// geogebra_base64 (десятки КБ на запись) — он нужен только в редакторе.
const ITEM_BRIEF_FIELDS = [
  'id', 'tdf_set', 'order', 'is_section_header', 'section_title', 'type', 'name',
  'formulation_md', 'short_notation_md', 'drawing_image', 'drawing_image_control',
  'formula_control_hidden', 'question_md', 'updated',
].join(',');

// Текстовые поля пункта — копируются при клонировании как есть.
const ITEM_TEXT_FIELDS = [
  'is_section_header', 'section_title', 'type', 'name', 'question_md',
  'formulation_md', 'short_notation_md', 'geogebra_base64',
  'geogebra_base64_control', 'geogebra_appname', 'formula_control_hidden',
];

export const tdfApi = {
  // ==================== ТДФ (Теоремы, Определения, Формулы) ====================

  // --- tdf_sets ---
  async getTdfSets() {
    try {
      return await pb.collection('tdf_sets').getFullList({ sort: 'order,title' });
    } catch (error) {
      console.error('Error fetching tdf_sets:', error);
      return [];
    }
  },

  /**
   * Наборы + все пункты (брифом) + варианты одним заходом — главная раздела
   * показывает состав каждого набора, а не только название. Три запроса вместо
   * 2N: на 6 наборах разница незаметна, на 60 — принципиальна.
   */
  async getTdfOverview() {
    try {
      const [sets, items, variants] = await Promise.all([
        pb.collection('tdf_sets').getFullList({ sort: 'order,title' }),
        pb.collection('tdf_items').getFullList({ sort: 'order', fields: ITEM_BRIEF_FIELDS }),
        pb.collection('tdf_variants').getFullList({ sort: 'number', fields: 'id,tdf_set,number,title,item_ids' }),
      ]);

      const itemsBySet = {};
      for (const item of items) {
        (itemsBySet[item.tdf_set] ||= []).push(item);
      }
      const variantsBySet = {};
      for (const v of variants) {
        (variantsBySet[v.tdf_set] ||= []).push(v);
      }
      return { sets, itemsBySet, variantsBySet };
    } catch (error) {
      console.error('Error fetching tdf overview:', error);
      return { sets: [], itemsBySet: {}, variantsBySet: {} };
    }
  },

  async getTdfSet(id) {
    try {
      return await pb.collection('tdf_sets').getOne(id);
    } catch (error) {
      console.error('Error fetching tdf_set:', error);
      throw error;
    }
  },

  async createTdfSet(data) {
    try {
      const rec = await pb.collection('tdf_sets').create(data);
      _logAudit('create', 'tdf_sets', rec.id, rec.title);
      return rec;
    } catch (error) {
      console.error('Error creating tdf_set:', error);
      throw error;
    }
  },

  async updateTdfSet(id, data) {
    try {
      return await pb.collection('tdf_sets').update(id, data);
    } catch (error) {
      console.error('Error updating tdf_set:', error);
      throw error;
    }
  },

  async deleteTdfSet(id) {
    try {
      let summary = id;
      try {
        const s = await pb.collection('tdf_sets').getOne(id, { fields: 'id,title' });
        summary = s.title || id;
      } catch (_) {}
      const res = await pb.collection('tdf_sets').delete(id);
      _logAudit('delete', 'tdf_sets', id, summary);
      return res;
    } catch (error) {
      console.error('Error deleting tdf_set:', error);
      throw error;
    }
  },

  /**
   * Копия набора вместе с пунктами (варианты не копируются: они собираются под
   * конкретный опрос). Учитель ведёт «Площади фигур, 8 класс» и делает из него
   * версию для следующего года, не собирая конспект заново.
   */
  async duplicateTdfSet(id, titleSuffix = ' — копия') {
    const src = await pb.collection('tdf_sets').getOne(id);
    const copy = await this.createTdfSet({
      title: (src.title || 'Без названия') + titleSuffix,
      class_number: src.class_number || null,
      description: src.description || '',
      order: (src.order ?? 0) + 1,
    });
    const items = await pb.collection('tdf_items').getFullList({
      filter: `tdf_set="${id}"`,
      sort: 'order',
    });
    await this.copyTdfItemsToSet(items.map(i => i.id), copy.id);
    return copy;
  },

  // --- tdf_items ---
  async getTdfItems(setId) {
    try {
      return await pb.collection('tdf_items').getFullList({
        filter: `tdf_set="${setId}"`,
        sort: 'order',
      });
    } catch (error) {
      console.error('Error fetching tdf_items:', error);
      return [];
    }
  },

  async createTdfItem(data) {
    try {
      const rec = await pb.collection('tdf_items').create(data);
      _logAudit('create', 'tdf_items', rec.id, rec.name || rec.section_title || rec.id);
      return rec;
    } catch (error) {
      console.error('Error creating tdf_item:', error);
      throw error;
    }
  },

  async updateTdfItem(id, data) {
    try {
      return await pb.collection('tdf_items').update(id, data);
    } catch (error) {
      console.error('Error updating tdf_item:', error);
      throw error;
    }
  },

  async deleteTdfItem(id) {
    try {
      let summary = id;
      try {
        const it = await pb.collection('tdf_items').getOne(id, { fields: 'id,name,section_title' });
        summary = it.name || it.section_title || id;
      } catch (_) {}
      const res = await pb.collection('tdf_items').delete(id);
      _logAudit('delete', 'tdf_items', id, summary);
      return res;
    } catch (error) {
      console.error('Error deleting tdf_item:', error);
      throw error;
    }
  },

  /**
   * Переупорядочивание пунктов: PATCH уходит ТОЛЬКО тем, у кого order реально
   * изменился. Раньше перетаскивание одной строки переписывало весь набор
   * (21 запрос на наборе из 21 пункта).
   *
   * @param {Array<{id: string, order: number}>} ordered — пункты в новом порядке
   * @param {Object<string, number>} prevOrders — id → прежний order
   */
  async reorderTdfItems(ordered, prevOrders = {}) {
    const changed = ordered
      .map((it, idx) => ({ id: it.id, order: idx, was: prevOrders[it.id] ?? it.order }))
      .filter(x => x.was !== x.order);
    await Promise.all(
      changed.map(x => pb.collection('tdf_items').update(x.id, { order: x.order }))
    );
    return changed.length;
  },

  /**
   * Копирует пункты (вместе с чертежами и состоянием GeoGebra) в другой набор.
   * Пункты жёстко привязаны к набору relation'ом с cascadeDelete, поэтому
   * «собрать итоговый опросник из пунктов разных наборов» можно только копией:
   * правка копии оригинал не трогает — это сознательный выбор, не побочный эффект.
   *
   * @returns {Promise<{copied: number, failed: number}>}
   */
  async copyTdfItemsToSet(itemIds, targetSetId) {
    if (!itemIds?.length || !targetSetId) return { copied: 0, failed: 0 };

    // Хвост целевого набора — копии встают в конец, не ломая существующий порядок.
    const existing = await pb.collection('tdf_items').getFullList({
      filter: `tdf_set="${targetSetId}"`,
      fields: 'id,order',
    });
    let nextOrder = existing.length;

    let copied = 0;
    let failed = 0;

    for (const id of itemIds) {
      try {
        const src = await pb.collection('tdf_items').getOne(id);
        const formData = new FormData();
        formData.append('tdf_set', targetSetId);
        formData.append('order', nextOrder++);

        for (const field of ITEM_TEXT_FIELDS) {
          const value = src[field];
          if (value !== undefined && value !== null && value !== '') {
            formData.append(field, value);
          }
        }

        // Файлы чертежей: скачиваем из PocketBase и перезаливаем (паттерн
        // duplicateGeometryTask). Не смогли — копия едет без чертежа, но едет.
        for (const field of ['drawing_image', 'drawing_image_control']) {
          const fileName = src[field];
          if (!fileName) continue;
          try {
            const resp = await fetch(`${PB_BASE_URL}/api/files/tdf_items/${src.id}/${fileName}`);
            if (resp.ok) {
              const blob = await resp.blob();
              formData.append(field, new File([blob], fileName, { type: blob.type || 'image/png' }));
            }
          } catch (_) { /* без чертежа */ }
        }

        await pb.collection('tdf_items').create(formData);
        copied++;
      } catch (error) {
        console.error('Error copying tdf_item:', id, error);
        failed++;
      }
    }

    _logAudit('create', 'tdf_items', targetSetId, `копирование пунктов: ${copied}`);
    return { copied, failed };
  },

  getTdfItemDrawingUrl(item) {
    if (!item?.drawing_image) return null;
    return `${PB_BASE_URL}/api/files/tdf_items/${item.id}/${item.drawing_image}`;
  },

  getTdfItemControlDrawingUrl(item) {
    if (!item?.drawing_image_control) return null;
    return `${PB_BASE_URL}/api/files/tdf_items/${item.id}/${item.drawing_image_control}`;
  },

  // --- tdf_variants ---
  async getTdfVariants(setId) {
    try {
      return await pb.collection('tdf_variants').getFullList({
        filter: `tdf_set="${setId}"`,
        sort: 'number',
      });
    } catch (error) {
      console.error('Error fetching tdf_variants:', error);
      return [];
    }
  },

  async getTdfVariant(id) {
    try {
      return await pb.collection('tdf_variants').getOne(id);
    } catch (error) {
      console.error('Error fetching tdf_variant:', error);
      throw error;
    }
  },

  async createTdfVariant(data) {
    try {
      const rec = await pb.collection('tdf_variants').create(data);
      _logAudit('create', 'tdf_variants', rec.id, `вариант ${rec.number}${rec.title ? ' — ' + rec.title : ''}`);
      return rec;
    } catch (error) {
      console.error('Error creating tdf_variant:', error);
      throw error;
    }
  },

  async updateTdfVariant(id, data) {
    try {
      return await pb.collection('tdf_variants').update(id, data);
    } catch (error) {
      console.error('Error updating tdf_variant:', error);
      throw error;
    }
  },

  async deleteTdfVariant(id) {
    try {
      let summary = id;
      try {
        const v = await pb.collection('tdf_variants').getOne(id, { fields: 'id,number,title' });
        summary = `вариант ${v.number}${v.title ? ' — ' + v.title : ''}`;
      } catch (_) {}
      const res = await pb.collection('tdf_variants').delete(id);
      _logAudit('delete', 'tdf_variants', id, summary);
      return res;
    } catch (error) {
      console.error('Error deleting tdf_variant:', error);
      throw error;
    }
  },
};
