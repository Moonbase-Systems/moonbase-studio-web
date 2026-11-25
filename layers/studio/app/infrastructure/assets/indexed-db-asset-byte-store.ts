import { ASSETS_STORE_NAME, openStudioDatabase, requestToPromise } from '../indexed-db-project-backend';
import type { AssetByteRecord, AssetByteStore } from './asset-byte-store';

const withAssets = async <T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T>): Promise<T> => {
  const database = await openStudioDatabase();
  try {
    const transaction = database.transaction(ASSETS_STORE_NAME, mode);
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
    const value = await run(transaction.objectStore(ASSETS_STORE_NAME));
    await done;
    return value;
  } finally {
    database.close();
  }
};

export const createIndexedDbAssetByteStore = (): AssetByteStore => ({
  list(projectId) {
    return withAssets('readonly', async (store) => {
      const records = await requestToPromise(store.index('projectId').getAll(projectId));
      return records as AssetByteRecord[];
    });
  },

  put(record) {
    return withAssets('readwrite', async (store) => {
      await requestToPromise(store.put(record));
    });
  },

  remove(projectId, key) {
    return withAssets('readwrite', async (store) => {
      await requestToPromise(store.delete([projectId, key]));
    });
  },

  removeProject(projectId) {
    return withAssets('readwrite', async (store) => {
      const keys = await requestToPromise(store.index('projectId').getAllKeys(projectId));
      for (const key of keys) {
        await requestToPromise(store.delete(key));
      }
    });
  },
});
