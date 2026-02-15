import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Divider, Input, Space, Typography } from 'antd';

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

    if (existing) {
      existing.remove();
    }

    const script = document.createElement('script');
    script.id = DEPLOY_SCRIPT_ID;
    script.src = DEPLOY_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      script.setAttribute('data-loaded', 'true');
      resolve();
    };
    script.onerror = () => reject(new Error('Не удалось загрузить GeoGebra script (возможна блокировка сети, VPN, proxy или adblock).'));
    document.body.appendChild(script);
  });
}

export default function GeoGebraLab() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [api, setApi] = useState(null);
  const [command, setCommand] = useState('f(x)=x^2');
  const [savedBase64, setSavedBase64] = useState('');
  const [hasSavedState, setHasSavedState] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const containerRef = useRef(null);

  const containerId = useMemo(
    () => `ggb-applet-${Math.random().toString(36).slice(2)}`,
    [],
  );

  useEffect(() => {
    let disposed = false;

    const mountApplet = async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw new Error('Нет подключения к интернету: GeoGebra script недоступен.');
        }

        setStatus('loading');
        setError('');

        await loadGeoGebraScript();
        if (disposed || !containerRef.current || !window.GGBApplet) return;

        const params = {
          appName: 'classic',
          width: 980,
          height: 560,
          showToolBar: true,
          showMenuBar: true,
          showAlgebraInput: true,
          enableLabelDrags: true,
          enableShiftDragZoom: true,
          enableRightClick: true,
          appletOnLoad: (ggbApi) => {
            if (!disposed) {
              setApi(ggbApi);
              setStatus('ready');
            }
          },
        };

        const applet = new window.GGBApplet(params, true);
        applet.inject(containerId);
      } catch (err) {
        if (!disposed) {
          setError(err.message || 'Ошибка инициализации GeoGebra. Проверьте доступ к geogebra.org.');
          setStatus('error');
        }
      }
    };

    mountApplet();
    return () => {
      disposed = true;
      setApi(null);
    };
  }, [containerId, reloadToken]);

  const runCommand = () => {
    if (!api || !command.trim()) return;
    api.evalCommand(command.trim());
  };

  const clearConstruction = () => {
    if (!api) return;
    api.reset();
  };

  const saveState = () => {
    if (!api) return;
    api.getBase64((base64) => {
      setSavedBase64(base64);
      setHasSavedState(Boolean(base64));
    });
  };

  const restoreState = () => {
    if (!api || !savedBase64) return;
    api.setBase64(savedBase64);
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="Раздел для проверки интеграции GeoGebra Apps API"
        description="Для коммерческого использования GeoGebra требуется отдельная лицензия."
      />

      <Card>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text strong>Команда GeoGebra</Typography.Text>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Например: f(x)=x^2"
              onPressEnter={runCommand}
            />
            <Button type="primary" onClick={runCommand} disabled={!api}>
              Выполнить
            </Button>
          </Space.Compact>

          <Space>
            <Button onClick={clearConstruction} disabled={!api}>Сбросить</Button>
            <Button onClick={saveState} disabled={!api}>Сохранить состояние</Button>
            <Button onClick={restoreState} disabled={!api || !hasSavedState}>Восстановить</Button>
          </Space>

          <Divider style={{ margin: '4px 0' }} />

          {status === 'loading' && <Typography.Text type="secondary">Загрузка GeoGebra...</Typography.Text>}
          {status === 'error' && <Typography.Text type="danger">{error}</Typography.Text>}
          {status === 'ready' && <Typography.Text type="success">GeoGebra API подключено</Typography.Text>}
        </Space>
      </Card>

      <Card styles={{ body: { padding: 12 } }}>
        <div
          id={containerId}
          ref={containerRef}
          style={{
            width: '100%',
            minHeight: 560,
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            overflow: 'hidden',
          }}
        />
      </Card>

      {status === 'error' && (
        <Button onClick={() => setReloadToken((prev) => prev + 1)}>
          Повторить загрузку GeoGebra
        </Button>
      )}
    </Space>
  );
}
