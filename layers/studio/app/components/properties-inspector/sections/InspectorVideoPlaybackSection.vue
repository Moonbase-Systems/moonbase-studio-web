<script setup lang="ts">
import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../../models/ids.domain';
import type { VideoElement } from '../../../models/scene-elements';
import { inspectorInputClass } from '../inspector-input-class';
import InspectorField from '../InspectorField.vue';
import InspectorSection from '../InspectorSection.vue';

const props = withDefaults(
  defineProps<{
    sceneId: SceneId;
    element: VideoElement;
    layout?: 'default' | 'compact';
  }>(),
  { layout: 'default' },
);

const { t } = useI18n();
const { updateSettings } = useElementInspectorUpdate();

function setBool(key: 'loop' | 'autoplay' | 'restartOnSceneActivate' | 'muted', checked: boolean) {
  updateSettings(props.sceneId, props.element, { [key]: checked });
}

function setNumber(key: 'playbackRate' | 'volume' | 'startTime', raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  updateSettings(props.sceneId, props.element, { [key]: value });
}

function setVolumeSlider(raw: string) {
  setNumber('volume', raw);
}
</script>

<template>
  <div
    v-if="layout === 'compact'"
    class="gap-md contents"
  >
    <label class="gap-x-sm pb-xx-sm flex cursor-pointer items-end">
      <input
        type="checkbox"
        :checked="element.settings.loop"
        @change="setBool('loop', ($event.target as HTMLInputElement).checked)"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.loop') }}</span>
    </label>
    <label class="gap-x-sm pb-xx-sm flex cursor-pointer items-end">
      <input
        type="checkbox"
        :checked="element.settings.muted"
        @change="setBool('muted', ($event.target as HTMLInputElement).checked)"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.muted') }}</span>
    </label>
    <InspectorField
      :label="t('studio.properties.fields.volume')"
      inline
      class="min-w-[10rem] flex-1"
    >
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="element.settings.volume"
        class="accent-accent w-full"
        @change="setVolumeSlider(($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <InspectorField
      :label="t('studio.properties.fields.playbackRate')"
      inline
      class="w-[6rem]"
    >
      <input
        type="number"
        min="0.01"
        step="0.05"
        :value="element.settings.playbackRate"
        :class="inspectorInputClass"
        @change="setNumber('playbackRate', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
  </div>
  <InspectorSection
    v-else
    :title="t('studio.properties.sections.videoPlayback')"
  >
    <label class="gap-x-sm flex cursor-pointer items-center">
      <input
        type="checkbox"
        :checked="element.settings.loop"
        @change="setBool('loop', ($event.target as HTMLInputElement).checked)"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.loop') }}</span>
    </label>
    <label class="gap-x-sm flex cursor-pointer items-center">
      <input
        type="checkbox"
        :checked="element.settings.autoplay"
        @change="setBool('autoplay', ($event.target as HTMLInputElement).checked)"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.autoplay') }}</span>
    </label>
    <label class="gap-x-sm flex cursor-pointer items-center">
      <input
        type="checkbox"
        :checked="element.settings.restartOnSceneActivate"
        @change="setBool('restartOnSceneActivate', ($event.target as HTMLInputElement).checked)"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.restartOnSceneActivate') }}</span>
    </label>
    <InspectorField :label="t('studio.properties.fields.playbackRate')">
      <input
        type="number"
        min="0.01"
        step="0.05"
        :value="element.settings.playbackRate"
        :class="inspectorInputClass"
        @change="setNumber('playbackRate', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <label class="gap-x-sm flex cursor-pointer items-center">
      <input
        type="checkbox"
        :checked="element.settings.muted"
        @change="setBool('muted', ($event.target as HTMLInputElement).checked)"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.muted') }}</span>
    </label>
    <InspectorField :label="t('studio.properties.fields.volume')">
      <input
        type="number"
        min="0"
        max="1"
        step="0.01"
        :value="element.settings.volume"
        :class="inspectorInputClass"
        @change="setNumber('volume', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <InspectorField :label="t('studio.properties.fields.startTime')">
      <input
        type="number"
        min="0"
        step="0.1"
        :value="element.settings.startTime"
        :class="inspectorInputClass"
        @change="setNumber('startTime', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
  </InspectorSection>
</template>
