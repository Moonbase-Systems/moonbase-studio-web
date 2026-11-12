import type { Transform2D } from '../models/common.domain';
import type { ElementId, SceneId, SourceId } from '../models/ids.domain';
import { fitBoxToPicture, type Size } from '../playback/scene-element-gesture';
import { useStudioSessionStore } from '../store/studio-session.store';

export type PictureFraming = 'contain' | 'keep-longest';

/** Keeps screen layer boxes in the proportions of the window they capture. */
export function useScreenLayerFraming() {
  const store = useStudioSessionStore();

  function fitLayersToPicture(sourceId: SourceId, picture: Size, framing: PictureFraming): void {
    const project = store.project;
    if (!project) {
      return;
    }
    const fits: { sceneId: SceneId; elementId: ElementId; transform: Transform2D }[] = [];
    for (const scene of project.scenes) {
      for (const element of scene.elements) {
        if (element.type !== 'screen' || element.sourceId !== sourceId || element.locked) {
          continue;
        }
        const transform = fitBoxToPicture(element.transform, element.crop, picture, framing);
        if (transform) {
          fits.push({ sceneId: scene.id, elementId: element.id, transform });
        }
      }
    }
    if (fits.length === 0) {
      return;
    }
    store.runTransaction(() => {
      let result: ReturnType<typeof store.updateLayer> | undefined;
      for (const fit of fits) {
        result = store.updateLayer(fit.sceneId, fit.elementId, { transform: fit.transform });
        if (!result.ok) {
          return result;
        }
      }
      return result;
    });
  }

  return { fitLayersToPicture };
}
