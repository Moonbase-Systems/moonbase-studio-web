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

export const chooseRecordingMime = (isTypeSupported: (mimeType: string) => boolean): RecordingMime | null =>
  RECORDING_MIME_CANDIDATES.find((candidate) => isTypeSupported(candidate.mimeType)) ?? null;
