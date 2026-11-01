import type { InspectorRailId } from '../../application/inspector-sections';
import type { SceneElementType } from '../../models/scene-element.domain';
import { sceneElementTypeIconName } from '../scene-element-list/scene-element-type-icons';

export function inspectorRailIcon(
  type: SceneElementType,
  railId: InspectorRailId,
): { maskUrl?: string; icon?: string } {
  if (railId === 'transform') {
    return { maskUrl: '/inspector-icons/rail-transform.svg' };
  }
  if (railId === 'effects') {
    return { maskUrl: '/inspector-icons/rail-effects.svg' };
  }
  if (type === 'text') {
    return { maskUrl: '/inspector-icons/type-text.svg' };
  }
  if (type === 'screen') {
    return { maskUrl: '/inspector-icons/type-screen.svg' };
  }
  return { icon: sceneElementTypeIconName(type) };
}
