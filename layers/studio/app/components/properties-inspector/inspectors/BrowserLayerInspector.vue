<script setup lang="ts">
import type { SceneId } from '../../../models/ids.domain';
import type { BrowserElement } from '../../../models/scene-elements';
import InspectorCardBrowser from '../cards/InspectorCardBrowser.vue';
import InspectorBrowserPreview from '../InspectorBrowserPreview.vue';
import InspectorLayerFrame from '../InspectorLayerFrame.vue';

defineProps<{
  sceneId: SceneId;
  element: BrowserElement;
}>();
</script>

<template>
  <InspectorLayerFrame
    :scene-id="sceneId"
    :element="element"
  >
    <template #preview>
      <InspectorBrowserPreview :element="element" />
    </template>
    <template #options>
      <InspectorCardBrowser :element="element" />
    </template>
  </InspectorLayerFrame>
</template>
