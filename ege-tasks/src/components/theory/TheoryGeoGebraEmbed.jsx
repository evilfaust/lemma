import { Alert } from 'antd';
import './TheoryGeoGebraEmbed.css';

export default function TheoryGeoGebraEmbed({ blockId = '', applet = null }) {
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

  if (!applet?.previewImage) {
    return (
      <Alert
        className="theory-ggb-alert"
        type="warning"
        showIcon
        message={`GeoGebra-блок "${blockId}" не настроен`}
        description="Откройте редактор статьи, нарисуйте чертёж и сохраните PNG."
      />
    );
  }

  const { caption = '' } = applet;

  return (
    <div className="theory-ggb-block">
      <img
        className="theory-ggb-image"
        src={applet.previewImage}
        alt={caption || `GeoGebra ${blockId}`}
      />
      {caption && <div className="theory-ggb-caption">{caption}</div>}
    </div>
  );
}
