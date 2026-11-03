<script setup lang="ts">
import type { SceneId } from '../../../models/ids.domain';
import type { ImageElement } from '../../../models/scene-elements';
import InspectorCardImage from '../cards/InspectorCardImage.vue';
import InspectorImagePreview from '../InspectorImagePreview.vue';
import InspectorLayerFrame from '../InspectorLayerFrame.vue';

defineProps<{
  sceneId: SceneId;
  element: ImageElement;
}>();
</script>

<template>
  <InspectorLayerFrame
    :scene-id="sceneId"
    :element="element"
  >
    <template #preview>
      <InspectorImagePreview :element="element" />
    </template>
    <template #options>
      <InspectorCardImage
        :scene-id="sceneId"
        :element="element"
      />
    </template>
  </InspectorLayerFrame>
</template>
