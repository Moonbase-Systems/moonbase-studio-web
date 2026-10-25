import { describe, expect, it } from 'vitest';

import { KEYBOARD_SHORTCUT_BINDINGS } from '../config/keyboard-shortcuts';
import type { ShortcutKeyBinding, ShortcutPointerBinding } from '../models/shortcut.domain';
import { matchesShortcutKey, matchesShortcutPointer } from './shortcut-match';

const keyBinding = (actionId: string): ShortcutKeyBinding => {
  const item = KEYBOARD_SHORTCUT_BINDINGS.find((entry) => entry.kind === 'key' && entry.actionId === actionId);
  if (!item || item.kind !== 'key') {
    throw new Error(`Missing key binding for ${actionId}`);
  }
  return item.binding;
};

const pointerBinding = (actionId: string): ShortcutPointerBinding => {
  const item = KEYBOARD_SHORTCUT_BINDINGS.find((entry) => entry.kind === 'pointer' && entry.actionId === actionId);
  if (!item || item.kind !== 'pointer') {
    throw new Error(`Missing pointer binding for ${actionId}`);
  }
  return item.binding;
};

const keyboardEvent = (init: KeyboardEventInit): KeyboardEvent =>
  ({
    key: init.key ?? '',
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
  }) as KeyboardEvent;

const mouseEvent = (init: MouseEventInit): MouseEvent =>
  ({
    ctrlKey: init.ctrlKey ?? false,
    metaKey: init.metaKey ?? false,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
  }) as MouseEvent;

describe('shortcut-match', () => {
  it('matches mod+z for undo', () => {
    expect(matchesShortcutKey(keyboardEvent({ key: 'z', ctrlKey: true }), keyBinding('history.undo'))).toBe(true);
  });

  it('matches meta+z for undo', () => {
    expect(matchesShortcutKey(keyboardEvent({ key: 'z', metaKey: true }), keyBinding('history.undo'))).toBe(true);
  });

  it('matches shift+arrow for reorder', () => {
    expect(matchesShortcutKey(keyboardEvent({ key: 'ArrowUp', shiftKey: true }), keyBinding('reorder.up'))).toBe(true);
  });

  it('rejects F2 with shift held', () => {
    expect(matchesShortcutKey(keyboardEvent({ key: 'F2', shiftKey: true }), keyBinding('rename'))).toBe(false);
  });

  it('matches mod+click for selection toggle', () => {
    expect(matchesShortcutPointer(mouseEvent({ ctrlKey: true }), pointerBinding('selection.toggle'))).toBe(true);
  });
});
