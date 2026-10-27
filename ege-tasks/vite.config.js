import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { buildMeta, defineFromMeta, versionJsonPlugin } from './buildMeta.mjs'
import { CHUNK_OUTPUT } from './chunkSplit.mjs'

// Номер сборки один на код и version.json — см. buildMeta.mjs.
const meta = buildMeta({ appDir: __dirname })

// https://vitejs.dev/config/
// Dev-only: SPA fallback rewrites
// /student/* → student.html (отдельный SPA entry)
// /app/*     → index.html  (учительский SPA, BrowserRouter)
const spaRewritePlugin = {
  name: 'spa-rewrite',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url && req.url.startsWith('/student/')) {
        req.url = '/student.html';
      } else if (req.url && req.url.startsWith('/app')) {
        req.url = '/index.html';
      }
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), spaRewritePlugin, versionJsonPlugin(meta)],
  define: defineFromMeta(meta),
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  // Пре-бандлим CodeMirror на старте дев-сервера, иначе при ПЕРВОЙ ленивой
  // загрузке расширенного редактора Vite обнаруживает новую зависимость и делает
  // разовый full-reload страницы (теряя несохранённое состояние). В проде неактуально.
  optimizeDeps: {
    include: [
      '@uiw/react-codemirror',
      '@codemirror/lang-markdown',
      '@codemirror/lint',
      '@codemirror/view',
      '@codemirror/state',
    ],
  },
  server: {
    port: 5173,
    host: true,
    open: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        student: resolve(__dirname, 'student.html'),
        landing: resolve(__dirname, 'landing.html'),
        howItWorks: resolve(__dirname, 'how-it-works.html'),
      },
      // Библиотеки (antd, markdown…) в ручные куски НЕ выносим (v3.9.374):
      // общий кусок 'antd' собирал всё, чем пользуется учительский интерфейс,
      // и ученик качал 480 КБ (сжатых) ради пары кнопок, а 'markdown'
      // прихватывал общие зависимости — его тянуло даже ядро. Rollup сам делит
      // общий код между приложениями: старт ученика 857 → ~350 КБ, учителя
      // 581 → ~384 КБ.
      //
      // Два узких куска — ради кэша между деплоями (v3.9.413). Слой API
      // (src/shared/services) Rollup клал в один кусок с antd; наш код
      // меняется почти в каждом релизе, хеш куска — вместе с ним, а за ним и
      // хеши всех кусков, что его импортируют: после любого деплоя ученик
      // заново качал ~280 из 333 КБ, учитель ~330 из 378. Теперь:
      // 'api' — только наш слой API (+ SDK PocketBase, который тянет он сам),
      // 'react' — react/react-dom/scheduler, иначе 'api' забрал бы их к себе
      // зависимостями и каждый релиз снова сбрасывал бы всё. Старт не растёт
      // (оба куска и так грузились на старте), после правки API — ~84 КБ
      // ученику и ~134 учителю. Имена экспортов между кусками — настоящие
      // (minifyInternalExports: false), иначе из одного кода выходили разные
      // хеши. Правило — chunkSplit.mjs, сторож — __tests__/buildChunks.test.js.
      output: CHUNK_OUTPUT,
    },
  },
})
