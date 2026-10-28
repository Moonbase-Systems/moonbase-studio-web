<script setup lang="ts">
import type { InspectorPanelId } from '../../application/inspector-sections';
import type { SceneId } from '../../models/ids.domain';
import type { SceneElement } from '../../models/scene-element.domain';
import type { Source } from '../../models/source.domain';
import InspectorAppearanceSection from './sections/InspectorAppearanceSection.vue';
import InspectorAudioSection from './sections/InspectorAudioSection.vue';
import InspectorCropSection from './sections/InspectorCropSection.vue';
import InspectorEffectsSection from './sections/InspectorEffectsSection.vue';
import InspectorShapeSection from './sections/InspectorShapeSection.vue';
import InspectorSourceReadonlySection from './sections/InspectorSourceReadonlySection.vue';
import InspectorTextCardPanels from './sections/InspectorTextCardPanels.vue';
import InspectorTransformSection from './sections/InspectorTransformSection.vue';
import InspectorVideoPlaybackSection from './sections/InspectorVideoPlaybackSection.vue';
import InspectorVisualFitSection from './sections/InspectorVisualFitSection.vue';

defineProps<{
  sceneId: SceneId;
  element: SceneElement;
  panel: InspectorPanelId;
  linkedSource?: Source;
}>();
</script>

<template>
  <div class="contents">
    <InspectorTextCardPanels
      v-if="panel === 'textPrimary' || panel === 'textLayout' || panel === 'textStrokeFill'"
      :scene-id="sceneId"
      :element="element as Extract<SceneElement, { type: 'text' }>"
      :panel="panel"
    />
    <InspectorVisualFitSection
      v-else-if="
        panel === 'visualFit' &&
        (element.type === 'image' || element.type === 'video' || element.type === 'camera' || element.type === 'screen')
      "
      :scene-id="sceneId"
      :element="element"
      layout="compact"
      :title-key="
        element.type === 'image'
          ? 'studio.properties.sections.image'
          : element.type === 'video'
            ? 'studio.properties.sections.video'
            : element.type === 'camera'
              ? 'studio.properties.sections.camera'
              : 'studio.properties.sections.screen'
      "
    />
    <InspectorVideoPlaybackSection
      v-else-if="panel === 'videoPlayback' && element.type === 'video'"
      :scene-id="sceneId"
      :element="element"
      layout="compact"
    />
    <InspectorShapeSection
      v-else-if="panel === 'shapePrimary' && element.type === 'shape'"
      :scene-id="sceneId"
      :element="element"
      layout="compact"
    />
    <InspectorAudioSection
      v-else-if="panel === 'audioMix' && element.type === 'audioVisual'"
      :scene-id="sceneId"
      :element="element"
      layout="compact"
      part="mix"
    />
    <InspectorAudioSection
      v-else-if="panel === 'audioSync' && element.type === 'audioVisual'"
      :scene-id="sceneId"
      :element="element"
      layout="compact"
      part="sync"
    />
    <InspectorTransformSection
      v-else-if="panel === 'transform'"
      :scene-id="sceneId"
      :element="element"
      layout="compact"
    />
    <InspectorCropSection
      v-else-if="panel === 'crop'"
      :scene-id="sceneId"
      :element="element"
      layout="compact"
    />
    <InspectorAppearanceSection
      v-else-if="panel === 'appearance'"
      :scene-id="sceneId"
      :element="element"
      layout="compact"
    />
    <InspectorEffectsSection
      v-else-if="panel === 'effects'"
      :scene-id="sceneId"
      :element="element"
      layout="compact"
    />
    <InspectorSourceReadonlySection
      v-else-if="panel === 'sourceReadonly' && element.type !== 'overlay'"
      :source-id="element.sourceId"
      :source="linkedSource"
      layout="compact"
    />
  </div>
</template>
