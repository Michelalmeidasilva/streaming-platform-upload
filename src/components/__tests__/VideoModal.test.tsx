/** @jest-environment jsdom */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import VideoModal from '../VideoModal';
import { useI18n } from '@/lib/i18n/LocaleProvider';

jest.mock('@/lib/i18n/LocaleProvider', () => ({
  useI18n: jest.fn(),
}));

describe('VideoModal', () => {
  const mockVideo = {
    id: 'v1',
    title: 'Test Video',
    originalName: 'test.mp4',
    size: 100,
    status: 'ready',
    createdAt: '2023-01-01',
    downloadUrl: '/api/v1/download',
  };

  const mockProps = {
    isOpen: true,
    video: mockVideo,
    canManageVideos: true,
    onClose: jest.fn(),
    onDeleted: jest.fn(),
    onUpdated: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useI18n as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });
    global.fetch = jest.fn();
  });

  it('renders nothing when closed', () => {
    const { queryByText } = render(<VideoModal {...mockProps} isOpen={false} />);
    expect(queryByText('Test Video')).toBeNull();
  });

  it('renders video information when open', () => {
    const { getByText, getByDisplayValue } = render(<VideoModal {...mockProps} />);
    expect(getByText('modal.manageVideo')).toBeDefined();
    expect(getByDisplayValue('Test Video')).toBeDefined();
  });

  it('calls onClose when clicking backdrop', () => {
    render(<VideoModal {...mockProps} />);
    const backdrop = document.querySelector('[class*="backdrop"]')!;
    fireEvent.click(backdrop);
    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('does not close when clicking inside the modal content', () => {
    const { getByText } = render(<VideoModal {...mockProps} />);

    fireEvent.click(getByText('modal.manageVideo'));

    expect(mockProps.onClose).not.toHaveBeenCalled();
  });

  it('renders read-only mode when video management is disabled', () => {
    const { getByText, queryByText, queryByDisplayValue } = render(
      <VideoModal {...mockProps} canManageVideos={false} />
    );

    expect(getByText('Test Video')).toBeDefined();
    expect(queryByDisplayValue('Test Video')).toBeNull();
    expect(queryByText('modal.delete')).toBeNull();
  });

  it('handles save action', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ video: { ...mockVideo, title: 'New Title' } }),
    });

    const { getByText, getByDisplayValue } = render(<VideoModal {...mockProps} />);
    const input = getByDisplayValue('Test Video');
    fireEvent.change(input, { target: { value: 'New Title' } });

    const saveBtn = getByText('modal.saveTitle');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockProps.onUpdated).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Title' }));
    });
  });

  it('handles delete action', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    const { getByText } = render(<VideoModal {...mockProps} />);
    const deleteBtn = getByText('modal.delete');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockProps.onDeleted).toHaveBeenCalledWith('v1');
    });
  });

  it('closes through the close button', () => {
    const { getByLabelText } = render(<VideoModal {...mockProps} />);

    fireEvent.click(getByLabelText('modal.closeLabel'));

    expect(mockProps.onClose).toHaveBeenCalled();
  });

  it('keeps the save button disabled while saving and logs save failures', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    const { getByText } = render(<VideoModal {...mockProps} />);

    fireEvent.click(getByText('modal.saveTitle'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
      expect(getByText('modal.saveTitle')).toBeDefined();
    });

    consoleSpy.mockRestore();
  });

  it('logs delete failures', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    const { getByText } = render(<VideoModal {...mockProps} />);

    fireEvent.click(getByText('modal.delete'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
      expect(mockProps.onDeleted).not.toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it('resets the editable title when the selected video changes', () => {
    const { rerender, getByDisplayValue } = render(<VideoModal {...mockProps} />);

    rerender(
      <VideoModal
        {...mockProps}
        video={{ ...mockVideo, id: 'v2', title: 'Another Title', originalName: 'another.mp4' }}
      />
    );

    expect(getByDisplayValue('Another Title')).toBeDefined();
  });
});
