// Global registry linking VideoTrack ids -> HTMLVideoElement instances
// so playback (play/pause/seek) driven by the timeline can be synced
// across all VideoProjector3D components without prop drilling.

const elements = new Map<string, HTMLVideoElement>();

export const registerVideoElement = (trackId: string, el: HTMLVideoElement) => {
  elements.set(trackId, el);
};

export const unregisterVideoElement = (trackId: string, el: HTMLVideoElement) => {
  if (elements.get(trackId) === el) elements.delete(trackId);
};

export const getVideoElement = (trackId: string): HTMLVideoElement | undefined => {
  return elements.get(trackId);
};

/** Sync every registered video element to the timeline state. */
export const syncAllVideos = (currentTimeMs: number, isPlaying: boolean) => {
  const t = currentTimeMs / 1000;
  elements.forEach((el) => {
    if (!el.duration || isNaN(el.duration)) return;
    const clamped = Math.max(0, Math.min(el.duration, t));
    // Only re-seek if significantly out of sync (avoid stutter)
    if (Math.abs(el.currentTime - clamped) > 0.15) {
      try { el.currentTime = clamped; } catch { /* ignore seek errors */ }
    }
    if (isPlaying) {
      if (el.paused) el.play().catch(() => {});
    } else {
      if (!el.paused) el.pause();
    }
  });
};