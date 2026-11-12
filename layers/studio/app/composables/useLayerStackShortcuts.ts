import { useShortcutStore } from '../store/shortcut.store';
import { useStudioSessionStore } from '../store/studio-session.store';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest('input, textarea, [contenteditable="true"]'));
}

/** Ctrl/Cmd + [ ] moves the selected layer(s) down/up in the stack from anywhere in the studio. */
export function useLayerStackShortcuts() {
  const store = useStudioSessionStore();
  const shortcuts = useShortcutStore();

  function moveSelected(direction: 'up' | 'down') {
    const sceneId = store.activeSceneId;
    if (!sceneId || store.selectedLayerIds.length === 0) {
      return;
    }
    const ids = direction === 'up' ? [...store.selectedLayerIds].reverse() : [...store.selectedLayerIds];
    for (const elementId of ids) {
      store.moveLayerRelative(sceneId, elementId, direction);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (isEditableTarget(event.target)) {
      return;
    }
    if (store.selectedLayerIds.length === 0) {
      return;
    }
    if (shortcuts.matchesKey(event, 'reorder.up')) {
      event.preventDefault();
      moveSelected('up');
      return;
    }
    if (shortcuts.matchesKey(event, 'reorder.down')) {
      event.preventDefault();
      moveSelected('down');
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown);
  });
}
