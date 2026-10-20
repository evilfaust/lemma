// Фильтры «Всех задач» ⇄ строка адреса (`/app/tasks?topic=…&tags=a,b`).
//
// Раньше адрес разбирался «как есть»: `tags=id` возвращался строкой, и
// `_buildTasksFilter` падал на `filters.tags.map`, а `hasAnswer=false` —
// непустой строкой, то есть «с ответом». Здесь типы восстанавливаются.

const ARRAY_KEYS = new Set(['tags', 'subtopics']);
const BOOL_KEYS = new Set(['hasAnswer', 'hasSolution', 'hasImage']);

export function filtersToSearch(filters) {
  if (!filters) return '';
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v == null || v === '') return;
    if (Array.isArray(v)) {
      if (v.length) p.set(k, v.join(','));
      return;
    }
    p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function parseFiltersFromSearch(searchParams) {
  const filters = {};
  for (const [k, v] of searchParams.entries()) {
    if (ARRAY_KEYS.has(k)) {
      const list = v.split(',').map((s) => s.trim()).filter(Boolean);
      if (list.length) filters[k] = list;
    } else if (BOOL_KEYS.has(k)) {
      if (v === 'true' || v === 'false') filters[k] = v === 'true';
    } else if (k === 'year') {
      const n = Number(v);
      if (n) filters.year = n;
    } else if (v !== '') {
      filters[k] = v;
    }
  }
  return Object.keys(filters).length ? filters : null;
}
