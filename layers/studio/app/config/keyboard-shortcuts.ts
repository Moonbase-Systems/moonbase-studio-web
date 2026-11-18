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
  /** Bring forward / send backward (Photoshop-style); `mod` = Ctrl on Win/Linux, Cmd on macOS. */
  { kind: 'key', actionId: 'reorder.up', binding: { key: ']', modifiers: ['mod'] } },
  { kind: 'key', actionId: 'reorder.down', binding: { key: '[', modifiers: ['mod'] } },
  { kind: 'pointer', actionId: 'selection.toggle', binding: { modifiers: ['mod'] } },
  { kind: 'pointer', actionId: 'selection.range', binding: { modifiers: ['shift'] } },
  { kind: 'key', actionId: 'document.save', binding: { key: 's', modifiers: ['mod'] } },
  { kind: 'key', actionId: 'document.open', binding: { key: 'o', modifiers: ['mod'] } },
  { kind: 'key', actionId: 'layer.delete', binding: { key: 'Delete' } },
  { kind: 'key', actionId: 'layer.duplicate', binding: { key: 'd', modifiers: ['mod'] } },
  { kind: 'key', actionId: 'scene.create', binding: { key: 'N', modifiers: ['mod', 'shift'] } },
  { kind: 'key', actionId: 'scene.next', binding: { key: 'ArrowRight', modifiers: ['mod'] } },
  { kind: 'key', actionId: 'scene.previous', binding: { key: 'ArrowLeft', modifiers: ['mod'] } },
  { kind: 'key', actionId: 'audio.toggleMute', binding: { key: 'M', modifiers: ['mod', 'shift'] } },
  { kind: 'key', actionId: 'layer.toggleVisibility', binding: { key: 'H', modifiers: ['mod', 'shift'] } },
  { kind: 'key', actionId: 'layer.toggleLock', binding: { key: 'L', modifiers: ['mod', 'shift'] } },
  { kind: 'key', actionId: 'selection.all', binding: { key: 'a', modifiers: ['mod'] } },
  { kind: 'key', actionId: 'layer.nudgeLeft', binding: { key: 'ArrowLeft' } },
  { kind: 'key', actionId: 'layer.nudgeRight', binding: { key: 'ArrowRight' } },
  { kind: 'key', actionId: 'layer.nudgeUp', binding: { key: 'ArrowUp' } },
  { kind: 'key', actionId: 'layer.nudgeDown', binding: { key: 'ArrowDown' } },
  { kind: 'key', actionId: 'layer.nudgeLeftCoarse', binding: { key: 'ArrowLeft', modifiers: ['alt'] } },
  { kind: 'key', actionId: 'layer.nudgeRightCoarse', binding: { key: 'ArrowRight', modifiers: ['alt'] } },
  { kind: 'key', actionId: 'layer.nudgeUpCoarse', binding: { key: 'ArrowUp', modifiers: ['alt'] } },
  { kind: 'key', actionId: 'layer.nudgeDownCoarse', binding: { key: 'ArrowDown', modifiers: ['alt'] } },
  { kind: 'key', actionId: 'layer.toFront', binding: { key: ']', modifiers: ['mod', 'shift'] } },
  { kind: 'key', actionId: 'layer.toBack', binding: { key: '[', modifiers: ['mod', 'shift'] } },
  { kind: 'key', actionId: 'layer.group', binding: { key: 'g', modifiers: ['mod'] } },
  { kind: 'key', actionId: 'layer.ungroup', binding: { key: 'G', modifiers: ['mod', 'shift'] } },
  /** Hold to unmute the selected preview channel, then restore the previous mute. */
  { kind: 'key', actionId: 'audio.pushToTalk', binding: { key: '`' } },
  /** Hold to mute the selected preview channel, then restore the previous mute. */
  { kind: 'key', actionId: 'audio.pushToMute', binding: { key: '\\' } },
];

export const shortcutBindingsForAction = (actionId: ShortcutActionId): ShortcutBinding[] =>
  KEYBOARD_SHORTCUT_BINDINGS.filter((item) => item.actionId === actionId);
