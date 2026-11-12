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
