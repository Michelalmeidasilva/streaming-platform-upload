import { VideoEventEmitter } from '../VideoEventEmitter';
import {
  UploadStartedEvent,
  UploadProgressEvent,
  UploadCompletedEvent,
  UploadFailedEvent,
  VideoProcessingEvent,
} from '../events';

describe('VideoEventEmitter', () => {
  let emitter: VideoEventEmitter;

  beforeEach(() => {
    emitter = new VideoEventEmitter();
  });

  afterEach(() => {
    emitter.removeAllListeners();
  });

  // ===== on() Tests =====
  describe('on() - register event listeners', () => {
    it('should register a listener and fire it when event is emitted', (done) => {
      const handler = jest.fn();
      emitter.on('upload.started', handler);

      const data: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      emitter.emit('upload.started', data);

      setTimeout(() => {
        expect(handler).toHaveBeenCalledWith(data);
        expect(handler).toHaveBeenCalledTimes(1);
        done();
      }, 0);
    });

    it('should register multiple listeners for the same event', (done) => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      emitter.on('upload.started', handler1);
      emitter.on('upload.started', handler2);
      emitter.on('upload.started', handler3);

      const data: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      emitter.emit('upload.started', data);

      setTimeout(() => {
        expect(handler1).toHaveBeenCalledWith(data);
        expect(handler2).toHaveBeenCalledWith(data);
        expect(handler3).toHaveBeenCalledWith(data);
        done();
      }, 0);
    });

    it('should call multiple listeners in order', (done) => {
      const callOrder: string[] = [];
      const handler1 = () => callOrder.push('handler1');
      const handler2 = () => callOrder.push('handler2');
      const handler3 = () => callOrder.push('handler3');

      emitter.on('upload.progress', handler1);
      emitter.on('upload.progress', handler2);
      emitter.on('upload.progress', handler3);

      const data: UploadProgressEvent = {
        videoId: 'vid-1',
        filename: 'video.mp4',
        progress: 50,
        uploadedBytes: 5242880,
        totalBytes: 10485760,
      };
      emitter.emit('upload.progress', data);

      setTimeout(() => {
        expect(callOrder).toEqual(['handler1', 'handler2', 'handler3']);
        done();
      }, 0);
    });

    it('should work with different event types', (done) => {
      const uploadHandler = jest.fn();
      const processingHandler = jest.fn();
      const failedHandler = jest.fn();

      emitter.on('upload.started', uploadHandler);
      emitter.on('video.processing', processingHandler);
      emitter.on('upload.failed', failedHandler);

      const uploadData: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      const processingData: VideoProcessingEvent = { videoId: 'vid-1', status: 'processing' };
      const failedData: UploadFailedEvent = {
        videoId: 'vid-1',
        filename: 'video.mp4',
        error: 'Network error',
      };

      emitter.emit('upload.started', uploadData);
      emitter.emit('video.processing', processingData);
      emitter.emit('upload.failed', failedData);

      setTimeout(() => {
        expect(uploadHandler).toHaveBeenCalledWith(uploadData);
        expect(processingHandler).toHaveBeenCalledWith(processingData);
        expect(failedHandler).toHaveBeenCalledWith(failedData);
        done();
      }, 0);
    });

    it('should return this for chaining', () => {
      const handler = jest.fn();
      const result = emitter.on('upload.started', handler);
      expect(result).toBe(emitter);
    });
  });

  // ===== once() Tests =====
  describe('once() - one-time listener', () => {
    it('should fire once and then not fire on subsequent emissions', (done) => {
      const handler = jest.fn();
      emitter.once('upload.started', handler);

      const data: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      emitter.emit('upload.started', data);
      emitter.emit('upload.started', data);
      emitter.emit('upload.started', data);

      setTimeout(() => {
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(data);
        done();
      }, 0);
    });

    it('should work with multiple once listeners for the same event', (done) => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.once('upload.completed', handler1);
      emitter.once('upload.completed', handler2);

      const data: UploadCompletedEvent = {
        videoId: 'vid-1',
        filename: 'video.mp4',
        size: 10485760,
        url: 'http://storage/video.mp4',
      };
      emitter.emit('upload.completed', data);
      emitter.emit('upload.completed', data);

      setTimeout(() => {
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
        done();
      }, 0);
    });

    it('should allow mixing once and on listeners', (done) => {
      const onceHandler = jest.fn();
      const onHandler = jest.fn();

      emitter.once('video.ready', onceHandler);
      emitter.on('video.ready', onHandler);

      const data: VideoProcessingEvent = { videoId: 'vid-1', status: 'ready' };
      emitter.emit('video.ready', data);
      emitter.emit('video.ready', data);

      setTimeout(() => {
        expect(onceHandler).toHaveBeenCalledTimes(1);
        expect(onHandler).toHaveBeenCalledTimes(2);
        done();
      }, 0);
    });

    it('should return this for chaining', () => {
      const handler = jest.fn();
      const result = emitter.once('upload.started', handler);
      expect(result).toBe(emitter);
    });
  });

  // ===== off() Tests =====
  describe('off() - remove specific listener', () => {
    it('should remove a listener and prevent it from being called', (done) => {
      const handler = jest.fn();
      emitter.on('upload.started', handler);

      const data: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      emitter.emit('upload.started', data);

      expect(handler).toHaveBeenCalledTimes(1);

      emitter.off('upload.started', handler);
      emitter.emit('upload.started', data);

      setTimeout(() => {
        expect(handler).toHaveBeenCalledTimes(1); // should not be called again
        done();
      }, 0);
    });

    it('should remove only the specified listener when multiple listeners exist', (done) => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      emitter.on('upload.progress', handler1);
      emitter.on('upload.progress', handler2);
      emitter.on('upload.progress', handler3);

      const data: UploadProgressEvent = {
        videoId: 'vid-1',
        filename: 'video.mp4',
        progress: 50,
        uploadedBytes: 5242880,
        totalBytes: 10485760,
      };

      emitter.off('upload.progress', handler2);
      emitter.emit('upload.progress', data);

      setTimeout(() => {
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(0); // removed
        expect(handler3).toHaveBeenCalledTimes(1);
        done();
      }, 0);
    });

    it('should handle removing a listener that was not registered', (done) => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('upload.failed', handler1);
      emitter.off('upload.failed', handler2); // not registered

      const data: UploadFailedEvent = {
        videoId: 'vid-1',
        filename: 'video.mp4',
        error: 'Network error',
      };
      emitter.emit('upload.failed', data);

      setTimeout(() => {
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(0);
        done();
      }, 0);
    });

    it('should remove only the first matching listener in order', (done) => {
      const handler = jest.fn();

      emitter.on('video.error', handler);
      emitter.on('video.error', handler);
      emitter.on('video.error', handler);

      const data: VideoProcessingEvent = { videoId: 'vid-1', status: 'error' };
      emitter.emit('video.error', data);

      expect(handler).toHaveBeenCalledTimes(3); // all 3 instances called

      emitter.off('video.error', handler);
      emitter.emit('video.error', data);

      setTimeout(() => {
        expect(handler).toHaveBeenCalledTimes(5); // 3 from first emit + 2 from second emit (one removed)
        done();
      }, 0);
    });

    it('should return this for chaining', () => {
      const handler = jest.fn();
      emitter.on('upload.started', handler);
      const result = emitter.off('upload.started', handler);
      expect(result).toBe(emitter);
    });
  });

  // ===== emit() Tests =====
  describe('emit() - emit events with data', () => {
    it('should emit event and return true when there are listeners', () => {
      const handler = jest.fn();
      emitter.on('upload.started', handler);

      const data: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      const result = emitter.emit('upload.started', data);

      expect(result).toBe(true);
    });

    it('should emit event and return false when there are no listeners', () => {
      const data: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      const result = emitter.emit('upload.started', data);

      expect(result).toBe(false);
    });

    it('should pass event data correctly to handlers', (done) => {
      const handler = jest.fn();
      emitter.on('upload.progress', handler);

      const data: UploadProgressEvent = {
        videoId: 'vid-123',
        filename: 'my-video.mp4',
        progress: 75,
        uploadedBytes: 7864320,
        totalBytes: 10485760,
        speed: 1048576,
      };
      emitter.emit('upload.progress', data);

      setTimeout(() => {
        expect(handler).toHaveBeenCalledWith(data);
        const callArg = handler.mock.calls[0][0];
        expect(callArg.videoId).toBe('vid-123');
        expect(callArg.filename).toBe('my-video.mp4');
        expect(callArg.progress).toBe(75);
        expect(callArg.uploadedBytes).toBe(7864320);
        expect(callArg.totalBytes).toBe(10485760);
        expect(callArg.speed).toBe(1048576);
        done();
      }, 0);
    });

    it('should emit multiple events in sequence', (done) => {
      const handlers: { [key: string]: jest.Mock } = {
        started: jest.fn(),
        progress: jest.fn(),
        completed: jest.fn(),
      };

      emitter.on('upload.started', handlers.started);
      emitter.on('upload.progress', handlers.progress);
      emitter.on('upload.completed', handlers.completed);

      const startData: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      const progressData: UploadProgressEvent = {
        videoId: 'vid-1',
        filename: 'video.mp4',
        progress: 50,
        uploadedBytes: 5242880,
        totalBytes: 10485760,
      };
      const completeData: UploadCompletedEvent = {
        videoId: 'vid-1',
        filename: 'video.mp4',
        size: 10485760,
        url: 'http://storage/video.mp4',
      };

      emitter.emit('upload.started', startData);
      emitter.emit('upload.progress', progressData);
      emitter.emit('upload.completed', completeData);

      setTimeout(() => {
        expect(handlers.started).toHaveBeenCalledWith(startData);
        expect(handlers.progress).toHaveBeenCalledWith(progressData);
        expect(handlers.completed).toHaveBeenCalledWith(completeData);
        done();
      }, 0);
    });

    it('should add events to history when emitted', () => {
      const data1: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      const data2: UploadProgressEvent = {
        videoId: 'vid-1',
        filename: 'video.mp4',
        progress: 50,
        uploadedBytes: 5242880,
        totalBytes: 10485760,
      };

      emitter.emit('upload.started', data1);
      emitter.emit('upload.progress', data2);

      const history = emitter.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].type).toBe('upload.started');
      expect(history[0].data).toEqual(data1);
      expect(history[1].type).toBe('upload.progress');
      expect(history[1].data).toEqual(data2);
    });
  });

  // ===== removeAllListeners() Tests =====
  describe('removeAllListeners() - remove all listeners', () => {
    it('should remove all listeners for a specific event', (done) => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      emitter.on('upload.started', handler1);
      emitter.on('upload.started', handler2);
      emitter.on('upload.started', handler3);

      const data: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      emitter.emit('upload.started', data);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);

      emitter.removeAllListeners('upload.started');
      emitter.emit('upload.started', data);

      setTimeout(() => {
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
        expect(handler3).toHaveBeenCalledTimes(1);
        done();
      }, 0);
    });

    it('should remove all listeners globally when called without event name', (done) => {
      const uploadHandler = jest.fn();
      const progressHandler = jest.fn();
      const completedHandler = jest.fn();

      emitter.on('upload.started', uploadHandler);
      emitter.on('upload.progress', progressHandler);
      emitter.on('upload.completed', completedHandler);

      emitter.removeAllListeners();

      const uploadData: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      const progressData: UploadProgressEvent = {
        videoId: 'vid-1',
        filename: 'video.mp4',
        progress: 50,
        uploadedBytes: 5242880,
        totalBytes: 10485760,
      };
      const completedData: UploadCompletedEvent = {
        videoId: 'vid-1',
        filename: 'video.mp4',
        size: 10485760,
        url: 'http://storage/video.mp4',
      };

      emitter.emit('upload.started', uploadData);
      emitter.emit('upload.progress', progressData);
      emitter.emit('upload.completed', completedData);

      setTimeout(() => {
        expect(uploadHandler).toHaveBeenCalledTimes(0);
        expect(progressHandler).toHaveBeenCalledTimes(0);
        expect(completedHandler).toHaveBeenCalledTimes(0);
        done();
      }, 0);
    });

    it('should not affect other event listeners when removing specific event', (done) => {
      const uploadHandler = jest.fn();
      const progressHandler = jest.fn();

      emitter.on('upload.started', uploadHandler);
      emitter.on('upload.progress', progressHandler);

      emitter.removeAllListeners('upload.started');

      const uploadData: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      const progressData: UploadProgressEvent = {
        videoId: 'vid-1',
        filename: 'video.mp4',
        progress: 50,
        uploadedBytes: 5242880,
        totalBytes: 10485760,
      };

      emitter.emit('upload.started', uploadData);
      emitter.emit('upload.progress', progressData);

      setTimeout(() => {
        expect(uploadHandler).toHaveBeenCalledTimes(0);
        expect(progressHandler).toHaveBeenCalledTimes(1);
        done();
      }, 0);
    });

    it('should return this for chaining', () => {
      const result = emitter.removeAllListeners();
      expect(result).toBe(emitter);
    });
  });

  // ===== listenerCount() Tests =====
  describe('listenerCount() - return correct count of listeners', () => {
    it('should return 0 when no listeners are registered', () => {
      const count = emitter.listenerCount('upload.started');
      expect(count).toBe(0);
    });

    it('should return correct count for a single listener', () => {
      const handler = jest.fn();
      emitter.on('upload.started', handler);

      const count = emitter.listenerCount('upload.started');
      expect(count).toBe(1);
    });

    it('should return correct count for multiple listeners', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      emitter.on('upload.progress', handler1);
      emitter.on('upload.progress', handler2);
      emitter.on('upload.progress', handler3);

      const count = emitter.listenerCount('upload.progress');
      expect(count).toBe(3);
    });

    it('should decrease count when a listener is removed', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('upload.completed', handler1);
      emitter.on('upload.completed', handler2);

      expect(emitter.listenerCount('upload.completed')).toBe(2);

      emitter.off('upload.completed', handler1);
      expect(emitter.listenerCount('upload.completed')).toBe(1);

      emitter.off('upload.completed', handler2);
      expect(emitter.listenerCount('upload.completed')).toBe(0);
    });

    it('should return 0 after removeAllListeners for a specific event', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('upload.failed', handler1);
      emitter.on('upload.failed', handler2);

      expect(emitter.listenerCount('upload.failed')).toBe(2);

      emitter.removeAllListeners('upload.failed');
      expect(emitter.listenerCount('upload.failed')).toBe(0);
    });

    it('should track counts for different event types independently', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();
      const handler4 = jest.fn();

      emitter.on('upload.started', handler1);
      emitter.on('upload.started', handler2);
      emitter.on('video.processing', handler3);
      emitter.on('video.processing', handler4);
      emitter.on('video.processing', handler1);

      expect(emitter.listenerCount('upload.started')).toBe(2);
      expect(emitter.listenerCount('video.processing')).toBe(3);
      expect(emitter.listenerCount('video.ready')).toBe(0);
    });

    it('should return correct count after removeAllListeners globally', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      emitter.on('upload.started', handler1);
      emitter.on('upload.progress', handler2);
      emitter.on('upload.completed', handler3);

      emitter.removeAllListeners();

      expect(emitter.listenerCount('upload.started')).toBe(0);
      expect(emitter.listenerCount('upload.progress')).toBe(0);
      expect(emitter.listenerCount('upload.completed')).toBe(0);
    });
  });

  // ===== History Tests =====
  describe('history - event tracking', () => {
    it('should track event history with type, data, and timestamp', () => {
      const data: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      const beforeTime = new Date();
      emitter.emit('upload.started', data);
      const afterTime = new Date();

      const history = emitter.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].type).toBe('upload.started');
      expect(history[0].data).toEqual(data);
      expect(history[0].timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(history[0].timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should maintain history order', () => {
      const data1: UploadStartedEvent = { videoId: 'vid-1', filename: 'video1.mp4' };
      const data2: UploadProgressEvent = {
        videoId: 'vid-1',
        filename: 'video1.mp4',
        progress: 50,
        uploadedBytes: 5242880,
        totalBytes: 10485760,
      };
      const data3: UploadCompletedEvent = {
        videoId: 'vid-1',
        filename: 'video1.mp4',
        size: 10485760,
        url: 'http://storage/video1.mp4',
      };

      emitter.emit('upload.started', data1);
      emitter.emit('upload.progress', data2);
      emitter.emit('upload.completed', data3);

      const history = emitter.getHistory();
      expect(history[0].type).toBe('upload.started');
      expect(history[1].type).toBe('upload.progress');
      expect(history[2].type).toBe('upload.completed');
    });

    it('should return a copy of history', () => {
      const data: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      emitter.emit('upload.started', data);

      const history1 = emitter.getHistory();
      const history2 = emitter.getHistory();

      expect(history1).toEqual(history2);
      expect(history1).not.toBe(history2); // different array instances
    });

    it('should clear history', () => {
      const data: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      emitter.emit('upload.started', data);

      expect(emitter.getHistory()).toHaveLength(1);

      emitter.clearHistory();
      expect(emitter.getHistory()).toHaveLength(0);
    });

    it('should enforce maxHistorySize limit', () => {
      const maxHistorySize = 100;
      for (let i = 0; i < maxHistorySize + 50; i++) {
        const data: UploadStartedEvent = { videoId: `vid-${i}`, filename: `video-${i}.mp4` };
        emitter.emit('upload.started', data);
      }

      const history = emitter.getHistory();
      expect(history.length).toBe(maxHistorySize);
      // should keep the most recent events
      expect(history[0].data.videoId).toBe(`vid-${50}`);
      expect(history[history.length - 1].data.videoId).toBe(`vid-${maxHistorySize + 49}`);
    });
  });

  // ===== Convenience Methods Tests =====
  describe('convenience methods - emitUploadStarted, emitUploadCompleted, etc.', () => {
    it('should emit upload.started via emitUploadStarted', (done) => {
      const handler = jest.fn();
      emitter.on('upload.started', handler);

      emitter.emitUploadStarted('vid-123', 'my-video.mp4');

      setTimeout(() => {
        expect(handler).toHaveBeenCalledWith({
          videoId: 'vid-123',
          filename: 'my-video.mp4',
        });
        done();
      }, 0);
    });

    it('should include rawVideo and subtitles when provided', (done) => {
      const handler = jest.fn();
      emitter.on('upload.started', handler);

      const rawVideo = { width: 1920, height: 1080, fps: 30, pixelFormat: 'yuv420p' };
      const subtitles = [{ objectKey: 'subtitles/vid-1/en.srt', language: 'en', label: 'EN' }];
      emitter.emitUploadStarted('vid-1', 'movie.yuv', rawVideo, subtitles);

      setTimeout(() => {
        expect(handler).toHaveBeenCalledWith({
          videoId: 'vid-1',
          filename: 'movie.yuv',
          rawVideo,
          subtitles,
        });
        done();
      }, 0);
    });

    it('should omit an empty subtitles array', (done) => {
      const handler = jest.fn();
      emitter.on('upload.started', handler);

      emitter.emitUploadStarted('vid-2', 'movie.mp4', undefined, []);

      setTimeout(() => {
        expect(handler).toHaveBeenCalledWith({ videoId: 'vid-2', filename: 'movie.mp4' });
        done();
      }, 0);
    });

    it('should emit upload.progress via emitUploadProgress', (done) => {
      const handler = jest.fn();
      emitter.on('upload.progress', handler);

      emitter.emitUploadProgress({
        videoId: 'vid-123',
        filename: 'my-video.mp4',
        progress: 75,
        uploadedBytes: 7864320,
        totalBytes: 10485760,
        speed: 1048576,
      });

      setTimeout(() => {
        expect(handler).toHaveBeenCalledWith({
          videoId: 'vid-123',
          filename: 'my-video.mp4',
          progress: 75,
          uploadedBytes: 7864320,
          totalBytes: 10485760,
          speed: 1048576,
        });
        done();
      }, 0);
    });

    it('should emit upload.completed via emitUploadCompleted', (done) => {
      const handler = jest.fn();
      emitter.on('upload.completed', handler);

      emitter.emitUploadCompleted('vid-123', 'my-video.mp4', 10485760, 'http://storage/video.mp4');

      setTimeout(() => {
        expect(handler).toHaveBeenCalledWith({
          videoId: 'vid-123',
          filename: 'my-video.mp4',
          size: 10485760,
          url: 'http://storage/video.mp4',
        });
        done();
      }, 0);
    });

    it('should emit upload.failed via emitUploadFailed', (done) => {
      const handler = jest.fn();
      emitter.on('upload.failed', handler);

      emitter.emitUploadFailed('vid-123', 'my-video.mp4', 'Network error');

      setTimeout(() => {
        expect(handler).toHaveBeenCalledWith({
          videoId: 'vid-123',
          filename: 'my-video.mp4',
          error: 'Network error',
        });
        done();
      }, 0);
    });

    it('should emit video.processing via emitVideoProcessing', (done) => {
      const handler = jest.fn();
      emitter.on('video.processing', handler);

      emitter.emitVideoProcessing('vid-123', 'processing');

      setTimeout(() => {
        expect(handler).toHaveBeenCalledWith({
          videoId: 'vid-123',
          status: 'processing',
        });
        done();
      }, 0);
    });

    it('should emit video.ready via emitVideoReady', (done) => {
      const handler = jest.fn();
      emitter.on('video.ready', handler);

      emitter.emitVideoReady('vid-123');

      setTimeout(() => {
        expect(handler).toHaveBeenCalledWith({
          videoId: 'vid-123',
          status: 'ready',
        });
        done();
      }, 0);
    });

    it('should emit video.error via emitVideoError', (done) => {
      const handler = jest.fn();
      emitter.on('video.error', handler);

      emitter.emitVideoError('vid-123');

      setTimeout(() => {
        expect(handler).toHaveBeenCalledWith({
          videoId: 'vid-123',
          status: 'error',
        });
        done();
      }, 0);
    });

    it('should emit video.thumbnail.generated via emitThumbnailGenerated', (done) => {
      const handler = jest.fn();
      emitter.on('video.thumbnail.generated', handler);

      emitter.emitThumbnailGenerated('vid-123', 'http://storage/thumb.jpg', '2026-05-02T10:00:00Z');

      setTimeout(() => {
        expect(handler).toHaveBeenCalledWith({
          videoId: 'vid-123',
          thumbnailUrl: 'http://storage/thumb.jpg',
          extractedAt: '2026-05-02T10:00:00Z',
        });
        done();
      }, 0);
    });

    it('should emit video.thumbnail.fallback via emitThumbnailFallback', (done) => {
      const handler = jest.fn();
      emitter.on('video.thumbnail.fallback', handler);

      emitter.emitThumbnailFallback(
        'vid-123',
        'http://storage/fallback-thumb.jpg',
        'ffmpeg_timeout',
        '2026-05-02T10:00:00Z'
      );

      setTimeout(() => {
        expect(handler).toHaveBeenCalledWith({
          videoId: 'vid-123',
          thumbnailUrl: 'http://storage/fallback-thumb.jpg',
          reason: 'ffmpeg_timeout',
          fallbackAt: '2026-05-02T10:00:00Z',
        });
        done();
      }, 0);
    });
  });

  // ===== Edge Cases and Integration Tests =====
  describe('edge cases and integration', () => {
    it('should handle listener that throws error', () => {
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });

      emitter.on('upload.started', errorHandler);

      const data: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      expect(() => emitter.emit('upload.started', data)).toThrow('Handler error');
      expect(errorHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid successive emissions', (done) => {
      const handler = jest.fn();
      emitter.on('upload.progress', handler);

      const data: UploadProgressEvent = {
        videoId: 'vid-1',
        filename: 'video.mp4',
        progress: 0,
        uploadedBytes: 0,
        totalBytes: 10485760,
      };

      for (let i = 0; i < 10; i++) {
        emitter.emit('upload.progress', { ...data, progress: i * 10 });
      }

      setTimeout(() => {
        expect(handler).toHaveBeenCalledTimes(10);
        done();
      }, 0);
    });

    it('should support listener removal during event emission', (done) => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      emitter.on('upload.started', handler1);
      emitter.on('upload.started', handler2);
      emitter.on('upload.started', handler3);

      const data: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      const result = emitter.emit('upload.started', data);

      expect(result).toBe(true);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);

      done();
    });

    it('should work correctly with maxListeners setting', () => {
      const handlers = [];
      for (let i = 0; i < 50; i++) {
        const handler = jest.fn();
        handlers.push(handler);
        emitter.on('upload.started', handler);
      }

      const count = emitter.listenerCount('upload.started');
      expect(count).toBe(50);
    });

    it('should maintain state consistency across multiple operations', (done) => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      emitter.on('upload.started', handler1);
      emitter.on('upload.progress', handler2);

      const data1: UploadStartedEvent = { videoId: 'vid-1', filename: 'video.mp4' };
      const data2: UploadProgressEvent = {
        videoId: 'vid-1',
        filename: 'video.mp4',
        progress: 50,
        uploadedBytes: 5242880,
        totalBytes: 10485760,
      };

      emitter.emit('upload.started', data1);
      expect(emitter.listenerCount('upload.started')).toBe(1);
      expect(emitter.listenerCount('upload.progress')).toBe(1);

      emitter.emit('upload.progress', data2);
      expect(emitter.listenerCount('upload.started')).toBe(1);
      expect(emitter.listenerCount('upload.progress')).toBe(1);

      emitter.off('upload.started', handler1);
      expect(emitter.listenerCount('upload.started')).toBe(0);
      expect(emitter.listenerCount('upload.progress')).toBe(1);

      setTimeout(() => {
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
        done();
      }, 0);
    });
  });
});
