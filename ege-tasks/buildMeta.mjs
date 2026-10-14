import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/*
 * Номер сборки — ОДИН на всю сборку (v3.9.375).
 *
 * Раньше его считали дважды: `vite.config.js` (при запуске сборки, уходил в
 * код как __BUILD_ID__) и отдельный `write-version-json.mjs` (после сборки,
 * ~20 секунд спустя, уходил в dist/version.json). Секунды расходились всегда,
 * и ученическое приложение при каждой проверке видело «другую сборку на
 * сервере» — плашка «Вышло обновление» висела почти при каждом заходе.
 * Теперь и код, и version.json берут значения отсюда, за один вызов.
 */

/** Версия из корневого package.json + номер сборки (время, ГГГГММДДччммсс). */
export function buildMeta({ appDir, env = process.env, now = new Date() }) {
  const read = (p) => JSON.parse(readFileSync(p, 'utf-8'))
  const rootPkg = read(resolve(appDir, '../package.json'))
  const localPkg = read(resolve(appDir, 'package.json'))
  const appVersion = rootPkg.version || localPkg.version || '0.0.0'
  const buildId = env.EGE_BUILD_ID || now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const buildDate = now.toISOString()
  return { appVersion, buildId, buildDate, releaseId: `${appVersion}-${buildId}` }
}

/** Константы для `define` — то, что зашито в код (`shared/version/buildInfo.js`). */
export function defineFromMeta(meta) {
  return {
    __APP_VERSION__: JSON.stringify(meta.appVersion),
    __BUILD_ID__: JSON.stringify(meta.buildId),
    __BUILD_DATE__: JSON.stringify(meta.buildDate),
  }
}

/** Содержимое dist/version.json — его спрашивает приложение и проверяют скрипты деплоя. */
export function versionJson(meta) {
  return JSON.stringify({
    version: meta.appVersion,
    buildId: meta.buildId,
    buildDate: meta.buildDate,
    releaseId: meta.releaseId,
  }, null, 2)
}

/** Плагин Vite: кладёт version.json в сборку с теми же значениями, что в коде. */
export function versionJsonPlugin(meta) {
  return {
    name: 'lemma-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: versionJson(meta) })
      console.log(`[version] version.json: ${meta.releaseId}`)
    },
  }
}
