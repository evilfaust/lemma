import { Alert } from 'antd';
import GeoGebraApplet from '../GeoGebraApplet';
import './TheoryGeoGebraEmbed.css';

export default function TheoryGeoGebraEmbed({
  blockId = '',
  fallbackApp = 'geometry',
  fallbackHeight = 520,
  fallbackCaption = '',
  applet = null,
}) {
  const resolved = applet || {};
  const appName = resolved.appName || fallbackApp || 'geometry';
  const height = Number(resolved.height || fallbackHeight) || 520;
  const caption = resolved.caption || fallbackCaption || '';
  const geogebraBase64 = resolved.geogebraBase64 || '';
  const previewImage = resolved.previewImage || '';

  if (!blockId) {
    return (
      <Alert
        className="theory-ggb-alert"
        type="warning"
        showIcon
        message="GeoGebra: у блока не указан id"
      />
    );
  }

  if (!geogebraBase64) {
    return (
      <Alert
        className="theory-ggb-alert"
        type="warning"
        showIcon
        message={`GeoGebra-блок "${blockId}" не настроен`}
        description="Откройте редактор статьи и сохраните состояние чертежа для этого блока."
      />
    );
  }

  return (
    <div className="theory-ggb-block">
      <div className="theory-ggb-live no-print">
        <GeoGebraApplet
          appName={appName}
          readOnly
          initialBase64={geogebraBase64}
          height={height}
        />
      </div>

      {previewImage && (
        <div className="theory-ggb-image print-friendly">
          <img src={previewImage} alt={caption || `GeoGebra ${blockId}`} />
        </div>
      )}

      {caption && (
        <div className="theory-ggb-caption">
          {caption}
        </div>
      )}
    </div>
  );
}
