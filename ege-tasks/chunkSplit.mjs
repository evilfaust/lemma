// Ручные куски сборки (v3.9.413) — см. комментарий в vite.config.js.
//
// 'api'   — наш слой API (src/shared/services): меняется почти в каждом
//           релизе, поэтому живёт отдельно и не сбрасывает кэш antd.
// 'react' — react/react-dom/scheduler: иначе 'api' забрал бы их к себе как
//           зависимости, и каждый релиз снова менял бы всё.
// 🚨 Библиотеки интерфейса (antd, rc-*, markdown) сюда НЕ добавлять: общий
//    кусок antd тащил учительское в ученическое (v3.9.374). Сторож —
//    src/__tests__/buildChunks.test.js.

const REACT_RE = /\/node_modules\/(react|react-dom|scheduler)\//;

export function manualChunk(id) {
  const path = String(id).replace(/\\/g, '/');
  if (REACT_RE.test(path)) return 'react';
  if (path.includes('/src/shared/services/')) return 'api';
  return undefined;
}

// Выходные настройки Rollup для vite.config.js.
// minifyInternalExports: false — экспорты между кусками под настоящими
// именами, а не однобуквенными: буквы Rollup раздаёт в порядке, который от
// сборки к сборке плавает, и из ОДНОГО кода получались два разных куска antd
// и react (проверено: 3 сборки подряд — два варианта хешей). Цена — +2–3 КБ
// сжатого старта; без этого стабильные куски не стабильны.
export const CHUNK_OUTPUT = {
  manualChunks: manualChunk,
  minifyInternalExports: false,
};

