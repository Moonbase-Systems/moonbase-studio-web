<script setup lang="ts">
import type { SceneId } from '../../../models/ids.domain';
import type { AudioVisualElement } from '../../../models/scene-elements';
import InspectorAudioPreview from '../InspectorAudioPreview.vue';
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
  >
    <template #preview>
      <InspectorAudioPreview
        class="w-full"
        :scene-id="sceneId"
        :element="element"
      />
    </template>
  </InspectorLayerFrame>
</template>
