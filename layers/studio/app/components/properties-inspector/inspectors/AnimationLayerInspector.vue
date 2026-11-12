<script setup lang="ts">
import type { SceneId } from '../../../models/ids.domain';
import type { AnimationElement } from '../../../models/scene-elements';
import InspectorCardAnimation from '../cards/InspectorCardAnimation.vue';
import InspectorAnimationPreview from '../InspectorAnimationPreview.vue';
import InspectorLayerFrame from '../InspectorLayerFrame.vue';

defineProps<{
  sceneId: SceneId;
  element: AnimationElement;
}>();
</script>

<template>
  <InspectorLayerFrame
    :scene-id="sceneId"
    :element="element"
  >
    <template #preview>
      <InspectorAnimationPreview
        :scene-id="sceneId"
        :element="element"
      />
    </template>
    <template #options>
      <InspectorCardAnimation
        :scene-id="sceneId"
        :element="element"
      />
    </template>
  </InspectorLayerFrame>
</template>
