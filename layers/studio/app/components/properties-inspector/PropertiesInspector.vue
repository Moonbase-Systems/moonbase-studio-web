<script setup lang="ts">
import { useStudioSessionStore } from '../../store/studio-session.store';
import AnimationLayerInspector from './inspectors/AnimationLayerInspector.vue';
import AudioLayerInspector from './inspectors/AudioLayerInspector.vue';
import BrowserLayerInspector from './inspectors/BrowserLayerInspector.vue';
import CameraLayerInspector from './inspectors/CameraLayerInspector.vue';
import ImageLayerInspector from './inspectors/ImageLayerInspector.vue';
import OverlayLayerInspector from './inspectors/OverlayLayerInspector.vue';
import ScreenLayerInspector from './inspectors/ScreenLayerInspector.vue';
import ShapeLayerInspector from './inspectors/ShapeLayerInspector.vue';
import TextLayerInspector from './inspectors/TextLayerInspector.vue';
import VideoLayerInspector from './inspectors/VideoLayerInspector.vue';

const store = useStudioSessionStore();

const selectedElement = computed(() => {
  const scene = store.activeScene;
  const id = store.selectedLayerId;
  if (!scene || !id || store.selectedLayerIds.length !== 1) {
    return null;
  }
  return scene.elements.find((element) => element.id === id) ?? null;
});

const linkedSource = computed(() => {
  const element = selectedElement.value;
  if (!element || element.type === 'overlay') {
    return undefined;
  }
  const result = store.findSource(element.sourceId);
  return result.ok ? result.value : undefined;
});
</script>

<template>
  <div
    class="bg-surface p-md flex h-full min-h-0 flex-col overflow-y-auto"
    data-properties-inspector
    @pointerdown.stop
  >
    <template v-if="selectedElement && store.activeSceneId">
      <TextLayerInspector
        v-if="selectedElement.type === 'text'"
        :scene-id="store.activeSceneId"
        :element="selectedElement"
      />
      <ScreenLayerInspector
        v-else-if="selectedElement.type === 'screen'"
        :scene-id="store.activeSceneId"
        :element="selectedElement"
        :linked-source="linkedSource"
      />
      <ImageLayerInspector
        v-else-if="selectedElement.type === 'image'"
        :scene-id="store.activeSceneId"
        :element="selectedElement"
      />
      <CameraLayerInspector
        v-else-if="selectedElement.type === 'camera'"
        :scene-id="store.activeSceneId"
        :element="selectedElement"
      />
      <VideoLayerInspector
        v-else-if="selectedElement.type === 'video'"
        :scene-id="store.activeSceneId"
        :element="selectedElement"
      />
      <ShapeLayerInspector
        v-else-if="selectedElement.type === 'shape'"
        :scene-id="store.activeSceneId"
        :element="selectedElement"
      />
      <AudioLayerInspector
        v-else-if="selectedElement.type === 'audioVisual'"
        :scene-id="store.activeSceneId"
        :element="selectedElement"
      />
      <BrowserLayerInspector
        v-else-if="selectedElement.type === 'browser'"
        :scene-id="store.activeSceneId"
        :element="selectedElement"
      />
      <AnimationLayerInspector
        v-else-if="selectedElement.type === 'animation'"
        :scene-id="store.activeSceneId"
        :element="selectedElement"
      />
      <OverlayLayerInspector
        v-else-if="selectedElement.type === 'overlay'"
        :scene-id="store.activeSceneId"
        :element="selectedElement"
      />
    </template>
  </div>
</template>
