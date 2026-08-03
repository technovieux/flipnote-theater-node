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

/** Tracks that currently have their video visible (inside their keyframe window). */
const activeTracks = new Set<string>();

/** True when the track's video should be displayed (black screen otherwise). */
export const isVideoTrackActive = (trackId: string): boolean => activeTracks.has(trackId);

/**
 * Sync every registered video element to the timeline state.
 * `startTimes` maps a track id to the ms offset of its unique projector keyframe:
 * before that time (or after the video ends) the projector shows a black screen.
 */
export const syncAllVideos = (
  currentTimeMs: number,
  isPlaying: boolean,
  startTimes: Record<string, number | undefined> = {},
) => {
  elements.forEach((el, trackId) => {
    if (!el.duration || isNaN(el.duration)) return;
    const start = startTimes[trackId];
    // No keyframe on this projector -> nothing is projected.
    if (start === undefined) {
      activeTracks.delete(trackId);
      if (!el.paused) el.pause();
      return;
    }
    const local = (currentTimeMs - start) / 1000;
    if (local < 0 || local > el.duration) {
      activeTracks.delete(trackId);
      if (!el.paused) el.pause();
      if (local < 0 && el.currentTime !== 0) {
        try { el.currentTime = 0; } catch { /* ignore seek errors */ }
      }
      return;
    }
    activeTracks.add(trackId);
    const clamped = Math.max(0, Math.min(el.duration, local));
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