const streams = new Map<string, MediaStream>();

export function holdAudioPreviewStream(key: string, stream: MediaStream) {
  const previous = streams.get(key);
  if (previous && previous !== stream) {
    for (const track of previous.getTracks()) {
      track.stop();
    }
  }
  streams.set(key, stream);
}

export function peekAudioPreviewStream(key: string) {
  return streams.get(key);
}
