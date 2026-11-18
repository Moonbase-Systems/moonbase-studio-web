import type { Ref } from 'vue';

import type { ChannelId } from '../models/ids.domain';
import type { ShortcutActionId } from '../models/shortcut.domain';
import { useShortcutStore } from '../store/shortcut.store';
import { useStudioSessionStore } from '../store/studio-session.store';

type Hold = {
  actionId: 'audio.pushToTalk' | 'audio.pushToMute';
  channelId: ChannelId;
  muted: boolean;
};

const NUDGE: { actionId: ShortcutActionId; x: number; y: number }[] = [
  { actionId: 'layer.nudgeLeft', x: -1, y: 0 },
  { actionId: 'layer.nudgeRight', x: 1, y: 0 },
  { actionId: 'layer.nudgeUp', x: 0, y: -1 },
  { actionId: 'layer.nudgeDown', x: 0, y: 1 },
  { actionId: 'layer.nudgeLeftCoarse', x: -10, y: 0 },
  { actionId: 'layer.nudgeRightCoarse', x: 10, y: 0 },
  { actionId: 'layer.nudgeUpCoarse', x: 0, y: -10 },
  { actionId: 'layer.nudgeDownCoarse', x: 0, y: 10 },
];

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function isDialogTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('[role="dialog"]'));
}

function canvasFocused(): boolean {
  const preview = document.querySelector('[data-scene-preview]');
  const active = document.activeElement;
  return preview instanceof HTMLElement && active instanceof Node && preview.contains(active);
}

