/**
 * Browser voice processing chops speech and dulls music.
 * Ask for the signal as the device has it, then repeat the request on the live track.
 * Chromium often ignores the first set, and a forced mono count turns the voice path back on.
 */
const processingOff = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  voiceIsolation: false,
} as const;

export type RawAudioConstraints = MediaTrackConstraints & {
  voiceIsolation: false;
  suppressLocalAudioPlayback?: boolean;
  restrictOwnAudio?: boolean;
};

export type RawAudioTrack = {
  contentHint: string;
  applyConstraints: (constraints: MediaTrackConstraints) => Promise<void>;
};

export const rawMicrophoneConstraints = (deviceId?: string): RawAudioConstraints => ({
  ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
  ...processingOff,
});

export const rawSystemAudioConstraints = (): RawAudioConstraints => ({
  ...processingOff,
});

/** Tab audio stays out of the speakers and out of the studio's own mix. */
export const rawTabAudioConstraints = (): RawAudioConstraints => ({
  ...processingOff,
  suppressLocalAudioPlayback: true,
  restrictOwnAudio: true,
});

export async function disarmBrowserProcessing(tracks: readonly RawAudioTrack[]): Promise<void> {
  await Promise.all(
    tracks.map(async (track) => {
      track.contentHint = 'music';
      try {
        await track.applyConstraints({ ...processingOff });
      } catch {
        // The opening request already asked for this. A rejected repeat leaves that track as opened.
      }
    }),
  );
}

/** Screen or window audio. Video is required by the browser and stopped immediately. */
export async function captureSystemAudio(): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    return null;
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: rawSystemAudioConstraints(),
    });
  } catch {
    return null;
  }
  for (const track of stream.getVideoTracks()) {
    track.stop();
  }
  const audible = stream.getAudioTracks().filter((track) => track.readyState === 'live');
  if (audible.length === 0) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
    return null;
  }
  await disarmBrowserProcessing(audible);
  return stream;
}
