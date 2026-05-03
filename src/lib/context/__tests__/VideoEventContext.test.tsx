/** @jest-environment jsdom */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { VideoEventProvider, useVideoEvents } from '../VideoEventContext';

describe('VideoEventContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <VideoEventProvider>{children}</VideoEventProvider>
  );

  it('subscribes and emits events', () => {
    const { result } = renderHook(() => useVideoEvents(), { wrapper });
    const callback = jest.fn();

    act(() => {
      result.current.onUploadComplete(callback);
      result.current.emitUploadComplete();
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes from events', () => {
    const { result } = renderHook(() => useVideoEvents(), { wrapper });
    const callback = jest.fn();

    act(() => {
      result.current.onUploadComplete(callback);
      result.current.unsubscribe(callback);
      result.current.emitUploadComplete();
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('throws error when used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    expect(() => renderHook(() => useVideoEvents())).toThrow('useVideoEvents must be used within VideoEventProvider');
    consoleSpy.mockRestore();
  });
});
