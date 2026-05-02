'use client';

import { createContext, useContext, ReactNode, useCallback, useRef } from 'react';

interface VideoEventContextType {
  onUploadComplete: (callback: () => void) => void;
  emitUploadComplete: () => void;
  unsubscribe: (callback: () => void) => void;
}

const VideoEventContext = createContext<VideoEventContextType | undefined>(undefined);

export function VideoEventProvider({ children }: { children: ReactNode }) {
  const subscribers = useRef<Set<() => void>>(new Set());

  const onUploadComplete = useCallback((callback: () => void) => {
    subscribers.current.add(callback);
  }, []);

  const unsubscribe = useCallback((callback: () => void) => {
    subscribers.current.delete(callback);
  }, []);

  const emitUploadComplete = useCallback(() => {
    subscribers.current.forEach(callback => callback());
  }, []);

  return (
    <VideoEventContext.Provider value={{ onUploadComplete, emitUploadComplete, unsubscribe }}>
      {children}
    </VideoEventContext.Provider>
  );
}

export function useVideoEvents() {
  const context = useContext(VideoEventContext);
  if (context === undefined) {
    throw new Error('useVideoEvents must be used within VideoEventProvider');
  }
  return context;
}
