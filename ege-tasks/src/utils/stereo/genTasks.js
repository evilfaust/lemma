// Генератор задач по стереометрии — общая точка входа для экрана:
// сечения (sectionTasks.js) и метрические задачи (metricTasks.js) под одним
// списком типов. Задание любого типа отдаёт одинаковые поля, которые читает
// UI: statement, answer, scene, solutionScene, tag, facets, level.

import { generateSectionTask, sectionTaskToRecord, SECTION_LEVELS } from './sectionTasks';
import {
  generateMetricTask, metricTaskToRecord, METRIC_TYPES, METRIC_LEVELS,
} from './metricTasks';
import { GEN_BODIES } from './genBodies';

/** Типы заданий по группам (порядок — порядок в меню). */
export const GEN_TYPES = {
  build: { label: 'Построить сечение', short: 'Сечения', group: 'Сечения', family: 'section' },
  area: { label: 'Площадь сечения', group: 'Сечения', family: 'section' },
  angleLines: { label: METRIC_TYPES.angleLines.label, group: 'Углы', family: 'metric' },
  angleLinePlane: { label: METRIC_TYPES.angleLinePlane.label, group: 'Углы', family: 'metric' },
  anglePlanes: { label: METRIC_TYPES.anglePlanes.label, group: 'Углы', family: 'metric' },
  distPointLine: { label: METRIC_TYPES.distPointLine.label, group: 'Расстояния', family: 'metric' },
  distPointPlane: { label: METRIC_TYPES.distPointPlane.label, group: 'Расстояния', family: 'metric' },
  distSkew: { label: METRIC_TYPES.distSkew.label, group: 'Расстояния', family: 'metric' },
  volume: { label: METRIC_TYPES.volume.label, group: 'Объёмы', family: 'metric' },
};

export const GEN_TYPE_GROUPS = ['Сечения', 'Углы', 'Расстояния', 'Объёмы'];

/** Что значит уровень сложности для семейства типа. */
export const GEN_LEVELS = { section: SECTION_LEVELS, metric: METRIC_LEVELS };

export const familyOf = (type) => GEN_TYPES[type]?.family || 'section';

/** Сгенерировать задание любого типа; null — подходящее не нашлось. */
export function generateGenTask({
  body, type, level, seed,
}) {
  if (familyOf(type) === 'metric') return generateMetricTask({ body, type, level, seed });
  return generateSectionTask({ body, type, level, seed });
}

/** Задание → запись банка geometry_tasks. */
export function genTaskToRecord(task, opts) {
  return task.family === 'metric' ? metricTaskToRecord(task, opts) : sectionTaskToRecord(task, opts);
}

/** Префикс кода задачи в банке. */
export function genCodePrefix(type) {
  return familyOf(type) === 'metric' ? METRIC_TYPES[type].prefix : 'SEC';
}

/**
 * Тип и тело позиции листа: типы идут по кругу, а тела меняются после
 * каждого полного круга типов (3 типа × 2 тела: т1/А, т2/А, т3/А, т1/Б…).
 */
export function slotPlan(types, bodies, index) {
  const t = types.length ? types : ['build'];
  const b = bodies.length ? bodies : ['cube'];
  return { type: t[index % t.length], body: b[Math.floor(index / t.length) % b.length] };
}

export { GEN_BODIES };
