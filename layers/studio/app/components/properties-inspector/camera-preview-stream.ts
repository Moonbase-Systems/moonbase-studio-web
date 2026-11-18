const streams = new Map<string, MediaStream>();
const devices = new Map<string, string>();

/** One camera stream per source. Replacing it stops the previous tracks. */
export function holdCameraPreviewStream(sourceId: string, deviceId: string, stream: MediaStream): void {
  const previous = streams.get(sourceId);
  if (previous && previous !== stream) {
    for (const track of previous.getTracks()) {
      track.stop();
    }
  }
  streams.set(sourceId, stream);
  devices.set(sourceId, deviceId);
  for (const track of stream.getVideoTracks()) {
    track.addEventListener('ended', () => {
      if (streams.get(sourceId) === stream) {
        streams.delete(sourceId);
        devices.delete(sourceId);
      }
    });
  }
}

export function peekCameraPreviewStream(sourceId: string): MediaStream | null {
  return streams.get(sourceId) ?? null;
}

export function cameraPreviewDeviceId(sourceId: string): string | null {
  return devices.get(sourceId) ?? null;
}

export function releaseCameraPreviewStreams(): void {
  for (const stream of streams.values()) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }
  streams.clear();
  devices.clear();
}
