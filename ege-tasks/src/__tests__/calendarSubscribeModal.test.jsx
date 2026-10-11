import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { App as AntApp } from 'antd';

// Окно «Календарь на телефоне» (v3.9.352): ссылка на ленту .ics, QR для
// iPhone, смена ссылки.

const mockApi = vi.hoisted(() => ({
  getCalendarFeedToken: vi.fn(),
  resetCalendarFeedToken: vi.fn(),
}));
vi.mock('../shared/services/pocketbase', () => ({ api: mockApi, default: {} }));

// eslint-disable-next-line import/first
import CalendarSubscribeModal from '../components/workspace/calendar/CalendarSubscribeModal';

const TOKEN = 'a'.repeat(40);
const NEW_TOKEN = 'b'.repeat(40);

const renderModal = () => render(
  <AntApp><CalendarSubscribeModal open onClose={() => {}} /></AntApp>,
);

describe('CalendarSubscribeModal', () => {
  beforeEach(() => {
    mockApi.getCalendarFeedToken.mockReset();
    mockApi.resetCalendarFeedToken.mockReset();
  });
  afterEach(cleanup);

  it('показывает ссылку на ленту и QR для iPhone', async () => {
    mockApi.getCalendarFeedToken.mockResolvedValue(TOKEN);
    renderModal();
    expect(await screen.findByText(new RegExp(`/api/calendar/feed/${TOKEN}\\.ics`))).toBeTruthy();
    expect(document.querySelector('svg')).toBeTruthy();
    expect(mockApi.getCalendarFeedToken).toHaveBeenCalledTimes(1);
  });

  it('смена ссылки подменяет токен', async () => {
    mockApi.getCalendarFeedToken.mockResolvedValue(TOKEN);
    mockApi.resetCalendarFeedToken.mockResolvedValue(NEW_TOKEN);
    renderModal();
    await screen.findByText(new RegExp(TOKEN));
    fireEvent.click(screen.getByRole('button', { name: /Сменить/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Сменить' }));
    await waitFor(() => expect(screen.getByText(new RegExp(NEW_TOKEN))).toBeTruthy());
    expect(mockApi.resetCalendarFeedToken).toHaveBeenCalledTimes(1);
  });

  it('нет ссылки — понятная ошибка и «Повторить»', async () => {
    mockApi.getCalendarFeedToken.mockResolvedValueOnce(null).mockResolvedValueOnce(TOKEN);
    renderModal();
    expect(await screen.findByText('Не удалось получить ссылку')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByText(new RegExp(TOKEN))).toBeTruthy();
  });
});
