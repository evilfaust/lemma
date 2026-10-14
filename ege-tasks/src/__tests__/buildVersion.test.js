// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { buildMeta, defineFromMeta, versionJson, versionJsonPlugin } from '../../scripts/buildMeta.mjs';
import { isNewRelease } from '../student/pwa/appUpdate';

const appDir = resolve(__dirname, '../..');

// v3.9.375: плашка «Вышло обновление» висела почти при каждом заходе — номер
// сборки в коде и в version.json считался в разные моменты и расходился.
describe('номер сборки один на код и version.json', () => {
  const meta = buildMeta({ appDir, env: {}, now: new Date('2026-10-14T18:14:49.801Z') });

  it('define и version.json несут одну и ту же сборку', () => {
    const def = defineFromMeta(meta);
    const json = JSON.parse(versionJson(meta));
    const codeRelease = `${JSON.parse(def.__APP_VERSION__)}-${JSON.parse(def.__BUILD_ID__)}`;
    expect(json.releaseId).toBe(codeRelease);
    expect(json.buildId).toBe('20261014181449');
    // То, что приложение увидит у себя и на сервере, — «та же сборка».
    expect(isNewRelease(json, codeRelease)).toBe(false);
  });

  it('плагин кладёт version.json в сборку теми же значениями', () => {
    const emitted = [];
    versionJsonPlugin(meta).generateBundle.call({ emitFile: (f) => emitted.push(f) });
    expect(emitted).toHaveLength(1);
    expect(emitted[0].fileName).toBe('version.json');
    expect(JSON.parse(emitted[0].source).releaseId).toBe(meta.releaseId);
  });

  it('EGE_BUILD_ID из окружения — в оба места', () => {
    const m = buildMeta({ appDir, env: { EGE_BUILD_ID: 'ci-42' } });
    expect(m.buildId).toBe('ci-42');
    expect(JSON.parse(versionJson(m)).releaseId).toBe(m.releaseId);
  });

  it('оба конфига Vite берут номер из buildMeta, а отдельного скрипта нет', () => {
    for (const f of ['vite.config.js', 'vite.config.landing.js']) {
      const src = readFileSync(resolve(appDir, f), 'utf8');
      expect(src, f).toMatch(/defineFromMeta\(meta\)/);
      expect(src, f).not.toMatch(/new Date\(\)\.toISOString/);
    }
    expect(readFileSync(resolve(appDir, 'vite.config.js'), 'utf8')).toMatch(/versionJsonPlugin\(meta\)/);
    const pkg = JSON.parse(readFileSync(resolve(appDir, 'package.json'), 'utf8'));
    expect(pkg.scripts.build).not.toMatch(/write-version-json/);
  });
});

describe('isNewRelease — только сборка новее', () => {
  const cur = '3.9.374-20261014181449';
  it('новее — да, та же / старше — нет', () => {
    expect(isNewRelease({ releaseId: '3.9.375-20261015090000' }, cur)).toBe(true);
    expect(isNewRelease({ releaseId: cur }, cur)).toBe(false);
    // старый version.json (кэш по дороге, откат деплоя) — не «обновление»
    expect(isNewRelease({ releaseId: '3.9.374-20261014180501' }, cur)).toBe(false);
  });
  it('нестандартный номер — по-старому «другой»', () => {
    expect(isNewRelease({ releaseId: '3.9.375-ci-43' }, '3.9.374-ci-42')).toBe(true);
  });
});
