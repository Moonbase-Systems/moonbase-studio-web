import type { LayerUpdateChanges } from '../application/commands/layer-commands';
import type { ElementId, SceneId } from '../models/ids.domain';
import type { SceneElement } from '../models/scene-element.domain';
import { useStudioSessionStore } from '../store/studio-session.store';

export function useElementInspectorUpdate() {
  const store = useStudioSessionStore();

  function applyUpdate(sceneId: SceneId, elementId: ElementId, changes: LayerUpdateChanges): boolean {
    const result = store.updateLayer(sceneId, elementId, changes);
    return result.ok;
  }

  function updateSettings(sceneId: SceneId, element: SceneElement, partial: Record<string, unknown>): boolean {
    if (element.type === 'overlay') {
      return false;
    }
    return applyUpdate(sceneId, element.id, { settings: partial });
  }

  return {
    applyUpdate,
    updateSettings,
  };
}