export function useDocumentShortcuts(actions: {
  saveProject: () => void;
  openMenu: () => void;
  menuOpen: Ref<boolean>;
}) {
  const store = useStudioSessionStore();
  const shortcuts = useShortcutStore();
  let hold: Hold | null = null;

  function selectedChannelId(): ChannelId | null {
    if (store.selectedGlobalChannelId) {
      return store.selectedGlobalChannelId;
    }
    const scene = store.activeScene;
    if (!scene) {
      return null;
    }
    const selected = scene.elements.find(
      (element) => store.selectedLayerIds.includes(element.id) && element.type === 'audioVisual',
    );
    return selected?.type === 'audioVisual' ? selected.channelId : null;
  }

  function channelMuted(channelId: ChannelId): boolean | null {
    const channel = store.project?.audioMixer.channels.find((item) => item.id === channelId);
    return channel ? channel.muted : null;
  }

  function releaseHold(event: KeyboardEvent) {
    if (!hold || !shortcuts.matchesKey(event, hold.actionId)) {
      return;
    }
    store.updateAudioChannel(hold.channelId, { muted: hold.muted });
    hold = null;
  }

  function beginHold(event: KeyboardEvent, actionId: Hold['actionId'], muted: boolean) {
    const channelId = selectedChannelId();
    const previous = channelId ? channelMuted(channelId) : null;
    if (!channelId || previous === null) {
      return;
    }
    event.preventDefault();
    hold = { actionId, channelId, muted: previous };
    store.updateAudioChannel(channelId, { muted });
  }

  function nudge(dx: number, dy: number) {
    const scene = store.activeScene;
    if (!scene) {
      return;
    }
    for (const layerId of store.selectedLayerIds) {
      const element = scene.elements.find((item) => item.id === layerId);
      if (!element || element.locked) {
        continue;
      }
      store.updateLayer(scene.id, layerId, {
        transform: { x: element.transform.x + dx, y: element.transform.y + dy },
      });
    }
  }

  function moveSelection(direction: 'top' | 'bottom') {
    const sceneId = store.activeSceneId;
    if (!sceneId || store.selectedLayerIds.length === 0) {
      return;
    }
    const ids = direction === 'top' ? [...store.selectedLayerIds].reverse() : [...store.selectedLayerIds];
    for (const layerId of ids) {
      store.moveLayerRelative(sceneId, layerId, direction);
    }
  }

  function activateRelativeScene(step: 1 | -1) {
    const project = store.project;
    const sceneId = store.activeSceneId;
    if (!project || !sceneId || project.scenes.length < 2) {
      return;
    }
    const index = project.scenes.findIndex((scene) => scene.id === sceneId);
    if (index < 0) {
      return;
    }
    const next = project.scenes[(index + step + project.scenes.length) % project.scenes.length];
    if (next && next.id !== sceneId) {
      store.setActiveScene(next.id);
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (hold && (shortcuts.matchesKey(event, 'audio.pushToTalk') || shortcuts.matchesKey(event, 'audio.pushToMute'))) {
      event.preventDefault();
      return;
    }
    if (event.repeat || isEditableTarget(event.target) || isDialogTarget(event.target)) {
      return;
    }

    if (shortcuts.matchesKey(event, 'audio.pushToTalk')) {
      beginHold(event, 'audio.pushToTalk', false);
      return;
    }
    if (shortcuts.matchesKey(event, 'audio.pushToMute')) {
      beginHold(event, 'audio.pushToMute', true);
      return;
    }

    if (actions.menuOpen.value && !shortcuts.matchesKey(event, 'document.save')) {
      return;
    }

    if (shortcuts.matchesKey(event, 'document.save')) {
      event.preventDefault();
      actions.saveProject();
      return;
    }
    if (shortcuts.matchesKey(event, 'document.open')) {
      event.preventDefault();
      actions.openMenu();
      return;
    }

    const scene = store.activeScene;
    const sceneId = store.activeSceneId;
    if (!scene || !sceneId) {
      return;
    }

    if (canvasFocused()) {
      const nudgeStep = NUDGE.find((step) => shortcuts.matchesKey(event, step.actionId));
      if (nudgeStep) {
        event.preventDefault();
        nudge(nudgeStep.x, nudgeStep.y);
        return;
      }
    }

    if (shortcuts.matchesKey(event, 'layer.delete')) {
      if (store.selectedLayerIds.length === 0) {
        return;
      }
      event.preventDefault();
      store.removeLayers(sceneId, [...store.selectedLayerIds]);
      return;
    }
    if (shortcuts.matchesKey(event, 'layer.duplicate')) {
      if (store.selectedLayerIds.length === 0) {
        return;
      }
      event.preventDefault();
      for (const layerId of [...store.selectedLayerIds]) {
        store.duplicateLayer(sceneId, layerId);
      }
      return;
    }
    if (shortcuts.matchesKey(event, 'scene.create')) {
      event.preventDefault();
      store.createScene();
      return;
    }
    if (shortcuts.matchesKey(event, 'scene.next')) {
      event.preventDefault();
      activateRelativeScene(1);
      return;
    }
    if (shortcuts.matchesKey(event, 'scene.previous')) {
      event.preventDefault();
      activateRelativeScene(-1);
      return;
    }
    if (shortcuts.matchesKey(event, 'audio.toggleMute')) {
      const channelId = selectedChannelId();
      const muted = channelId ? channelMuted(channelId) : null;
      if (!channelId || muted === null) {
        return;
      }
      event.preventDefault();
      store.updateAudioChannel(channelId, { muted: !muted });
      return;
    }
    if (shortcuts.matchesKey(event, 'layer.toggleVisibility')) {
      if (store.selectedLayerIds.length === 0) {
        return;
      }
      event.preventDefault();
      for (const layerId of store.selectedLayerIds) {
        const element = scene.elements.find((item) => item.id === layerId);
        if (element) {
          store.setLayerVisibility(sceneId, layerId, !element.visibility);
        }
      }
      return;
    }
    if (shortcuts.matchesKey(event, 'layer.toggleLock')) {
      if (store.selectedLayerIds.length === 0) {
        return;
      }
      event.preventDefault();
      for (const layerId of store.selectedLayerIds) {
        const element = scene.elements.find((item) => item.id === layerId);
        if (element) {
          store.setLayerLocked(sceneId, layerId, !element.locked);
        }
      }
      return;
    }
    if (shortcuts.matchesKey(event, 'selection.all')) {
      event.preventDefault();
      store.setSelectedLayers(scene.elements.map((element) => element.id));
      return;
    }
    if (shortcuts.matchesKey(event, 'layer.toFront')) {
      if (store.selectedLayerIds.length === 0) {
        return;
      }
      event.preventDefault();
      moveSelection('top');
      return;
    }
    if (shortcuts.matchesKey(event, 'layer.toBack')) {
      if (store.selectedLayerIds.length === 0) {
        return;
      }
      event.preventDefault();
      moveSelection('bottom');
      return;
    }
    if (shortcuts.matchesKey(event, 'layer.group')) {
      if (store.selectedLayerIds.length < 2) {
        return;
      }
      event.preventDefault();
      store.createGroupFromElements(sceneId, [...store.selectedLayerIds]);
      return;
    }
    if (shortcuts.matchesKey(event, 'layer.ungroup')) {
      const parents = new Set(
        scene.elements
          .filter((element) => store.selectedLayerIds.includes(element.id) && element.parentGroupId)
          .map((element) => element.parentGroupId),
      );
      if (parents.size !== 1) {
        return;
      }
      const groupId = [...parents][0];
      if (!groupId) {
        return;
      }
      event.preventDefault();
      store.dissolveGroup(sceneId, groupId);
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    releaseHold(event);
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    if (hold) {
      store.updateAudioChannel(hold.channelId, { muted: hold.muted });
      hold = null;
    }
  });
}
