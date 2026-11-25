export type RecordingContainer = 'auto' | 'webm' | 'mp4';

export type RecordingMime = {
  mimeType: string;
  extension: string;
};

/** First supported type wins. Extension follows the chosen container. */
export const RECORDING_MIME_CANDIDATES: readonly RecordingMime[] = [
  { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
  { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' },
];

/** `auto` keeps the candidate order. A chosen container uses only that extension. */
export const chooseRecordingMime = (
  isTypeSupported: (mimeType: string) => boolean,
  container: RecordingContainer = 'auto',
): RecordingMime | null => {
  const candidates =
    container === 'auto'
      ? RECORDING_MIME_CANDIDATES
      : RECORDING_MIME_CANDIDATES.filter((candidate) => candidate.extension === container);
  return candidates.find((candidate) => isTypeSupported(candidate.mimeType)) ?? null;
};

export const containerSupported = (
  isTypeSupported: (mimeType: string) => boolean,
  container: Exclude<RecordingContainer, 'auto'>,
): boolean => chooseRecordingMime(isTypeSupported, container) !== null;
