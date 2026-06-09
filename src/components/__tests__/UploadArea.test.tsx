/** @jest-environment jsdom */
/* eslint-disable react/display-name, @typescript-eslint/no-explicit-any */
import React, { act } from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import UploadArea from '../UploadArea';
import { useSession } from 'next-auth/react';
import { useVideoEvents } from '@/lib/context/VideoEventContext';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import { canUploadVideo } from '@/lib/auth/permissions';
import { validateCMAFFile } from '@/lib/cmaf';
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

jest.mock('@/lib/cmaf', () => ({
  validateCMAFFile: jest.fn(() => ({ valid: true })),
}));

jest.mock('@/lib/auth/permissions', () => ({
  canUploadVideo: jest.fn((role) => role === 'ADMIN'),
}));

jest.mock('@/lib/auth/e2e', () => ({
  createE2ESession: jest.fn(),
  E2E_AUTH_COOKIE: 'e2e-session',
}));

jest.mock('../Skeleton', () => () => <div data-testid="skeleton" />);

describe('UploadArea', () => {
  const originalEnv = process.env;

  beforeAll(() => {
    global.URL.createObjectURL = jest.fn();
    global.URL.revokeObjectURL = jest.fn();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, NEXT_PUBLIC_E2E_AUTH_ENABLED: '0', NEXT_PUBLIC_STORAGE_DIRECT_UPLOAD_ENABLED: 'true' };
    (useVideoEvents as jest.Mock).mockReturnValue({
      emitUploadComplete: jest.fn(),
    });
    (useI18n as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });
    (canUploadVideo as unknown as jest.Mock).mockImplementation((role) => role === 'ADMIN');
    (validateCMAFFile as jest.Mock).mockReturnValue({ valid: true });
    (createE2ESession as jest.Mock).mockImplementation((email: string) => ({
      user: { email, role: 'ADMIN', name: 'E2E Admin' },
    }));
    global.fetch = jest.fn();
    (global as any).EventSource = jest.fn().mockImplementation(() => ({
      addEventListener: jest.fn(),
      close: jest.fn(),
    }));
    global.alert = jest.fn();
    document.cookie = '';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('renders loading skeleton when session is loading', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'loading', data: null });
    const { getAllByTestId } = render(<UploadArea />);
    expect(getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('renders locked state when not authenticated', () => {
    (useSession as jest.Mock).mockReturnValue({ status: 'unauthenticated', data: null });
    const { getByText } = render(<UploadArea />);
    expect(getByText('auth.uploadsAdminOnly')).toBeDefined();
  });

  it('renders restricted access when not an admin', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'MEMBER' } },
    });
    const { getByText } = render(<UploadArea />);
    expect(getByText('auth.uploadsAdminOnly')).toBeDefined();
  });

  it('allows file selection for admins', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    const { getByText } = render(<UploadArea />);
    expect(getByText('upload.dropzone.idleTitle')).toBeDefined();
  });

  it('opens file picker on Enter key in dropzone', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    const { getByRole } = render(<UploadArea />);
    const dropzone = getByRole('button', { name: 'upload.dropzone.idleTitle' });
    const input = dropzone.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(input, 'click').mockImplementation(() => {});

    fireEvent.keyDown(dropzone, { key: 'Enter' });
    expect(clickSpy).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
  });

  it('opens file picker on Space key in dropzone', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    const { getByRole } = render(<UploadArea />);
    const dropzone = getByRole('button', { name: 'upload.dropzone.idleTitle' });
    const input = dropzone.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(input, 'click').mockImplementation(() => {});

    fireEvent.keyDown(dropzone, { key: ' ' });
    expect(clickSpy).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
  });

  it('ignores other keys in dropzone', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    const { getByRole } = render(<UploadArea />);
    const dropzone = getByRole('button', { name: 'upload.dropzone.idleTitle' });
    const input = dropzone.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = jest.spyOn(input, 'click').mockImplementation(() => {});

    fireEvent.keyDown(dropzone, { key: 'Tab' });
    expect(clickSpy).not.toHaveBeenCalled();

    clickSpy.mockRestore();
  });

  it('handles drag and drop', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    const { getByText } = render(<UploadArea />);
    const dropzone = getByText('upload.dropzone.idleTitle').closest('div')!;

    fireEvent.dragOver(dropzone);
    expect(getByText('upload.dropzone.activeTitle')).toBeDefined();

    fireEvent.dragLeave(dropzone);
    expect(getByText('upload.dropzone.idleTitle')).toBeDefined();
  });

  it('ignores empty drops without starting an upload', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    const { getByText } = render(<UploadArea />);
    const dropzone = getByText('upload.dropzone.idleTitle').closest('div')!;

    fireEvent.drop(dropzone, {
      dataTransfer: {
        files: [],
      },
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('alerts when file format is unsupported', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (validateCMAFFile as jest.Mock).mockReturnValue({ valid: false, errorKey: 'unsupportedFormat' });

    const { container } = render(<UploadArea />);
    const input = container.querySelector('input[type="file"]')!;
    const file = new File(['test'], 'video.avi', { type: 'video/x-msvideo' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('upload.validation.unsupportedFormat');
    });
  });

  it('alerts when file is too large', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    (validateCMAFFile as jest.Mock).mockReturnValue({ valid: false, errorKey: 'fileTooLarge' });

    const { container } = render(<UploadArea />);
    const input = container.querySelector('input[type="file"]')!;
    const file = new File(['test'], 'video.mp4', { type: 'video/mp4' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('upload.validation.fileTooLarge');
    });
  });

  it('uploads a file successfully with direct upload and waits for processing', async () => {
    jest.useFakeTimers();
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    const emitUploadComplete = jest.fn();
    (useVideoEvents as jest.Mock).mockReturnValue({ emitUploadComplete });

    const videoElement: Record<string, any> = {
      preload: '',
      muted: false,
      playsInline: false,
      duration: 4,
      videoWidth: 1280,
      videoHeight: 720,
    };
    let currentTime = 0;
    Object.defineProperty(videoElement, 'currentTime', {
      get: () => currentTime,
      set: (value) => {
        currentTime = value;
        if (videoElement.onseeked) {
          videoElement.onseeked();
        }
      },
    });
    const canvasElement = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue({ drawImage: jest.fn() }),
      toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,thumb'),
    };
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'video') {
        return videoElement as any;
      }
      if (tagName === 'canvas') {
        return canvasElement as any;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as any;
    }) as typeof document.createElement);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          sessionId: 'session-1',
          chunkSize: 5,
          totalChunks: 1,
          presignedUrls: ['https://upload.example/part-1'],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: jest.fn().mockReturnValue('"etag-1"') },
      })
      .mockResolvedValueOnce({ ok: true });

    const { container, getByText } = render(<UploadArea />);
    const input = container.querySelector('input[type="file"]')!;
    const file = new File(['hello'], 'video.mp4', { type: 'video/mp4' });

    fireEvent.change(input, { target: { files: [file] } });
    videoElement.onloadeddata();

    await waitFor(() => {
      expect(getByText('video.mp4')).toBeDefined();
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(getByText('stages.uploaded')).toBeDefined();
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      '/api/upload',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );

    expect(global.fetch).toHaveBeenNthCalledWith(
      3,
      '/api/upload/complete',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );

    await waitFor(() => {
      expect(getByText('stages.uploaded')).toBeDefined();
      expect(emitUploadComplete).toHaveBeenCalled();
    });

    createElementSpy.mockRestore();
    jest.useRealTimers();
  });

  it('prompts for .yuv geometry and uploads paired .srt sidecars', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    const promptSpy = jest.spyOn(window, 'prompt')
      .mockReturnValueOnce('1920x1080') // dimensions
      .mockReturnValueOnce('30')        // fps
      .mockReturnValueOnce('yuv420p');  // pixel format

    const videoElement: Record<string, any> = {
      preload: '', muted: false, playsInline: false, duration: 4, videoWidth: 1920, videoHeight: 1080,
    };
    Object.defineProperty(videoElement, 'currentTime', {
      get: () => 1,
      set: () => { if (videoElement.onseeked) videoElement.onseeked(); },
    });
    const canvasElement = {
      width: 0, height: 0,
      getContext: jest.fn().mockReturnValue({ drawImage: jest.fn() }),
      toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,thumb'),
    };
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'video') return videoElement as any;
      if (tagName === 'canvas') return canvasElement as any;
      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as any;
    }) as typeof document.createElement);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          sessionId: 'session-yuv',
          chunkSize: 5,
          totalChunks: 1,
          presignedUrls: ['https://upload.example/part-1'],
          subtitleUploads: [{ objectKey: 'subtitles/v/en.srt', url: 'https://put.example/en', language: 'en' }],
        }),
      })
      .mockResolvedValueOnce({ ok: true }) // subtitle PUT
      .mockResolvedValueOnce({ ok: true, headers: { get: jest.fn().mockReturnValue('"etag-1"') } }) // chunk PUT
      .mockResolvedValueOnce({ ok: true }); // complete

    const { container } = render(<UploadArea />);
    const input = container.querySelector('input[type="file"]')!;
    const yuv = new File(['raw'], 'movie.yuv', { type: '' });
    const srt = new File(['1\n00:00:00,000 --> 00:00:01,000\nhi\n'], 'movie.en.srt', { type: '' });

    fireEvent.change(input, { target: { files: [yuv, srt] } });
    videoElement.onloadeddata();

    await waitFor(() => {
      // initiate carried the rawVideo geometry collected via prompt
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        '/api/upload',
        expect.objectContaining({
          body: expect.stringContaining('"rawVideo":{"width":1920,"height":1080,"fps":30,"pixelFormat":"yuv420p"}'),
        }),
      );
      // the sidecar .srt was PUT to its presigned URL
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'https://put.example/en',
        expect.objectContaining({ method: 'PUT' }),
      );
    });
    expect(promptSpy).toHaveBeenCalledTimes(3);

    createElementSpy.mockRestore();
    promptSpy.mockRestore();
  });

  it('skips a .yuv upload when geometry prompt is cancelled', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });
    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValueOnce(null);

    const { container } = render(<UploadArea />);
    const input = container.querySelector('input[type="file"]')!;
    const yuv = new File(['raw'], 'clip.yuv', { type: '' });

    fireEvent.change(input, { target: { files: [yuv] } });

    await waitFor(() => expect(promptSpy).toHaveBeenCalled());
    // Cancelling means no upload session is initiated.
    expect(global.fetch).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('falls back to server upload when direct S3 upload fails', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const videoElement: Record<string, any> = {
      preload: '',
      muted: false,
      playsInline: false,
      duration: 4,
      videoWidth: 1280,
      videoHeight: 720,
    };
    Object.defineProperty(videoElement, 'currentTime', {
      get: () => 1,
      set: () => {
        if (videoElement.onseeked) {
          videoElement.onseeked();
        }
      },
    });
    const canvasElement = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue({ drawImage: jest.fn() }),
      toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,thumb'),
    };
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'video') {
        return videoElement as any;
      }
      if (tagName === 'canvas') {
        return canvasElement as any;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as any;
    }) as typeof document.createElement);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          sessionId: 'session-fallback',
          chunkSize: 5,
          totalChunks: 1,
          presignedUrls: ['https://upload.example/part-1'],
        }),
      })
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, headers: { get: jest.fn().mockReturnValue(null) } })
      .mockResolvedValueOnce({ ok: true });

    const { container } = render(<UploadArea />);
    const input = container.querySelector('input[type="file"]')!;
    const file = new File(['hello'], 'fallback.mp4', { type: 'video/mp4' });

    fireEvent.change(input, { target: { files: [file] } });
    videoElement.onloadeddata();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(
        3,
        '/api/upload/chunk?sessionId=session-fallback&chunkIndex=0',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });

    expect(global.fetch).toHaveBeenNthCalledWith(
      4,
      '/api/upload/complete',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
    expect(warnSpy).toHaveBeenCalled();

    createElementSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('uses server upload path by default when direct upload is not explicitly enabled', async () => {
    process.env.NEXT_PUBLIC_STORAGE_DIRECT_UPLOAD_ENABLED = 'false';
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    const videoElement: Record<string, any> = {
      preload: '',
      muted: false,
      playsInline: false,
      duration: 4,
      videoWidth: 1280,
      videoHeight: 720,
    };
    Object.defineProperty(videoElement, 'currentTime', {
      get: () => 1,
      set: () => {
        if (videoElement.onseeked) {
          videoElement.onseeked();
        }
      },
    });
    const canvasElement = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue({ drawImage: jest.fn() }),
      toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,thumb'),
    };
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'video') {
        return videoElement as any;
      }
      if (tagName === 'canvas') {
        return canvasElement as any;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as any;
    }) as typeof document.createElement);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          sessionId: 'session-server',
          chunkSize: 5,
          totalChunks: 1,
          presignedUrls: ['https://upload.example/part-1'],
        }),
      })
      .mockResolvedValueOnce({ ok: true, headers: { get: jest.fn().mockReturnValue(null) } })
      .mockResolvedValueOnce({ ok: true });

    const { container } = render(<UploadArea />);
    const input = container.querySelector('input[type="file"]')!;
    const file = new File(['hello'], 'server-default.mp4', { type: 'video/mp4' });

    fireEvent.change(input, { target: { files: [file] } });
    videoElement.onloadeddata();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        '/api/upload/chunk?sessionId=session-server&chunkIndex=0',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        }),
      );
    });

    createElementSpy.mockRestore();
  });

  it('falls back to a null thumbnail when canvas context is unavailable', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    const videoElement: Record<string, any> = {
      preload: '',
      muted: false,
      playsInline: false,
      duration: 4,
      videoWidth: 1280,
      videoHeight: 720,
    };
    Object.defineProperty(videoElement, 'currentTime', {
      get: () => 1,
      set: () => {
        if (videoElement.onseeked) {
          videoElement.onseeked();
        }
      },
    });
    const canvasElement = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue(null),
      toDataURL: jest.fn(),
    };
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'video') {
        return videoElement as any;
      }
      if (tagName === 'canvas') {
        return canvasElement as any;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as any;
    }) as typeof document.createElement);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          sessionId: 'session-2',
          chunkSize: 5,
          totalChunks: 1,
          presignedUrls: ['https://upload.example/part-1'],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: jest.fn().mockReturnValue('"etag-2"') },
      })
      .mockResolvedValueOnce({ ok: true });

    const { container } = render(<UploadArea />);
    const input = container.querySelector('input[type="file"]')!;
    const file = new File(['hello'], 'contextless.mp4', { type: 'video/mp4' });

    fireEvent.change(input, { target: { files: [file] } });
    videoElement.onloadeddata();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(
        3,
        '/api/upload/complete',
        expect.objectContaining({
          credentials: 'include',
          body: expect.stringContaining('"thumbnail":null'),
        }),
      );
    });

    createElementSpy.mockRestore();
  });

  it('handles upload failure and allows removing the failed entry', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

    const videoElement: Record<string, any> = {
      preload: '',
      muted: false,
      playsInline: false,
      duration: 4,
      videoWidth: 1280,
      videoHeight: 720,
    };
    Object.defineProperty(videoElement, 'currentTime', {
      get: () => 1,
      set: () => {
        if (videoElement.onseeked) {
          videoElement.onseeked();
        }
      },
    });
    const canvasElement = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue({ drawImage: jest.fn() }),
      toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,thumb'),
    };
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'video') {
        return videoElement as any;
      }
      if (tagName === 'canvas') {
        return canvasElement as any;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as any;
    }) as typeof document.createElement);

    const { container, getByText, queryByText, getByLabelText } = render(<UploadArea />);
    const input = container.querySelector('input[type="file"]')!;
    const file = new File(['hello'], 'broken.mp4', { type: 'video/mp4' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(getByText('stages.error')).toBeDefined();
    });

    fireEvent.click(getByLabelText('upload.actions.remove'));

    await waitFor(() => {
      expect(queryByText('broken.mp4')).toBeNull();
    });

    createElementSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('handles thumbnail generation errors before completion', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    const videoElement: Record<string, any> = {
      preload: '',
      muted: false,
      playsInline: false,
      duration: 4,
      videoWidth: 1280,
      videoHeight: 720,
      src: 'blob:test',
    };
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'video') {
        return videoElement as any;
      }
      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as any;
    }) as typeof document.createElement);

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        sessionId: 'session-3',
        chunkSize: 5,
        totalChunks: 1,
        presignedUrls: ['https://upload.example/part-1'],
      }),
    }).mockResolvedValueOnce({
      ok: true,
      headers: { get: jest.fn().mockReturnValue('"etag-3"') },
    }).mockResolvedValueOnce({ ok: true });

    const { container } = render(<UploadArea />);
    const input = container.querySelector('input[type="file"]')!;
    const file = new File(['hello'], 'thumb-error.mp4', { type: 'video/mp4' });

    fireEvent.change(input, { target: { files: [file] } });
    videoElement.onerror();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenNthCalledWith(
        3,
        '/api/upload/complete',
        expect.objectContaining({
          credentials: 'include',
          body: expect.stringContaining('"thumbnail":null'),
        }),
      );
    });

    createElementSpy.mockRestore();
  });

  it('merges SSE video-updated events into matching upload rows by serverVideoId', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    // Capture the EventSource instance so we can fire events manually
    let capturedAddEventListener: jest.Mock | null = null;
    (global as any).EventSource = jest.fn().mockImplementation(() => {
      const handler: jest.Mock = jest.fn();
      capturedAddEventListener = handler;
      return { addEventListener: handler, close: jest.fn() };
    });

    const videoElement: Record<string, any> = {
      preload: '', muted: false, playsInline: false, duration: 4, videoWidth: 1280, videoHeight: 720,
    };
    Object.defineProperty(videoElement, 'currentTime', {
      get: () => 1,
      set: () => { if (videoElement.onseeked) videoElement.onseeked(); },
    });
    const canvasElement = {
      width: 0, height: 0,
      getContext: jest.fn().mockReturnValue({ drawImage: jest.fn() }),
      toDataURL: jest.fn().mockReturnValue('data:image/jpeg;base64,thumb'),
    };
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'video') return videoElement as any;
      if (tagName === 'canvas') return canvasElement as any;
      return document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as any;
    }) as typeof document.createElement);

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          sessionId: 'session-sse',
          videoId: 'server-uuid-1',
          chunkSize: 5,
          totalChunks: 1,
          presignedUrls: ['https://upload.example/part-sse'],
        }),
      })
      .mockResolvedValueOnce({ ok: true, headers: { get: jest.fn().mockReturnValue('"etag-sse"') } })
      .mockResolvedValueOnce({ ok: true });

    const { container, getByText } = render(<UploadArea />);
    const input = container.querySelector('input[type="file"]')!;
    const file = new File(['data'], 'sse-test.mp4', { type: 'video/mp4' });

    fireEvent.change(input, { target: { files: [file] } });
    videoElement.onloadeddata();

    // Wait for the upload to complete and the SSE effect to mount
    await waitFor(() => {
      expect(getByText('stages.uploaded')).toBeDefined();
    });

    // Fire a video-updated SSE event with matching server uuid
    expect(capturedAddEventListener).not.toBeNull();
    const addEventListenerMock = capturedAddEventListener as unknown as jest.Mock;
    const [, sseHandler] = addEventListenerMock.mock.calls.find(
      ([eventName]: [string]) => eventName === 'video-updated',
    )!;
    act(() => {
      sseHandler({ data: JSON.stringify({ id: 'server-uuid-1', status: 'processing', processingStatus: 'queued', storageConfirmedAt: null }) } as MessageEvent);
    });

    await waitFor(() => {
      expect(getByText('stages.transcode_pending')).toBeDefined();
    });

    // Fire a second event with null processingStatus — should keep existing processingStatus
    act(() => {
      sseHandler({ data: JSON.stringify({ id: 'server-uuid-1', status: 'processing', processingStatus: null, storageConfirmedAt: '2026-06-04T00:00:00Z' }) } as MessageEvent);
    });

    await waitFor(() => {
      // storageConfirmedAt is now set; processingStatus stayed 'queued' (null fell back to existing)
      expect(getByText('stages.transcode_pending')).toBeDefined();
    });

    createElementSpy.mockRestore();
  });

  it('renders codec and resolution checkboxes for admins', () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    const { getByLabelText } = render(<UploadArea />);
    // Default: H.264 checked, H.265 and AV1 unchecked
    expect((getByLabelText('H.264 (AVC)') as HTMLInputElement).checked).toBe(true);
    expect((getByLabelText('H.265 (HEVC)') as HTMLInputElement).checked).toBe(false);
    // Default resolutions: 720p and 1080p checked
    expect((getByLabelText('720p') as HTMLInputElement).checked).toBe(true);
    expect((getByLabelText('1080p') as HTMLInputElement).checked).toBe(true);
    expect((getByLabelText('360p') as HTMLInputElement).checked).toBe(false);
  });

  it('shows AV1 warning when AV1 is selected', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    const { getByLabelText, getByText } = render(<UploadArea />);
    const av1Checkbox = getByLabelText('AV1') as HTMLInputElement;
    fireEvent.click(av1Checkbox);

    await waitFor(() => {
      expect(getByText('AV1 é o encode mais lento — pode demorar bastante.')).toBeDefined();
    });
  });

  it('shows validation error and blocks upload when no codec selected', async () => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'authenticated',
      data: { user: { role: 'ADMIN' } },
    });

    const { getByLabelText, getByRole } = render(<UploadArea />);
    // Uncheck the default H.264
    fireEvent.click(getByLabelText('H.264 (AVC)'));

    await waitFor(() => {
      expect(getByRole('alert')).toBeDefined();
    });

    // No upload should be attempted
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('authenticates through the e2e cookie when enabled', async () => {
    process.env.NEXT_PUBLIC_E2E_AUTH_ENABLED = '1';
    document.cookie = 'e2e-session=admin-e2e%40example.com';
    (useSession as jest.Mock).mockReturnValue({ status: 'unauthenticated', data: null });

    const { getByText } = render(<UploadArea />);

    await waitFor(() => {
      expect(getByText('upload.dropzone.idleTitle')).toBeDefined();
    });
  });
});
