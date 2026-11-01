<script setup lang="ts">
import type { SceneId } from '../../../models/ids.domain';
import type { AudioVisualElement } from '../../../models/scene-elements';
import InspectorLayerFrame from '../InspectorLayerFrame.vue';

defineProps<{
  sceneId: SceneId;
  element: AudioVisualElement;
}>();
</script>

<template>
  <InspectorLayerFrame
    :scene-id="sceneId"
    :element="element"
  />
</template>
