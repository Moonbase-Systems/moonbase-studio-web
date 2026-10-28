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

type TransformKey = keyof SceneElement['transform'];

const fields: { key: TransformKey; labelKey: string; step?: string }[] = [
  { key: 'x', labelKey: 'studio.properties.fields.x', step: '1' },
  { key: 'y', labelKey: 'studio.properties.fields.y', step: '1' },
  { key: 'width', labelKey: 'studio.properties.fields.width', step: '1' },
  { key: 'height', labelKey: 'studio.properties.fields.height', step: '1' },
  { key: 'scaleX', labelKey: 'studio.properties.fields.scaleX', step: '0.01' },
  { key: 'scaleY', labelKey: 'studio.properties.fields.scaleY', step: '0.01' },
  { key: 'rotation', labelKey: 'studio.properties.fields.rotation', step: '1' },
  { key: 'anchorX', labelKey: 'studio.properties.fields.anchorX', step: '0.01' },
  { key: 'anchorY', labelKey: 'studio.properties.fields.anchorY', step: '0.01' },
];

function commitField(key: TransformKey, raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  applyUpdate(props.sceneId, props.element.id, {
    transform: { [key]: value },
  });
}

function toggleBool(key: 'flipX' | 'flipY' | 'keepAspectRatio') {
  applyUpdate(props.sceneId, props.element.id, {
    transform: { [key]: !props.element.transform[key] },
  });
}
</script>

<template>
  <div
    v-if="layout === 'compact'"
    class="gap-md contents"
  >
    <InspectorField
      v-for="field in fields"
      :key="field.key"
      :label="t(field.labelKey)"
      inline
      class="w-[5.5rem]"
    >
      <input
        type="number"
        :step="field.step"
        :value="element.transform[field.key]"
        :class="inspectorInputClass"
        @change="commitField(field.key, ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <label class="gap-x-sm pb-xx-sm flex cursor-pointer items-end">
      <input
        type="checkbox"
        :checked="element.transform.flipX"
        @change="toggleBool('flipX')"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.flipX') }}</span>
    </label>
    <label class="gap-x-sm pb-xx-sm flex cursor-pointer items-end">
      <input
        type="checkbox"
        :checked="element.transform.flipY"
        @change="toggleBool('flipY')"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.flipY') }}</span>
    </label>
    <label class="gap-x-sm pb-xx-sm flex cursor-pointer items-end">
      <input
        type="checkbox"
        :checked="element.transform.keepAspectRatio"
        @change="toggleBool('keepAspectRatio')"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.keepAspectRatio') }}</span>
    </label>
  </div>
  <InspectorSection
    v-else
    :title="t('studio.properties.sections.transform')"
  >
    <div class="gap-sm grid grid-cols-2">
      <InspectorField
        v-for="field in fields"
        :key="field.key"
        :label="t(field.labelKey)"
      >
        <input
          type="number"
          :step="field.step"
          :value="element.transform[field.key]"
          :class="inspectorInputClass"
          @change="commitField(field.key, ($event.target as HTMLInputElement).value)"
        />
      </InspectorField>
    </div>
    <label class="gap-x-sm flex cursor-pointer items-center">
      <input
        type="checkbox"
        :checked="element.transform.flipX"
        @change="toggleBool('flipX')"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.flipX') }}</span>
    </label>
    <label class="gap-x-sm flex cursor-pointer items-center">
      <input
        type="checkbox"
        :checked="element.transform.flipY"
        @change="toggleBool('flipY')"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.flipY') }}</span>
    </label>
    <label class="gap-x-sm flex cursor-pointer items-center">
      <input
        type="checkbox"
        :checked="element.transform.keepAspectRatio"
        @change="toggleBool('keepAspectRatio')"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.keepAspectRatio') }}</span>
    </label>
  </InspectorSection>
</template>
