import { type AnimationPlayer, type AnimationPlayerState, capabilitiesForMediaKind } from './animation-player';

type VideoWithAudioProbe = HTMLVideoElement & {
  mozHasAudio?: boolean;
  audioTracks?: { length: number };
  webkitAudioDecodedByteCount?: number;
};

export function videoAudioState(video: HTMLVideoElement): 'yes' | 'no' | 'unknown' {
  const extended = video as VideoWithAudioProbe;
  if (typeof extended.mozHasAudio === 'boolean') {
    return extended.mozHasAudio ? 'yes' : 'no';
  }
  if (extended.audioTracks) {
    return extended.audioTracks.length > 0 ? 'yes' : 'no';
  }
  if (typeof extended.webkitAudioDecodedByteCount === 'number' && extended.webkitAudioDecodedByteCount > 0) {
    return 'yes';
  }
  return 'unknown';
}

export function createVideoPlayer(url: string): AnimationPlayer {
  const video = document.createElement('video');
  video.preload = 'auto';
  video.playsInline = true;
  video.muted = true;
  video.volume = 0;
  video.src = url;
  let state: AnimationPlayerState = 'idle';
  let hasAudio = false;
  const endedListeners = new Set<() => void>();

  function refreshAudio() {
    hasAudio = videoAudioState(video) === 'yes';
  }

  function onEnded() {
    state = 'ended';
    for (const listener of endedListeners) {
      listener();
    }
  }

  video.addEventListener('ended', onEnded);
  video.addEventListener('loadeddata', refreshAudio);

  return {
    kind: 'video',
    capabilities: capabilitiesForMediaKind('video'),
    element: video,
    play() {
      state = 'playing';
      void video.play().catch(() => {
        if (state === 'playing') {
          state = 'paused';
        }
      });
    },
    pause() {
      video.pause();
      state = 'paused';
    },
    stop() {
      video.pause();
      video.currentTime = 0;
      state = 'idle';
    },
    restart() {
      video.currentTime = 0;
      state = 'playing';
      void video.play().catch(() => {
        if (state === 'playing') {
          state = 'paused';
        }
      });
    },
    setRate(rate: number) {
      if (rate > 0) {
        video.playbackRate = rate;
      }
    },
    setVolume(_volume: number) {
      video.muted = true;
      video.volume = 0;
    },
    seek(ms: number) {
      if (Number.isFinite(ms) && ms >= 0) {
        video.currentTime = ms / 1000;
      }
    },
    onEnded(listener: () => void) {
      endedListeners.add(listener);
      return () => {
        endedListeners.delete(listener);
      };
    },
    dispose() {
      video.pause();
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('loadeddata', refreshAudio);
      endedListeners.clear();
      video.removeAttribute('src');
      video.load();
      video.remove();
    },
    getState: () => state,
    hasAudio: () => hasAudio,
  };
}
