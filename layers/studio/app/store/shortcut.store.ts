import { defineStore } from 'pinia';
import { ref } from 'vue';

import { STORE_KEYS } from '../../../core/app/constants/store-keys';
import { matchesShortcutKey, matchesShortcutPointer } from '../application/shortcut-match';
import { KEYBOARD_SHORTCUT_BINDINGS } from '../config/keyboard-shortcuts';
import type { ShortcutActionId, ShortcutBinding } from '../models/shortcut.domain';

export const useShortcutStore = defineStore(STORE_KEYS.SHORTCUTS, () => {
  const bindings = ref<ShortcutBinding[]>([...KEYBOARD_SHORTCUT_BINDINGS]);

  function matchesKey(event: KeyboardEvent, actionId: ShortcutActionId): boolean {
    return bindings.value.some(
      (item) => item.kind === 'key' && item.actionId === actionId && matchesShortcutKey(event, item.binding),
    );
  }

  function matchesPointer(event: MouseEvent, actionId: ShortcutActionId): boolean {
    return bindings.value.some(
      (item) => item.kind === 'pointer' && item.actionId === actionId && matchesShortcutPointer(event, item.binding),
    );
  }

  return {
    bindings,
    matchesKey,
    matchesPointer,
  };
});
