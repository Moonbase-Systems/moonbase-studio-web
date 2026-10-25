import type { ShortcutActionId, ShortcutBinding } from '../models/shortcut.domain';

/**
 * Edit bindings here to change studio keyboard shortcuts.
 * `mod` = Ctrl on Windows/Linux, Meta (Cmd) on macOS.
 */
export const KEYBOARD_SHORTCUT_BINDINGS: ShortcutBinding[] = [
  { kind: 'key', actionId: 'history.undo', binding: { key: 'z', modifiers: ['mod'] } },
  { kind: 'key', actionId: 'history.redo', binding: { key: 'y', modifiers: ['mod'] } },
  { kind: 'key', actionId: 'rename', binding: { key: 'F2' } },
  { kind: 'key', actionId: 'rename.commit', binding: { key: 'Enter' } },
  { kind: 'key', actionId: 'rename.cancel', binding: { key: 'Escape' } },
  { kind: 'key', actionId: 'reorder.up', binding: { key: 'ArrowUp', modifiers: ['shift'] } },
  { kind: 'key', actionId: 'reorder.down', binding: { key: 'ArrowDown', modifiers: ['shift'] } },
  { kind: 'pointer', actionId: 'selection.toggle', binding: { modifiers: ['mod'] } },
  { kind: 'pointer', actionId: 'selection.range', binding: { modifiers: ['shift'] } },
];

export const shortcutBindingsForAction = (actionId: ShortcutActionId): ShortcutBinding[] =>
  KEYBOARD_SHORTCUT_BINDINGS.filter((item) => item.actionId === actionId);
