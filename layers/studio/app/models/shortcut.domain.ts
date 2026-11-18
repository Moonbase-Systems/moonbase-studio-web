/** Stable action ids — referenced by UI and keyboard-shortcuts config. */
export type ShortcutActionId =
  | 'history.undo'
  | 'history.redo'
  | 'rename'
  | 'rename.commit'
  | 'rename.cancel'
  | 'reorder.up'
  | 'reorder.down'
  | 'selection.toggle'
  | 'selection.range'
  | 'document.save'
  | 'document.open'
  | 'layer.delete'
  | 'layer.duplicate'
  | 'scene.create'
  | 'scene.next'
  | 'scene.previous'
  | 'audio.toggleMute'
  | 'audio.pushToTalk'
  | 'audio.pushToMute'
  | 'layer.toggleVisibility'
  | 'layer.toggleLock'
  | 'selection.all'
  | 'layer.nudgeLeft'
  | 'layer.nudgeRight'
  | 'layer.nudgeUp'
  | 'layer.nudgeDown'
  | 'layer.nudgeLeftCoarse'
  | 'layer.nudgeRightCoarse'
  | 'layer.nudgeUpCoarse'
  | 'layer.nudgeDownCoarse'
  | 'layer.toFront'
  | 'layer.toBack'
  | 'layer.group'
  | 'layer.ungroup';

export type ShortcutModifier = 'mod' | 'shift' | 'alt' | 'ctrl' | 'meta';

export type ShortcutKeyBinding = {
  key: string;
  modifiers?: ShortcutModifier[];
};

export type ShortcutPointerBinding = {
  modifiers: ShortcutModifier[];
};

export type ShortcutBinding =
  | { kind: 'key'; actionId: ShortcutActionId; binding: ShortcutKeyBinding }
  | { kind: 'pointer'; actionId: ShortcutActionId; binding: ShortcutPointerBinding };

export type ShortcutBindingsMap = Record<ShortcutActionId, ShortcutBinding[]>;
