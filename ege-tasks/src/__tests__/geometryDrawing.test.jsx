import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';
import { stereoDrawingSvg, parseStereoBlock } from '../utils/stereo';

const mockApi = vi.hoisted(() => ({
  getGeometryTopics: vi.fn(() => Promise.resolve([])),
  getGeometrySubtopics: vi.fn(() => Promise.resolve([])),
  getNextGeometryCode: vi.fn(() => Promise.resolve('GEO-300')),
  getGeometryTags: vi.fn(() => Promise.resolve({ object: [], method: [], fact: [] })),
  getGeometryImageUrl: vi.fn((t) => (t?.geogebra_image_base64 ? `https://pb/${t.geogebra_image_base64}` : '')),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));
vi.mock('../components/GeoGebraApplet', () => ({ default: () => <div data-testid="ggb" /> }));

// eslint-disable-next-line import/first
import GeometryTaskEditor from '../components/GeometryTaskEditor';
// eslint-disable-next-line import/first
import { GeometryPreviewCard, normalizeLayout } from '../components/GeometryTaskPreview';

const { scene, camera } = parseStereoBlock('куб 4\nM на AA1 1:2');
const STEREO_SVG = stereoDrawingSvg(scene, camera);

const mount = (task) => render(
  <AntApp><GeometryTaskEditor task={task} onSaved={vi.fn()} onCancel={vi.fn()} /></AntApp>,
);
const openDrawingTab = () => fireEvent.click(screen.getByRole('tab', { name: /Чертёж/ }));

describe('печать карточками: чертёж-текст', () => {
  it('SVG-чертёж (стерео) рисуется в слое чертежа, а не пропадает', () => {
    const { container } = render(
      <div className="geometry-preview-grid is-print">
        <GeometryPreviewCard
          task={{ id: 't', code: 'SEC-1', statement_md: 'Постройте сечение', drawing_view: 'svg', drawing_svg: STEREO_SVG }}
          index={0}
          mode="print"
          drawingMode="task"
          layout={normalizeLayout(null, 'print')}
        />
      </div>,
    );
    expect(container.querySelector('.geometry-preview-layer-image .geometry-preview-svg svg')).toBeTruthy();
    expect(container.querySelector('.geometry-preview-layer-image img')).toBeNull();
  });
});

describe('вкладка «Чертёж»: наш редактор — основной путь', () => {
  it('новая задача: «Наш редактор», GeoGebra не грузится, пока её не выбрали', async () => {
    mount(null);
    openDrawingTab();
    expect(screen.getByText('Стереометрия')).toBeTruthy();
    expect(screen.getAllByText('Планиметрия').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('ggb')).toBeNull();
    fireEvent.click(screen.getByText('GeoGebra'));
    expect(await screen.findByTestId('ggb')).toBeTruthy();
    fireEvent.click(screen.getByText('Наш редактор'));
    expect(screen.getByTestId('ggb')).toBeTruthy(); // апплет остаётся в фоне — построение не теряется
  });

  it('задача со стереочертежом открывается в «Нашем редакторе» с правкой чертежа', async () => {
    mount({ id: 'x', code: 'GEO-010', drawing_view: 'svg', drawing_svg: STEREO_SVG });
    openDrawingTab();
    expect(screen.getByText('Стереочертёж ✎ — править')).toBeTruthy();
    expect(screen.queryByTestId('ggb')).toBeNull();
  });

  it('задача только с картинкой (как в банке МЦНМО) — режим «Картинка»', async () => {
    mount({ id: 'y', code: 'MCCME-1', drawing_view: 'image', geogebra_image_base64: 'pic.png' });
    openDrawingTab();
    expect(screen.getByText('Загрузить файл')).toBeTruthy();
    await waitFor(() => expect(screen.getByAltText('Чертёж')).toBeTruthy());
    expect(screen.queryByTestId('ggb')).toBeNull();
  });

  it('задача из GeoGebra — сразу режим GeoGebra', () => {
    mount({ id: 'z', code: 'GEO-011', drawing_view: 'image', geogebra_base64: 'UEsDBA==' });
    openDrawingTab();
    expect(screen.getByTestId('ggb')).toBeTruthy();
    expect(screen.getByText('→ SVG')).toBeTruthy();
  });
});
