import type { ProjectFileBackend } from '../application/scene-repository';
import type { ProjectId } from '../models/ids.domain';
import type { ProjectFile } from '../models/project.domain';

const DB_NAME = 'moonbase-studio';
const STORE_NAME = 'projects';
const DB_VERSION = 1;

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });

const withStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
): Promise<T> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, mode);
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
    const store = transaction.objectStore(STORE_NAME);
    const result = await run(store);
    const value = result instanceof IDBRequest ? await requestToPromise(result) : await result;
    await done;
    return value;
  } finally {
    database.close();
  }
};

export const createIndexedDbProjectBackend = (): ProjectFileBackend => ({
  get(id: ProjectId) {
    return withStore('readonly', (store) => store.get(id));
  },

  put(file: ProjectFile) {
    return withStore('readwrite', async (store) => {
      await requestToPromise(store.put(file, file.project.id));
    });
  },

  list() {
    return withStore('readonly', (store) => store.getAll());
  },

  remove(id: ProjectId) {
    return withStore('readwrite', async (store) => {
      await requestToPromise(store.delete(id));
    });
  },
});
