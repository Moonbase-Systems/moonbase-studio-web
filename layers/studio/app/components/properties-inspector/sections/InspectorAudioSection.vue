<script setup lang="ts">
import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../../models/ids.domain';
import type { AudioVisualElement } from '../../../models/scene-elements';
import { inspectorInputClass } from '../inspector-input-class';
import InspectorField from '../InspectorField.vue';
import InspectorSection from '../InspectorSection.vue';

const props = withDefaults(
  defineProps<{
    sceneId: SceneId;
    element: AudioVisualElement;
    layout?: 'default' | 'compact';
    part?: 'all' | 'mix' | 'sync';
  }>(),
  { layout: 'default', part: 'all' },
);

const { t } = useI18n();
const { updateSettings } = useElementInspectorUpdate();

function setMuted(checked: boolean) {
  updateSettings(props.sceneId, props.element, { muted: checked });
}

function setNumber(key: 'volume' | 'pan' | 'syncOffsetMs', raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  updateSettings(props.sceneId, props.element, { [key]: value });
}

const showMix = computed(() => props.part === 'all' || props.part === 'mix');
const showSync = computed(() => props.part === 'all' || props.part === 'sync');
</script>

<template>
  <div
    v-if="layout === 'compact'"
    class="gap-md contents"
  >
    <template v-if="showMix">
      <InspectorField
        :label="t('studio.properties.fields.volume')"
        inline
        class="min-w-[12rem] flex-1"
      >
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="element.settings.volume"
          class="accent-accent w-full"
          @change="setNumber('volume', ($event.target as HTMLInputElement).value)"
        />
      </InspectorField>
      <label class="gap-x-sm pb-xx-sm flex cursor-pointer items-end">
        <input
          type="checkbox"
          :checked="element.settings.muted"
          @change="setMuted(($event.target as HTMLInputElement).checked)"
        />
        <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.muted') }}</span>
      </label>
      <InspectorField
        :label="t('studio.properties.fields.pan')"
        inline
        class="min-w-[10rem]"
      >
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          :value="element.settings.pan"
          class="accent-accent w-full"
          @change="setNumber('pan', ($event.target as HTMLInputElement).value)"
        />
      </InspectorField>
      <p class="text-body-sm font-roboto text-on-surface-dim w-full basis-full">
        {{ t('studio.properties.monitoringUnavailable') }}
      </p>
    </template>
    <InspectorField
      v-if="showSync"
      :label="t('studio.properties.fields.syncOffsetMs')"
      inline
      class="w-[8rem]"
    >
      <input
        type="number"
        step="1"
        :value="element.settings.syncOffsetMs"
        :class="inspectorInputClass"
        @change="setNumber('syncOffsetMs', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
  </div>
  <InspectorSection
    v-else
    :title="t('studio.properties.sections.audio')"
  >
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
    <label class="gap-x-sm flex cursor-pointer items-center">
      <input
        type="checkbox"
        :checked="element.settings.muted"
        @change="setMuted(($event.target as HTMLInputElement).checked)"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.muted') }}</span>
    </label>
    <InspectorField :label="t('studio.properties.fields.pan')">
      <input
        type="number"
        min="-1"
        max="1"
        step="0.01"
        :value="element.settings.pan"
        :class="inspectorInputClass"
        @change="setNumber('pan', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <InspectorField :label="t('studio.properties.fields.syncOffsetMs')">
      <input
        type="number"
        step="1"
        :value="element.settings.syncOffsetMs"
        :class="inspectorInputClass"
        @change="setNumber('syncOffsetMs', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <p class="text-body-sm font-roboto text-on-surface-dim">
      {{ t('studio.properties.monitoringUnavailable') }}
    </p>
  </InspectorSection>
</template>
