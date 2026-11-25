import { describe, expect, it } from 'vitest';

import { ASSETS_STORE_NAME, RECORDINGS_STORE_NAME, upgradeStudioDatabase } from './indexed-db-project-backend';

describe('upgradeStudioDatabase', () => {
  const databaseWith = (initial: string[]) => {
    const names = [...initial];
    const indexes: string[] = [];
    const database = {
      objectStoreNames: {
        contains: (name: string) => names.includes(name),
      },
      createObjectStore: (name: string) => {
        names.push(name);
        return {
          createIndex: (indexName: string) => {
            indexes.push(indexName);
          },
        };
      },
      deleteObjectStore: (name: string) => {
        const index = names.indexOf(name);
        if (index >= 0) {
          names.splice(index, 1);
        }
      },
    };
    return { database, names, indexes };
  };

  it('adds a recordings store beside projects', () => {
    const { database, names, indexes } = databaseWith([]);

    upgradeStudioDatabase(database as unknown as IDBDatabase);
    upgradeStudioDatabase(database as unknown as IDBDatabase);

    expect(names).toEqual(['projects', RECORDINGS_STORE_NAME, ASSETS_STORE_NAME]);
    expect(indexes).toEqual(['projectId', 'projectId']);
  });

  it('drops a directory store left by an earlier preview', () => {
    const { database, names } = databaseWith(['projects', RECORDINGS_STORE_NAME, 'recording-directory']);

    upgradeStudioDatabase(database as unknown as IDBDatabase);

    expect(names).toEqual(['projects', RECORDINGS_STORE_NAME, ASSETS_STORE_NAME]);
  });
});
