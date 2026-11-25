export type AssetByteRecord = {
  projectId: string;
  key: string;
  mimeType: string;
  bytes: Blob;
};

/** Bytes for `storageKey` assets. The project JSON stays in the project store. */
export type AssetByteStore = {
  list(projectId: string): Promise<AssetByteRecord[]>;
  put(record: AssetByteRecord): Promise<void>;
  remove(projectId: string, key: string): Promise<void>;
  removeProject(projectId: string): Promise<void>;
};

export const createMemoryAssetByteStore = (): AssetByteStore => {
  const records = new Map<string, AssetByteRecord>();
  const id = (projectId: string, key: string) => `${projectId}\0${key}`;
  return {
    async list(projectId) {
      return [...records.values()].filter((record) => record.projectId === projectId);
    },
    async put(record) {
      records.set(id(record.projectId, record.key), record);
    },
    async remove(projectId, key) {
      records.delete(id(projectId, key));
    },
    async removeProject(projectId) {
      for (const [recordId, record] of records) {
        if (record.projectId === projectId) {
          records.delete(recordId);
        }
      }
    },
  };
};
