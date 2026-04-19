import { useState, useRef, useCallback } from 'react';
import { Button, Space, message, Tooltip } from 'antd';
import { DownloadOutlined, ClearOutlined, BookOutlined } from '@ant-design/icons';
import { Excalidraw, exportToBlob, exportToSvg } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';

const STORAGE_KEY = 'excalidraw-section-data';
const LIB_STORAGE_KEY = 'excalidraw-section-library';
const MATH_LIB_URL = 'https://libraries.excalidraw.com/libraries/https-github-com-ytrkptl/math-teacher-library.excalidrawlib';

const SAFE_APPSTATE_KEYS = ['viewBackgroundColor', 'theme', 'gridSize', 'zoom', 'scrollX', 'scrollY'];

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { elements, appState, files } = JSON.parse(raw);
    // collaborators is a Map in Excalidraw — plain object from JSON breaks it
    const safeAppState = {};
    for (const key of SAFE_APPSTATE_KEYS) {
      if (appState?.[key] !== undefined) safeAppState[key] = appState[key];
    }
    return { elements: elements ?? [], appState: safeAppState, files: files ?? {} };
  } catch {
    return null;
  }
}

function loadSavedLibrary() {
  try {
    const raw = localStorage.getItem(LIB_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function ExcalidrawSection() {
  const excalidrawApiRef = useRef(null);
  const [libLoading, setLibLoading] = useState(false);

  const [initialData] = useState(() => {
    const saved = loadSaved();
    const libraryItems = loadSavedLibrary();
    return {
      ...(saved ?? { elements: [], appState: { viewBackgroundColor: '#ffffff' } }),
      libraryItems,
    };
  });

  const handleChange = useCallback((elements, appState, files) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ elements, appState, files }));
    } catch {
      // quota exceeded — ignore
    }
  }, []);

  const handleLibraryChange = useCallback((libraryItems) => {
    try {
      localStorage.setItem(LIB_STORAGE_KEY, JSON.stringify(libraryItems));
    } catch {
      // quota exceeded — ignore
    }
  }, []);

  const handleLoadMathLib = async () => {
    const api = excalidrawApiRef.current;
    if (!api) return;
    setLibLoading(true);
    try {
      const res = await fetch(MATH_LIB_URL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = data.libraryItems ?? data.library ?? [];
      if (!items.length) throw new Error('Библиотека пустая');

      await api.updateLibrary({
        libraryItems: items,
        merge: true,
        openLibraryMenu: true,
      });
      message.success(`Загружено ${items.length} математических элементов`);
    } catch (e) {
      message.error('Не удалось загрузить библиотеку: ' + e.message);
    } finally {
      setLibLoading(false);
    }
  };

  const handleExportPng = async () => {
    const api = excalidrawApiRef.current;
    if (!api) return;
    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const files = api.getFiles();
    if (!elements.length) { message.warning('Холст пустой'); return; }
    try {
      const blob = await exportToBlob({ elements, appState, files, mimeType: 'image/png', getDimensions: () => ({ width: 1200, height: 900, scale: 2 }) });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'excalidraw.png';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      message.error('Ошибка экспорта: ' + e.message);
    }
  };

  const handleExportSvg = async () => {
    const api = excalidrawApiRef.current;
    if (!api) return;
    const elements = api.getSceneElements();
    const appState = api.getAppState();
    const files = api.getFiles();
    if (!elements.length) { message.warning('Холст пустой'); return; }
    try {
      const svg = await exportToSvg({ elements, appState, files });
      const serialized = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([serialized], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'excalidraw.svg';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      message.error('Ошибка экспорта: ' + e.message);
    }
  };

  const handleClear = () => {
    excalidrawApiRef.current?.updateScene({ elements: [] });
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 600, fontSize: 16 }}>Доска Excalidraw</span>
        <Space>
          <Tooltip title="Загрузить математическую библиотеку символов">
            <Button icon={<BookOutlined />} onClick={handleLoadMathLib} loading={libLoading}>
              Математика
            </Button>
          </Tooltip>
          <Button icon={<DownloadOutlined />} onClick={handleExportPng}>PNG</Button>
          <Button icon={<DownloadOutlined />} onClick={handleExportSvg}>SVG</Button>
          <Button icon={<ClearOutlined />} danger onClick={handleClear}>Очистить</Button>
        </Space>
      </div>

      <div style={{ flex: 1, border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden', minHeight: 0 }}>
        <Excalidraw
          excalidrawAPI={(api) => { excalidrawApiRef.current = api; }}
          initialData={initialData}
          onChange={handleChange}
          onLibraryChange={handleLibraryChange}
          langCode="ru-RU"
        />
      </div>
    </div>
  );
}
