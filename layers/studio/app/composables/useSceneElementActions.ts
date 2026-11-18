import { inject } from 'vue';

import type { SourceDefinition } from '../application/commands/source-commands';
import type { ElementId, SceneId } from '../models/ids.domain';
import { useStudioSessionStore } from '../store/studio-session.store';
import { STUDIO_RECORDING_GUARD } from './recording-guard';

export function useSceneElementActions() {
  const store = useStudioSessionStore();

  function addElementFromDefinition(sceneId: SceneId, definition: SourceDefinition): boolean {
    const project = store.project;
    if (!project) {
      return false;
    }

    const sourceIdsBefore = new Set(project.sources.map((source) => source.id));
    const result = store.runTransaction(() => {
      const sourceResult = store.addSource(definition);
      if (!sourceResult.ok) {
        return sourceResult;
      }

      const createdSource = store.project?.sources.find((source) => !sourceIdsBefore.has(source.id));
      if (!createdSource) {
        return {
          ok: false as const,
          error: { kind: 'invalid-state' as const, reason: 'Source was not created' },
        };
      }

      return store.addLayer(sceneId, createdSource.id, { name: definition.name });
    });

    return result.ok;
  }

  const guard = inject(STUDIO_RECORDING_GUARD, null);

  async function removeElement(sceneId: SceneId, layerId: ElementId): Promise<boolean> {
    const scene = store.activeScene;
    if (scene?.id === sceneId && guard && !(await guard.allowActiveSceneChange())) {
      return false;
    }
    const result = store.removeLayer(sceneId, layerId);
    return result.ok;
  }

  return {
    addElementFromDefinition,
    removeElement,
  };
}
