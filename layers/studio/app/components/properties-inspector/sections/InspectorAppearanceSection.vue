<script setup lang="ts">
import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
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

function commitOpacity(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  applyUpdate(props.sceneId, props.element.id, { appearance: { opacity: value } });
}
</script>

<template>
  <InspectorField
    v-if="layout === 'compact'"
    :label="t('studio.properties.fields.opacity')"
    inline
    class="w-[5.5rem]"
  >
    <input
      type="number"
      min="0"
      max="1"
      step="0.01"
      :value="element.appearance.opacity"
      :class="inspectorInputClass"
      @change="commitOpacity(($event.target as HTMLInputElement).value)"
    />
  </InspectorField>
  <InspectorSection
    v-else
    :title="t('studio.properties.sections.appearance')"
  >
    <InspectorField :label="t('studio.properties.fields.opacity')">
      <input
        type="number"
        min="0"
        max="1"
        step="0.01"
        :value="element.appearance.opacity"
        :class="inspectorInputClass"
        @change="commitOpacity(($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
  </InspectorSection>
</template>
