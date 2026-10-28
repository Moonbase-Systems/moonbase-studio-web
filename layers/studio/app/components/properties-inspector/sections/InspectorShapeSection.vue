<script setup lang="ts">
import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../../models/ids.domain';
import type { ShapeElement } from '../../../models/scene-elements';
import type { ShapeType } from '../../../models/scene-elements/shape-element.domain';
import { inspectorInputClass } from '../inspector-input-class';
import InspectorField from '../InspectorField.vue';
import InspectorSection from '../InspectorSection.vue';

const props = withDefaults(
  defineProps<{
    sceneId: SceneId;
    element: ShapeElement;
    layout?: 'default' | 'compact';
  }>(),
  { layout: 'default' },
);

const { t } = useI18n();
const { updateSettings } = useElementInspectorUpdate();

const shapeTypes: ShapeType[] = ['rectangle', 'ellipse', 'line'];

function setShapeType(value: string) {
  updateSettings(props.sceneId, props.element, { shapeType: value });
}

function setFillColor(value: string) {
  updateSettings(props.sceneId, props.element, { fillColor: value || null });
}

function setNumber(key: 'fillOpacity' | 'strokeWidth' | 'cornerRadius', raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  updateSettings(props.sceneId, props.element, { [key]: value });
}
</script>

<template>
  <div
    v-if="layout === 'compact'"
    class="gap-md contents"
  >
    <InspectorField
      :label="t('studio.properties.fields.shapeType')"
      inline
      class="min-w-[8rem]"
    >
      <select
        :value="element.settings.shapeType"
        :class="inspectorInputClass"
        @change="setShapeType(($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="shape in shapeTypes"
          :key="shape"
          :value="shape"
        >
          {{ shape }}
        </option>
      </select>
    </InspectorField>
    <InspectorField
      :label="t('studio.properties.fields.fillColor')"
      inline
      class="min-w-[7rem]"
    >
      <input
        :value="element.settings.fillColor ?? ''"
        :class="inspectorInputClass"
        @change="setFillColor(($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <InspectorField
      :label="t('studio.properties.fields.fillOpacity')"
      inline
      class="w-[6rem]"
    >
      <input
        type="number"
        min="0"
        max="1"
        step="0.01"
        :value="element.settings.fillOpacity"
        :class="inspectorInputClass"
        @change="setNumber('fillOpacity', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <InspectorField
      :label="t('studio.properties.fields.cornerRadius')"
      inline
      class="w-[6rem]"
    >
      <input
        type="number"
        min="0"
        :value="element.settings.cornerRadius"
        :class="inspectorInputClass"
        @change="setNumber('cornerRadius', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
  </div>
  <InspectorSection
    v-else
    :title="t('studio.properties.sections.shape')"
  >
    <InspectorField :label="t('studio.properties.fields.shapeType')">
      <select
        :value="element.settings.shapeType"
        :class="inspectorInputClass"
        @change="setShapeType(($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="shape in shapeTypes"
          :key="shape"
          :value="shape"
        >
          {{ shape }}
        </option>
      </select>
    </InspectorField>
    <InspectorField :label="t('studio.properties.fields.fillColor')">
      <input
        :value="element.settings.fillColor ?? ''"
        :class="inspectorInputClass"
        @change="setFillColor(($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <InspectorField :label="t('studio.properties.fields.fillOpacity')">
      <input
        type="number"
        min="0"
        max="1"
        step="0.01"
        :value="element.settings.fillOpacity"
        :class="inspectorInputClass"
        @change="setNumber('fillOpacity', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <InspectorField :label="t('studio.properties.fields.cornerRadius')">
      <input
        type="number"
        min="0"
        :value="element.settings.cornerRadius"
        :class="inspectorInputClass"
        @change="setNumber('cornerRadius', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
  </InspectorSection>
</template>
