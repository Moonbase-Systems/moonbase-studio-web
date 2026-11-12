const streams = new Map<string, MediaStream>();
let activeConstraints: MediaTrackConstraints | null = null;

const applyToStream = async (stream: MediaStream, constraints: MediaTrackConstraints): Promise<void> => {
  await Promise.all(
    stream
      .getVideoTracks()
      .filter((track) => track.readyState === 'live')
      .map((track) => track.applyConstraints(constraints).catch(() => undefined)),
  );
};

export function holdScreenPreviewStream(sourceId: string, stream: MediaStream) {
  const previous = streams.get(sourceId);
  if (previous && previous !== stream) {
    for (const track of previous.getTracks()) {
      track.stop();
    }
  }
  streams.set(sourceId, stream);
  // Prefer a steady frame rate so Chromium's WGC 0 Hz path does not leave the track silent after a
  // minimise/restore. `getDisplayMedia` itself rejects `min`/`exact`; `applyConstraints` accepts ideal.
  void Promise.all(
    stream
      .getVideoTracks()
      .map((track) => track.applyConstraints({ frameRate: { ideal: 30, max: 60 } }).catch(() => undefined)),
  );
  if (activeConstraints) {
    void applyToStream(stream, activeConstraints);
  }
}

export function peekScreenPreviewStream(sourceId: string) {
  return streams.get(sourceId);
}

/** Resizes every held capture; new captures pick up the same bounds when they are held. */
export async function applyScreenCaptureConstraints(constraints: MediaTrackConstraints): Promise<void> {
  activeConstraints = constraints;
  await Promise.all([...streams.values()].map((stream) => applyToStream(stream, constraints)));
}
