<script setup lang="ts">
import type { SceneId } from '../../../models/ids.domain';
import type { ShapeElement } from '../../../models/scene-elements';
import InspectorCardShape from '../cards/InspectorCardShape.vue';
import InspectorLayerFrame from '../InspectorLayerFrame.vue';
import InspectorShapePreview from '../InspectorShapePreview.vue';

defineProps<{
  sceneId: SceneId;
  element: ShapeElement;
}>();
</script>

<template>
  <InspectorLayerFrame
    :scene-id="sceneId"
    :element="element"
  >
    <template #preview>
      <InspectorShapePreview :element="element" />
    </template>
    <template #options>
      <InspectorCardShape
        :scene-id="sceneId"
        :element="element"
      />
    </template>
  </InspectorLayerFrame>
</template>
