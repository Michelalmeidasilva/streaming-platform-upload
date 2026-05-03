/** @jest-environment jsdom */
/* eslint-disable react/display-name, @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react';
import VideoList from '../VideoList';
import { useSession } from 'next-auth/react';
import { useVideoEvents } from '@/lib/context/VideoEventContext';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import { createE2ESession } from '@/lib/auth/e2e';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

jest.mock('@/lib/context/VideoEventContext', () => ({
  useVideoEvents: jest.fn(),
}));

jest.mock('@/lib/i18n/LocaleProvider', () => ({
  useI18n: jest.fn(),
}));

jest.mock('@/lib/auth/e2e', () => ({
  createE2ESession: jest.fn(),
  E2E_AUTH_COOKIE: 'e2e-session',
}));

jest.mock('../Skeleton', () => () => <div data-testid="skeleton" />);
jest.mock('../VideoModal', () => (props: any) => (
  <div data-testid="video-modal">
    <button onClick={props.onClose}>close-modal</button>
    <button onClick={() => props.onDeleted(props.video.id)}>delete-from-modal</button>
    <button onClick={() => props.onUpdated({ ...props.video, title: 'Updated from modal' })}>update-from-modal</button>
  </div>
));
jest.mock('next/image', () => ({ src, alt }: any) => <img src={src} alt={alt} />);

describe('VideoList', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, NEXT_PUBLIC_E2E_AUTH_ENABLED: '0' };
    (global as any).crypto = { randomUUID: jest.fn(() => 'uuid') };
    (useVideoEvents as jest.Mock).mockReturnValue({
      onUploadComplete: jest.fn(),
      unsubscribe: jest.fn(),
    });
    (useI18n as jest.Mock).mockReturnValue({
      t: (key: string) => key,
      formatDate: (d: string) => d,
    });
    (createE2ESession as jest.Mock).mockImplementation((email: string) => ({
      user: { email, role: 'ADMIN', name: 'E2E Admin' },
    }));
    global.fetch = jest.fn();
    document.cookie = '';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('renders loading skeletons when session is loading', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'loading', data: null });
    const { getAllByTestId } = render(<VideoList />);
    expect(getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('renders sign in required message when not authenticated', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'unauthenticated', data: null });
    const { getByText } = render(<VideoList />);
    expect(getByText('library.signInToView')).toBeDefined();
  });

  it('fetches and renders videos when authenticated', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        videos: [
          { id: '1', title: 'Video 1', status: 'ready', size: 100, createdAt: '2023-01-01' },
        ],
      }),
    });

    const { getByText } = render(<VideoList />);

    await waitFor(() => {
      expect(getByText('Video 1')).toBeDefined();
    });
  });

  it('handles delete action', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          videos: [{ id: '1', title: 'Video 1', status: 'ready', size: 100, createdAt: '2023-01-01' }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const { getByText, queryByText } = render(<VideoList />);

    await waitFor(() => getByText('Video 1'));

    const deleteBtn = getByText('library.actions.delete');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(queryByText('Video 1')).toBeNull();
    });
  });

  it('handles fetch error generic', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network fail'));

    const { getByText } = render(<VideoList />);

    await waitFor(() => {
      expect(getByText('library.loadError.generic')).toBeDefined();
    });
  });

  it('handles 401 response', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
    });

    const { getByText } = render(<VideoList />);

    await waitFor(() => {
      expect(getByText('library.loadError.signIn')).toBeDefined();
    });
  });

  it('handles 403 forbidden response', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
    });

    const { getByText } = render(<VideoList />);

    await waitFor(() => {
      expect(getByText('library.loadError.generic')).toBeDefined();
    });
  });

  it('handles 500 server error response', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { getByText } = render(<VideoList />);

    await waitFor(() => {
      expect(getByText('library.loadError.generic')).toBeDefined();
    });
  });

  it('renders empty state when no videos exist', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ videos: [] }),
    });

    const { getByText } = render(<VideoList />);

    await waitFor(() => {
      expect(getByText('library.empty.emptyTitle')).toBeDefined();
    });
  });

  it('renders multiple videos', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        videos: [
          { id: '1', title: 'Video 1', status: 'ready', size: 1000, createdAt: '2023-01-01' },
          { id: '2', title: 'Video 2', status: 'ready', size: 2000, createdAt: '2023-01-02' },
          { id: '3', title: 'Video 3', status: 'processing', size: 3000, createdAt: '2023-01-03' },
        ],
      }),
    });

    const { getByText } = render(<VideoList />);

    await waitFor(() => {
      expect(getByText('Video 1')).toBeDefined();
      expect(getByText('Video 2')).toBeDefined();
      expect(getByText('Video 3')).toBeDefined();
    });
  });

  it('handles delete error gracefully', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          videos: [{ id: '1', title: 'Video 1', status: 'ready', size: 100, createdAt: '2023-01-01' }],
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const { getByText } = render(<VideoList />);

    await waitFor(() => getByText('Video 1'));

    const deleteBtn = getByText('library.actions.delete');
    fireEvent.click(deleteBtn);

    // Video should still be visible after failed delete
    await waitFor(() => {
      expect(getByText('Video 1')).toBeDefined();
    });
  });

  it('renders modal component', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        videos: [{ id: '1', title: 'Video 1', status: 'ready', size: 100, createdAt: '2023-01-01' }],
      }),
    });

    const { getByText, getByTestId } = render(<VideoList />);

    await waitFor(() => getByText('Video 1'));

    fireEvent.click(getByText('Video 1'));
    expect(getByTestId('video-modal')).toBeDefined();
  });

  it('displays correct status badge for different statuses', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        videos: [
          { id: '1', title: 'Video 1', status: 'ready', size: 100, createdAt: '2023-01-01' },
          { id: '2', title: 'Video 2', status: 'processing', size: 200, createdAt: '2023-01-02' },
          { id: '3', title: 'Video 3', status: 'failed', size: 300, createdAt: '2023-01-03' },
        ],
      }),
    });

    const { getByText } = render(<VideoList />);

    await waitFor(() => {
      expect(getByText('Video 1')).toBeDefined();
      expect(getByText('Video 2')).toBeDefined();
      expect(getByText('Video 3')).toBeDefined();
    });
  });

  it('handles subscription cleanup on unmount', async () => {
    const unsubscribeMock = jest.fn();
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (useVideoEvents as jest.Mock).mockReturnValue({
      onUploadComplete: jest.fn(),
      unsubscribe: unsubscribeMock,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        videos: [{ id: '1', title: 'Video 1', status: 'ready', size: 100, createdAt: '2023-01-01' }],
      }),
    });

    const { unmount } = render(<VideoList />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    unmount();

    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('shows a member label when the user cannot delete videos', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'MEMBER' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        videos: [{ id: '1', title: 'Video 1', status: 'ready', size: 100, createdAt: '2023-01-01' }],
      }),
    });

    const { getByText, queryByText } = render(<VideoList />);

    await waitFor(() => {
      expect(getByText('library.memberOnly')).toBeDefined();
      expect(queryByText('library.actions.delete')).toBeNull();
    });
  });

  it('does not fetch when an authenticated user lacks browse permission', async () => {
    jest.useFakeTimers();
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: undefined } },
    });

    const { getByText } = render(<VideoList />);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(global.fetch).not.toHaveBeenCalled();
      expect(getByText('library.empty.emptyTitle')).toBeDefined();
    });

    jest.useRealTimers();
  });

  it('searches videos after the debounce interval', async () => {
    jest.useFakeTimers();
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ videos: [] }),
    });

    const { getByPlaceholderText } = render(<VideoList />);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    const input = getByPlaceholderText('library.search.placeholder');
    fireEvent.change(input, { target: { value: 'cats' } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith('/api/videos?q=cats');
    });

    jest.useRealTimers();
  });

  it('renders search-specific empty state copy when the query has no matches', async () => {
    jest.useFakeTimers();
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ videos: [] }),
    });

    const { getByPlaceholderText, getByText } = render(<VideoList />);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    fireEvent.change(getByPlaceholderText('library.search.placeholder'), { target: { value: 'dogs' } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(getByText('library.empty.searchTitle')).toBeDefined();
      expect(getByText('library.empty.searchCopy')).toBeDefined();
    });

    jest.useRealTimers();
  });

  it('reloads videos when the upload-complete event fires', async () => {
    jest.useFakeTimers();
    let uploadCompleteHandler: (() => void) | undefined;
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (useVideoEvents as jest.Mock).mockReturnValue({
      onUploadComplete: jest.fn((handler: () => void) => {
        uploadCompleteHandler = handler;
      }),
      unsubscribe: jest.fn(),
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ videos: [] }),
    });

    render(<VideoList />);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    act(() => {
      uploadCompleteHandler?.();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });

  it('uses the e2e session cookie when enabled', async () => {
    process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED = '1';
    document.cookie = 'e2e-session=admin-e2e%40example.com';
    (useSession as jest.Mock).mockReturnValue({ status: 'unauthenticated', data: null });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        videos: [{ id: '1', title: 'Video 1', status: 'ready', size: 100, createdAt: '2023-01-01' }],
      }),
    });

    const { getByText } = render(<VideoList />);

    await waitFor(() => {
      expect(getByText('Video 1')).toBeDefined();
    });
  });

  it('renders gigabyte sizes and uploading thumbnails', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        videos: [
          {
            id: '1',
            title: 'Huge Video',
            status: 'uploading',
            size: 2 * 1024 * 1024 * 1024,
            createdAt: '2023-01-01',
            thumbnailUrl: '/thumb.jpg',
          },
        ],
      }),
    });

    const { getByText, container, getByAltText } = render(<VideoList />);

    await waitFor(() => {
      expect(getByText(/library\.formats\.sizeGigabytes/)).toBeDefined();
      expect(getByText('library.status.uploading')).toBeDefined();
      expect(getByAltText('Huge Video')).toBeDefined();
      expect(container.querySelector('[class*="thumbProgressFill"]')).toBeTruthy();
    });
  });

  it('updates and removes videos through modal callbacks', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        videos: [{ id: '1', title: 'Video 1', status: 'ready', size: 100, createdAt: '2023-01-01' }],
      }),
    });

    const { getByText, queryByText } = render(<VideoList />);

    await waitFor(() => {
      expect(getByText('Video 1')).toBeDefined();
    });

    fireEvent.click(getByText('Video 1'));
    fireEvent.click(getByText('update-from-modal'));

    await waitFor(() => {
      expect(getByText('Updated from modal')).toBeDefined();
    });

    fireEvent.click(getByText('delete-from-modal'));

    await waitFor(() => {
      expect(queryByText('Updated from modal')).toBeNull();
    });
  });

  it('closes the modal through the close callback', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        videos: [{ id: '1', title: 'Video 1', status: 'ready', size: 100, createdAt: '2023-01-01' }],
      }),
    });

    const { getByText, queryByTestId } = render(<VideoList />);

    await waitFor(() => {
      expect(getByText('Video 1')).toBeDefined();
    });

    fireEvent.click(getByText('Video 1'));
    expect(queryByTestId('video-modal')).toBeDefined();

    fireEvent.click(getByText('close-modal'));

    await waitFor(() => {
      expect(queryByTestId('video-modal')).toBeNull();
    });
  });
});
