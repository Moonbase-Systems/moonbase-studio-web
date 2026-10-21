export type CommandContext = {
  generateId: () => string;
  now: () => string;
};

export const createDefaultCommandContext = (): CommandContext => ({
  generateId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
});

export const createTestCommandContext = (input?: { ids?: string[]; now?: string }): CommandContext => {
  const queue = [...(input?.ids ?? [])];
  return {
    generateId: () => {
      if (queue.length === 0) {
        throw new Error('test CommandContext: no more ids');
      }
      return queue.shift()!;
    },
    now: () => input?.now ?? '2026-01-01T00:00:00.000Z',
  };
};
