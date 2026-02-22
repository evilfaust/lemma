import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Spin, Typography } from 'antd';

const DEPLOY_SCRIPT_URL = 'https://www.geogebra.org/apps/deployggb.js';
const DEPLOY_SCRIPT_ID = 'geogebra-deployggb-script';

function loadGeoGebraScript() {
  return new Promise((resolve, reject) => {
    if (window.GGBApplet) {
      resolve();
      return;
    }

    const existing = document.getElementById(DEPLOY_SCRIPT_ID);
    if (existing && existing.getAttribute('data-loaded') === 'true') {
      resolve();
      return;
    }

    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = DEPLOY_SCRIPT_ID;
    script.src = DEPLOY_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      script.setAttribute('data-loaded', 'true');
      resolve();
    };
    script.onerror = () =>
      reject(
        new Error(
          'Не удалось загрузить GeoGebra (проверьте доступ к geogebra.org).',
        ),
      );
    document.body.appendChild(script);
  });
}

/**
 * Переиспользуемый GeoGebra-апплет.
 *
 * Props:
 *   appName       - 'geometry' | 'graphing' | 'classic' | '3d'  (default: 'geometry')
 *   readOnly      - bool  — скрывает toolbar/menu/правый клик     (default: false)
 *   initialBase64 - string — загружает состояние при монтировании (default: '')
 *   onApiReady    - (api) => void — callback с GGBApplet API      (default: null)
 *   height        - number — высота апплета в px                  (default: 520)
 *   width         - number — ширина в px, 0 = 100%               (default: 0)
 */
export default function GeoGebraApplet({
  appName = 'geometry',
  readOnly = false,
  initialBase64 = '',
  onApiReady = null,
  height = 520,
  width = 0,
}) {
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const containerRef = useRef(null);
  const apiRef = useRef(null);

  // Уникальный ID контейнера на весь жизненный цикл компонента
  const containerId = useMemo(
    () => `ggb-applet-${Math.random().toString(36).slice(2)}`,
    [],
  );

  useEffect(() => {
    let disposed = false;

    const mountApplet = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw new Error('Нет подключения к интернету.');
        }

        setStatus('loading');
        setError('');

        await loadGeoGebraScript();
        if (disposed || !containerRef.current || !window.GGBApplet) return;

        // Очищаем предыдущий апплет если был (при смене appName/readOnly)
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        const params = {
          appName,
          width: width || containerRef.current?.offsetWidth || 980,
          height,
          showToolBar: !readOnly,
          showMenuBar: !readOnly,
          showAlgebraInput: !readOnly,
          enableLabelDrags: !readOnly,
          enableShiftDragZoom: true,
          enableRightClick: !readOnly,
          appletOnLoad: (ggbApi) => {
            if (disposed) return;
            apiRef.current = ggbApi;
            setStatus('ready');

            // Загружаем начальное состояние если есть
            if (initialBase64) {
              ggbApi.setBase64(initialBase64);
            }

            if (onApiReady) onApiReady(ggbApi);
          },
        };

        const applet = new window.GGBApplet(params, true);
        applet.inject(containerId);
      } catch (err) {
        if (!disposed) {
          setError(err.message || 'Ошибка инициализации GeoGebra.');
          setStatus('error');
        }
      }
    };

    mountApplet();
    return () => {
      disposed = true;
      apiRef.current = null;
    };
  }, [containerId, reloadToken, appName, readOnly]); // eslint-disable-line react-hooks/exhaustive-deps
  // Примечание: initialBase64 и onApiReady намеренно не в deps —
  // они читаются только при монтировании апплета.

  return (
    <div style={{ width: '100%' }}>
      {status === 'loading' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 0',
            color: '#888',
          }}
        >
          <Spin size="small" />
          <Typography.Text type="secondary">Загрузка GeoGebra...</Typography.Text>
        </div>
      )}

      {status === 'error' && (
        <Alert
          type="error"
          showIcon
          message="Ошибка загрузки GeoGebra"
          description={error}
          style={{ marginBottom: 8 }}
          action={
            <Button size="small" onClick={() => setReloadToken((t) => t + 1)}>
              Повторить
            </Button>
          }
        />
      )}

      <div
        id={containerId}
        ref={containerRef}
        style={{
          width: '100%',
          minHeight: height,
          border: status === 'ready' ? '1px solid #f0f0f0' : 'none',
          borderRadius: 8,
          overflow: 'hidden',
          display: status === 'error' ? 'none' : 'block',
        }}
      />
    </div>
  );
}
