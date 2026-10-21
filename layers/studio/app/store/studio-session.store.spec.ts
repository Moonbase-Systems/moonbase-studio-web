import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useStudioSessionStore } from './studio-session.store';

describe('useStudioSessionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('exposes session computed state and delegates actions', () => {
    const store = useStudioSessionStore();
    expect(store.isInitialized).toBe(false);

    expect(store.initialize().ok).toBe(true);
    expect(store.isInitialized).toBe(true);

    const created = store.createProject({ name: 'From Store' });
    expect(created.ok).toBe(true);
    expect(store.project?.name).toBe('From Store');
    expect(store.activeSceneId).toBeTruthy();
    expect(store.isDirty).toBe(false);
  });
});
