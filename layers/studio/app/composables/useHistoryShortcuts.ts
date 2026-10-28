import { useShortcutStore } from '../store/shortcut.store';
import { useStudioSessionStore } from '../store/studio-session.store';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest('input, textarea, [contenteditable="true"]'));
}

export function useHistoryShortcuts() {
  const store = useStudioSessionStore();
  const shortcuts = useShortcutStore();

  function onKeyDown(event: KeyboardEvent) {
    if (isEditableTarget(event.target)) {
      return;
    }
    if (shortcuts.matchesKey(event, 'history.undo')) {
      if (!store.canUndo) {
        return;
      }
      event.preventDefault();
      store.undo();
      return;
    }
    if (shortcuts.matchesKey(event, 'history.redo')) {
      if (!store.canRedo) {
        return;
      }
      event.preventDefault();
      store.redo();
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown);
  });
}
