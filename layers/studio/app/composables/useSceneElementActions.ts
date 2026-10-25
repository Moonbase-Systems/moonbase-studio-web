import type { SourceDefinition } from '../application/commands/source-commands';
import type { ElementId, SceneId } from '../models/ids.domain';
import { useStudioSessionStore } from '../store/studio-session.store';

export function useSceneElementActions() {
  const store = useStudioSessionStore();

  function addElementFromDefinition(sceneId: SceneId, definition: SourceDefinition): boolean {
    const project = store.project;
    if (!project) {
      return false;
    }

    const sourceIdsBefore = new Set(project.sources.map((source) => source.id));
    const sourceResult = store.addSource(definition);
    if (!sourceResult.ok) {
      return false;
    }

    const createdSource = store.project?.sources.find((source) => !sourceIdsBefore.has(source.id));
    if (!createdSource) {
      return false;
    }

    const layerResult = store.addLayer(sceneId, createdSource.id, { name: definition.name });
    return layerResult.ok;
  }

  function removeElement(sceneId: SceneId, layerId: ElementId): boolean {
    const result = store.removeLayer(sceneId, layerId);
    return result.ok;
  }

  return {
    addElementFromDefinition,
    removeElement,
  };
}
