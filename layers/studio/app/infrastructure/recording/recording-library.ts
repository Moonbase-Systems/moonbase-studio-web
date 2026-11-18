import { openStudioDatabase, RECORDINGS_STORE_NAME, requestToPromise } from '../indexed-db-project-backend';
import type { RecordingRecord } from './recording-record';

const canStoreHandle = (handle: unknown): boolean =>
  typeof FileSystemFileHandle !== 'undefined' && handle instanceof FileSystemFileHandle;

export const createRecordingLibrary = () => ({
  async add(record: RecordingRecord): Promise<void> {
    const stored: RecordingRecord = canStoreHandle(record.fileHandle) ? record : { ...record, fileHandle: undefined };
    const database = await openStudioDatabase();
    try {
      const transaction = database.transaction(RECORDINGS_STORE_NAME, 'readwrite');
      const done = new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
        transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
      });
      await requestToPromise(transaction.objectStore(RECORDINGS_STORE_NAME).put(stored));
      await done;
    } finally {
      database.close();
    }
  },

  async listByProject(projectId: string): Promise<RecordingRecord[]> {
    const database = await openStudioDatabase();
    try {
      const transaction = database.transaction(RECORDINGS_STORE_NAME, 'readonly');
      const records = await requestToPromise(transaction.objectStore(RECORDINGS_STORE_NAME).getAll());
      return (records as RecordingRecord[])
        .filter((record) => record.projectId === projectId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } finally {
      database.close();
    }
  },
});
