import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'))
const localPkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const appVersion = rootPkg.version || localPkg.version || '0.0.0'
const buildId = process.env.EGE_BUILD_ID || new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
const buildDate = new Date().toISOString()

// Конфиг только для лендинга — лёгкая сборка без Monaco/antd/student/teacher
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_ID__: JSON.stringify(buildId),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'landing.html'),
      },
    },
  },
})
