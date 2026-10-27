// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { manualChunk, CHUNK_OUTPUT } from '../../chunkSplit.mjs';

// Ручные куски сборки (v3.9.413): отдельно только наш слой API и React — ради
// кэша между деплоями. Библиотеки интерфейса в ручные куски не уходят: общий
// кусок antd тащил учительское в ученическое (v3.9.374).
const NM = '/Users/x/app/ege-tasks/node_modules';
const SRC = '/Users/x/app/ege-tasks/src';

describe('manualChunk', () => {
  it('React — в свой кусок', () => {
    expect(manualChunk(`${NM}/react/index.js`)).toBe('react');
    expect(manualChunk(`${NM}/react-dom/cjs/react-dom.production.min.js`)).toBe('react');
    expect(manualChunk(`${NM}/scheduler/index.js`)).toBe('react');
  });

  it('слой API — в свой кусок', () => {
    expect(manualChunk(`${SRC}/shared/services/pb/tasks.js`)).toBe('api');
    expect(manualChunk(`${SRC}/shared/services/pocketbase.js`)).toBe('api');
    expect(manualChunk('C:\\app\\ege-tasks\\src\\shared\\services\\pb\\client.js')).toBe('api');
  });

  it('библиотеки интерфейса и остальной код — как решит Rollup', () => {
    for (const id of [
      `${NM}/antd/es/button/index.js`,
      `${NM}/rc-field-form/es/index.js`,
      `${NM}/react-markdown/index.js`,
      `${NM}/react-router-dom/dist/index.js`,
      `${NM}/react-is/index.js`,
      `${NM}/katex/dist/katex.mjs`,
      `${NM}/pocketbase/dist/pocketbase.es.mjs`,
      `${SRC}/components/student/StudentHome.jsx`,
      `${SRC}/utils/homework.js`,
      `${SRC}/shared/utils/mapLimit.js`,
    ]) {
      expect(manualChunk(id), id).toBeUndefined();
    }
  });
});

describe('CHUNK_OUTPUT', () => {
  it('имена экспортов между кусками — настоящие (иначе хеши плавают)', () => {
    expect(CHUNK_OUTPUT.minifyInternalExports).toBe(false);
    expect(CHUNK_OUTPUT.manualChunks).toBe(manualChunk);
  });
});

