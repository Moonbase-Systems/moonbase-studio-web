/** Library row. Media bytes stay in the file, never on the project document. */
export type RecordingRecord = {
  id: string;
  projectId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationMs: number;
  width: number;
  height: number;
  frameRate: number;
  createdAt: string;
  fileHandle?: unknown;
};

export const createRecordingRecord = (
  input: Omit<RecordingRecord, 'fileHandle'> & { fileHandle?: unknown },
): RecordingRecord => ({
  id: input.id,
  projectId: input.projectId,
  fileName: input.fileName,
  mimeType: input.mimeType,
  sizeBytes: input.sizeBytes,
  durationMs: input.durationMs,
  width: input.width,
  height: input.height,
  frameRate: input.frameRate,
  createdAt: input.createdAt,
  ...(input.fileHandle ? { fileHandle: input.fileHandle } : {}),
});

export const recordingRecordKeepsMedia = (record: RecordingRecord): boolean =>
  'blob' in record || 'chunks' in record || 'mediaRecorder' in record;
