<script setup lang="ts">
import type { SceneId } from '../../../models/ids.domain';
import type { AnimationElement } from '../../../models/scene-elements';
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
  />
</template>
