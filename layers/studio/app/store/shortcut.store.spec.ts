import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';

import { useShortcutStore } from './shortcut.store';

describe('useShortcutStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('matches configured undo and pointer bindings', () => {
    const store = useShortcutStore();
    expect(
      store.matchesKey(
        { key: 'z', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false } as KeyboardEvent,
        'history.undo',
      ),
    ).toBe(true);
    expect(
      store.matchesPointer(
        { ctrlKey: false, metaKey: false, shiftKey: true, altKey: false } as MouseEvent,
        'selection.range',
      ),
    ).toBe(true);
  });
});
