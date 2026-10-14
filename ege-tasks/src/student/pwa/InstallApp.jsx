import { useState, useSyncExternalStore } from 'react';
import { Modal } from 'antd';
import { MobileOutlined, CloseOutlined } from '@ant-design/icons';
import {
  subscribeInstall, currentInstallPlatform, promptInstall, isInAppBrowser, isStandalone,
} from './install';
import './pwa.css';

/*
 * «Установить приложение» (v3.9.369): карточка на главной ученика, пункт меню
 * профиля и окно с инструкцией. Android с системным диалогом — сразу диалог,
 * iPhone и прочие браузеры — инструкция по шагам.
 */

const DISMISS_KEY = 'lemma.pwa.installDismissed';

const readDismissed = () => {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
};

/** Какой способ установки доступен сейчас; перерисовывается, когда Android пришлёт событие. */
export function useInstallPlatform() {
  return useSyncExternalStore(subscribeInstall, currentInstallPlatform, () => null);
}

/** Запуск установки: системный диалог или окно с инструкцией. */
export function useInstallAction() {
  const platform = useInstallPlatform();
  const [guide, setGuide] = useState(null);
  const start = async () => {
    if (platform === 'prompt') {
      const outcome = await promptInstall();
      if (outcome) return;
    }
    setGuide(platform === 'prompt' ? 'android' : platform);
  };
  const modal = <InstallGuideModal platform={guide} onClose={() => setGuide(null)} />;
  return { platform, start, modal };
}

function Step({ n, children }) {
  return (
    <li className="pwa-guide-step">
      <span className="pwa-guide-num">{n}</span>
      <span>{children}</span>
    </li>
  );
}

const ShareIcon = () => (
  <svg className="pwa-guide-share" viewBox="0 0 24 24" aria-label="Поделиться" role="img">
    <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export function InstallGuideModal({ platform, onClose }) {
  const inApp = typeof navigator !== 'undefined' && isInAppBrowser(navigator.userAgent || '');
  return (
    <Modal
      open={!!platform}
      onCancel={onClose}
      footer={null}
      centered
      width={420}
      title="Lemma на телефоне"
      className="pwa-guide"
    >
      {inApp && (
        <p className="pwa-guide-warn">
          Ссылка открыта внутри Telegram или VK — оттуда приложение не установить.
          Нажмите «⋯» и выберите «Открыть в браузере».
        </p>
      )}
      {platform === 'ios' && (
        <>
          <ol className="pwa-guide-steps">
            <Step n={1}>Нажмите <b>«Поделиться»</b> <ShareIcon /> — в Safari кнопка внизу экрана, в Chrome — справа от адреса.</Step>
            <Step n={2}>Пролистайте вниз и выберите <b>«На экран „Домой“»</b>.</Step>
            <Step n={3}>Нажмите <b>«Добавить»</b> — на экране появится значок Lemma.</Step>
          </ol>
          <p className="pwa-guide-note">
            Открывайте Lemma значком: она запустится как обычное приложение.
            В первый раз войдите ещё раз — вход в приложении отдельный от Safari.
          </p>
        </>
      )}
      {platform === 'android' && (
        <>
          <ol className="pwa-guide-steps">
            <Step n={1}>Откройте меню браузера — <b>⋮</b> или <b>≡</b> (обычно справа вверху или внизу).</Step>
            <Step n={2}>Выберите <b>«Установить приложение»</b> или <b>«Добавить на главный экран»</b>.</Step>
            <Step n={3}>Подтвердите — на экране появится значок Lemma.</Step>
          </ol>
          <p className="pwa-guide-note">Открывайте Lemma значком: она запустится как обычное приложение.</p>
        </>
      )}
    </Modal>
  );
}

/** Карточка на главной: видна на телефоне, пока приложение не установлено и не закрыта крестиком. */
export function InstallAppCard({ className = '' }) {
  const { platform, start, modal } = useInstallAction();
  const [dismissed, setDismissed] = useState(readDismissed);
  if (!platform || dismissed || isStandalone()) return modal;
  const close = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* приватный режим */ }
    setDismissed(true);
  };
  return (
    <>
      <div className={`pwa-install ${className}`}>
        <img className="pwa-install-icon" src="/pwa/icon-192.png" alt="" />
        <div className="pwa-install-text">
          <div className="pwa-install-title">Lemma на телефоне</div>
          <div className="pwa-install-sub">Значок на экране — открывается как приложение</div>
        </div>
        <button type="button" className="pwa-install-btn" onClick={start}>
          <MobileOutlined /> Установить
        </button>
        <button type="button" className="pwa-install-close" onClick={close} aria-label="Скрыть" title="Скрыть">
          <CloseOutlined />
        </button>
      </div>
      {modal}
    </>
  );
}

/**
 * «← Кабинет» в шапке отдельных страниц (эфир, пособие, работа, статья). Только
 * в установленном приложении: там нет кнопки «назад» браузера, и со страницы
 * по ссылке иначе не уйти. В обычном браузере не рисуется.
 */
export function CabinetLink({ className = '' }) {
  if (!isStandalone()) return null;
  return (
    <a className={`pwa-cabinet-link ${className}`} href="/student/">
      <span aria-hidden>‹</span> Кабинет
    </a>
  );
}
