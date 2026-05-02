# Video Playback & List Auto-Refresh Design

**Date**: 2026-04-28
**Feature**: Add video preview/playback after upload and auto-update video list when uploads complete

## Overview

This design adds two complementary features to the streaming-platform-upload service:
1. **Video Playback Modal** — Users can click any video in the list to open a modal with HTML5 player
2. **Auto-Refresh List** — When an upload completes, the video list automatically refreshes to show the new video

Both features work together to create a seamless upload-and-preview workflow.

## Requirements

### Functional
- Users can click on a video card to open a playback modal
- Modal displays the video using native HTML5 `<video>` element
- Modal shows video filename as title
- Modal has a close button (X) to dismiss
- When UploadArea completes an upload (status = 'ready'), VideoList automatically fetches and displays the new video
- Video URL streams directly from MinIO (already provided by Event Gateway API)

### Non-Functional
- No new npm dependencies (use React built-ins only)
- Modal is responsive and centered on screen
- Minimal visual footprint — doesn't clutter the admin interface

## Architecture

### Component Hierarchy
```
page.tsx
├── UploadArea (unchanged)
├── VideoList (enhanced)
│   └── VideoModal (new)
└── VideoEventContext (new, at page level)
```

### Event System: VideoEventContext

A lightweight React Context that provides pub/sub functionality:

**Provider** (at page level):
- Exposes an `emitUploadComplete()` function
- Provides `onUploadComplete` event that consumers can subscribe to

**Consumer** (VideoList):
- Subscribes to `onUploadComplete` event
- Calls `fetchVideos()` when event fires
- Re-renders with fresh video list

**Emitter** (UploadArea):
- After completing an upload (status = 'ready'), calls `emitUploadComplete()`

**Why Context over other approaches?**
- Avoids prop drilling
- No external dependencies
- Simple to reason about
- Sufficient for this use case (no complex async requirements)

### VideoModal Component

**Responsibilities:**
- Display a modal overlay centered on screen
- Render HTML5 `<video>` element with controls
- Show video filename as modal title
- Provide close button (X)
- Handle opening/closing via parent state

**Props:**
```typescript
interface VideoModalProps {
  isOpen: boolean;
  videoUrl: string;
  videoName: string;
  onClose: () => void;
}
```

**Styling:**
- Modal positioned fixed/absolute, centered
- Backdrop semi-transparent dark overlay
- Close button in top-right corner
- Video player responsive, maintains aspect ratio

### VideoList Enhancements

**Changes:**
1. Add `selectedVideo` state to track which video to display in modal
2. Add event subscription in `useEffect` to listen for `onUploadComplete`
3. Pass `setSelectedVideo` callback to video cards as click handler
4. Render `<VideoModal>` with current `selectedVideo`
5. Call `fetchVideos()` when upload-complete event fires

**Flow:**
```
User clicks video card
  → setSelectedVideo(video)
  → VideoModal renders with video.url and video.originalName

User clicks modal close or clicks backdrop
  → setSelectedVideo(null)
  → VideoModal closes

Upload completes in UploadArea
  → emitUploadComplete()
  → VideoList receives event via context
  → fetchVideos() runs
  → setVideos() updates with fresh list
  → New video appears in grid
```

### UploadArea Enhancements

**Changes:**
1. Import and use VideoEventContext
2. After upload completes (when status becomes 'ready'), call `emitUploadComplete()`

**Minimal change** — just one function call after line 72 (after status set to 'ready')

## Data Flow

```
UploadArea
  │
  ├─ Completes upload
  │  └─ setStatus(videoId, { status: 'ready' })
  │     └─ emitUploadComplete() ← NEW
  │
  └─→ VideoEventContext
       │
       └─→ onUploadComplete event fires
            │
            └─→ VideoList subscription receives event
                 │
                 ├─ fetchVideos()
                 │  └─ GET /api/videos
                 │     └─ Returns: { videos: [...newVideo] }
                 │
                 └─ setVideos(data.videos)
                    └─ VideoList re-renders with new video in grid

User clicks video
  │
  └─→ setSelectedVideo(video)
       │
       └─→ VideoModal opens
            │
            └─ <video src={video.url} controls />
```

## Implementation Plan Outline

1. **Create VideoEventContext** (`lib/context/VideoEventContext.tsx`)
   - Define context type
   - Create provider component
   - Export useVideoEvents hook

2. **Create VideoModal** (`components/VideoModal.tsx`)
   - Simple modal overlay
   - HTML5 video player
   - Close button

3. **Wrap page with VideoEventContext** (`app/page.tsx`)
   - Import provider
   - Wrap content

4. **Update UploadArea** (`components/UploadArea.tsx`)
   - Import useVideoEvents hook
   - Call emitUploadComplete() on upload success

5. **Update VideoList** (`components/VideoList.tsx`)
   - Import useVideoEvents hook
   - Add selectedVideo state
   - Subscribe to upload-complete event
   - Add click handler to video cards
   - Render VideoModal

6. **Add CSS**
   - VideoModal.module.css (modal styling)
   - Update VideoList.module.css (click cursor on cards)

## Testing Strategy

**Manual Testing:**
1. Upload a video → confirm it appears in list
2. Click video card → modal opens with correct video
3. Play video → HTML5 controls work
4. Close modal → backdrop click closes, X button closes
5. Upload multiple videos → each one appears in list as it completes

**Not required for this design:**
- Unit tests (can be added later)
- E2E tests (straightforward integration, manual testing sufficient)

## Considerations

### Why HTML5 over Video.js?
- No external dependencies
- Admin platform, simple playback needs
- If transcoding/HLS support needed later, can upgrade to HLS.js without major refactoring

### Why Context over Redux/Zustand?
- Scope: Only two components need to communicate
- Simplicity: Built into React, no learning curve
- Can migrate to global state later if needed

### Video URL source
- Event Gateway `/api/v1/videos` already returns presigned URLs from MinIO
- These URLs are S3-compatible with expiration
- No additional backend work needed

### Potential future enhancements
- Video duration display
- Direct link/share button for video URL
- Keyboard shortcuts (Esc to close modal)
- Fullscreen button on player
- Not in scope for this design

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/context/VideoEventContext.tsx` | Create | Event system |
| `src/components/VideoModal.tsx` | Create | Playback modal |
| `src/components/VideoModal.module.css` | Create | Modal styling |
| `src/app/page.tsx` | Modify | Wrap with context |
| `src/components/UploadArea.tsx` | Modify | Emit event on complete |
| `src/components/VideoList.tsx` | Modify | Listen to event, show modal |
| `src/components/VideoList.module.css` | Modify | Add cursor pointer to cards |

## Scope Notes

**Included:**
- Click to play any video
- Auto-refresh list on upload
- HTML5 player with browser controls
- Simple modal UI

**Not included:**
- Transcoding status display
- Advanced player features
- Full-screen mode
- Keyboard shortcuts
- Thumbnail preview generation
- Duration display

These can be added as follow-up features without architectural changes.
