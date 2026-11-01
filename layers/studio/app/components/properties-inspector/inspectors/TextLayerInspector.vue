<script setup lang="ts">
import type { SceneId } from '../../../models/ids.domain';
import type { TextElement } from '../../../models/scene-elements';
import InspectorCardText from '../cards/InspectorCardText.vue';
import InspectorLayerFrame from '../InspectorLayerFrame.vue';
import InspectorTextPreview from '../InspectorTextPreview.vue';

defineProps<{
  sceneId: SceneId;
  element: TextElement;
}>();
</script>

<template>
  <InspectorLayerFrame
    :scene-id="sceneId"
    :element="element"
  >
    <template #preview>
      <InspectorTextPreview
        class="h-full w-full"
        :scene-id="sceneId"
        :element="element"
      />
    </template>
    <template #options>
      <InspectorCardText
        :scene-id="sceneId"
        :element="element"
      />
    </template>
  </InspectorLayerFrame>
</template>
