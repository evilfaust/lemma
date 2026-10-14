import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { buildMeta, defineFromMeta, versionJsonPlugin } from './buildMeta.mjs'

// Номер сборки один на код и version.json — см. buildMeta.mjs.
const meta = buildMeta({ appDir: __dirname })

// Конфиг только для лендинга — лёгкая сборка без Monaco/antd/student/teacher
export default defineConfig({
  plugins: [react()],
  define: defineFromMeta(meta),
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'landing.html'),
        howItWorks: resolve(__dirname, 'how-it-works.html'),
      },
    },
  },
})
