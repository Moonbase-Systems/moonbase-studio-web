import { describe, expect, it } from 'vitest';

import { RECORDINGS_STORE_NAME, upgradeStudioDatabase } from './indexed-db-project-backend';

describe('upgradeStudioDatabase', () => {
  it('adds a recordings store beside projects', () => {
    const names: string[] = [];
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
    };

    upgradeStudioDatabase(database as unknown as IDBDatabase);
    upgradeStudioDatabase(database as unknown as IDBDatabase);

    expect(names).toEqual(['projects', RECORDINGS_STORE_NAME]);
    expect(indexes).toEqual(['projectId']);
  });
});
