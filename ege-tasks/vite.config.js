import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    open: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco-editor': ['monaco-editor', '@monaco-editor/react'],
          'markdown': ['unified', 'remark-parse', 'remark-math', 'remark-rehype', 'rehype-katex', 'rehype-stringify'],
          'antd': ['antd', '@ant-design/icons'],
        },
      },
    },
  },
})
