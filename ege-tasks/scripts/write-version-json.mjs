import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(__dirname, '..')
const rootDir = resolve(appDir, '..')

const rootPkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf-8'))
const localPkg = JSON.parse(readFileSync(resolve(appDir, 'package.json'), 'utf-8'))
const appVersion = rootPkg.version || localPkg.version || '0.0.0'
const buildId = process.env.EGE_BUILD_ID || new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
const buildDate = new Date().toISOString()
const releaseId = `${appVersion}-${buildId}`

const distDir = resolve(appDir, 'dist')
mkdirSync(distDir, { recursive: true })

writeFileSync(
  resolve(distDir, 'version.json'),
  JSON.stringify({
    version: appVersion,
    buildId,
    buildDate,
    releaseId,
  }, null, 2),
)

console.log(`[version] dist/version.json updated: ${releaseId}`)
