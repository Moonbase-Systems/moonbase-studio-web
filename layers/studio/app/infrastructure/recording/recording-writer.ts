export type RecordingWritable = {
  write: (chunk: Blob) => Promise<void>;
  close: () => Promise<void>;
  abort: () => Promise<void>;
};

export type RecordingFileHandle = {
  createWritable: () => Promise<RecordingWritable>;
};

export type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<RecordingFileHandle>;

export type RecordingWriterSession = {
  cancelled: boolean;
  handle: RecordingFileHandle | null;
  write: (chunk: Blob) => Promise<void>;
  close: () => Promise<{ sizeBytes: number }>;
  abort: () => Promise<void>;
};

export type RecordingWriterOptions = {
  pick?: SaveFilePicker;
  download?: (blob: Blob, fileName: string) => void;
};

const isAbort = (error: unknown): boolean => error instanceof DOMException && error.name === 'AbortError';

const sessionFromHandle = async (handle: RecordingFileHandle): Promise<RecordingWriterSession> => {
  const writable = await handle.createWritable();
  let sizeBytes = 0;
  return {
    cancelled: false,
    handle,
    write: async (chunk) => {
      sizeBytes += chunk.size;
      await writable.write(chunk);
    },
    close: async () => {
      await writable.close();
      return { sizeBytes };
    },
    abort: () => writable.abort(),
  };
};

/** `showSaveFilePicker` rejects codec parameters such as `video/webm;codecs=vp9,opus`. */
export const filePickerMimeType = (mimeType: string): string => {
  const base = mimeType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (base === 'video/webm' || base === 'video/mp4') {
    return base;
  }
  return 'video/webm';
};

/**
 * Streams chunks to a chosen file when the browser can pick one.
 * Otherwise collects a Blob and downloads it. Cancelling the picker is not a save.
 */
export const beginRecordingFile = async (
  options: RecordingWriterOptions,
  file: { fileName: string; mimeType: string },
): Promise<RecordingWriterSession> => {
  if (options.pick) {
    try {
      const extension = file.fileName.split('.').pop() ?? 'webm';
      const handle = await options.pick({
        suggestedName: file.fileName,
        types: [
          {
            description: 'Recording',
            accept: { [filePickerMimeType(file.mimeType)]: [`.${extension}`] },
          },
        ],
      });
      return sessionFromHandle(handle);
    } catch (error) {
      if (isAbort(error)) {
        return cancelledSession();
      }
      throw error;
    }
  }

  const chunks: Blob[] = [];
  return {
    cancelled: false,
    handle: null,
    write: async (chunk) => {
      chunks.push(chunk);
    },
    close: async () => {
      const blob = new Blob(chunks, { type: file.mimeType });
      options.download?.(blob, file.fileName);
      return { sizeBytes: blob.size };
    },
    abort: async () => {
      chunks.length = 0;
    },
  };
};

const cancelledSession = (): RecordingWriterSession => ({
  cancelled: true,
  handle: null,
  write: async () => undefined,
  close: async () => ({ sizeBytes: 0 }),
  abort: async () => undefined,
});
