<script setup lang="ts">
import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { ElementCrop } from '../../../models/common.domain';
import type { SceneId } from '../../../models/ids.domain';
import type { SceneElement } from '../../../models/scene-element.domain';
import { inspectorInputClass } from '../inspector-input-class';
import InspectorField from '../InspectorField.vue';
import InspectorSection from '../InspectorSection.vue';

const props = withDefaults(
  defineProps<{
    sceneId: SceneId;
    element: SceneElement;
    layout?: 'default' | 'compact';
  }>(),
  { layout: 'default' },
);

const { t } = useI18n();
const { applyUpdate } = useElementInspectorUpdate();

const keys: (keyof ElementCrop)[] = ['left', 'right', 'top', 'bottom'];

function commit(key: keyof ElementCrop, raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  applyUpdate(props.sceneId, props.element.id, { crop: { [key]: value } });
}
</script>

<template>
  <div
    v-if="layout === 'compact'"
    class="gap-md contents"
  >
    <InspectorField
      v-for="key in keys"
      :key="key"
      :label="t(`studio.properties.fields.crop.${key}`)"
      inline
      class="w-[5rem]"
    >
      <input
        type="number"
        min="0"
        max="1"
        step="0.01"
        :value="element.crop[key]"
        :class="inspectorInputClass"
        @change="commit(key, ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
  </div>
  <InspectorSection
    v-else
    :title="t('studio.properties.sections.crop')"
  >
    <div class="gap-sm grid grid-cols-2">
      <InspectorField
        v-for="key in keys"
        :key="key"
        :label="t(`studio.properties.fields.crop.${key}`)"
      >
        <input
          type="number"
          min="0"
          max="1"
          step="0.01"
          :value="element.crop[key]"
          :class="inspectorInputClass"
          @change="commit(key, ($event.target as HTMLInputElement).value)"
        />
      </InspectorField>
    </div>
  </InspectorSection>
</template>
