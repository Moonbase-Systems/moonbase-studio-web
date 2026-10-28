<script setup lang="ts">
import type { InspectorPanelId } from '../../../application/inspector-sections';
import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../../models/ids.domain';
import type { TextElement } from '../../../models/scene-elements';
import InspectorField from '../InspectorField.vue';

const props = defineProps<{
  sceneId: SceneId;
  element: TextElement;
  panel: Extract<InspectorPanelId, 'textPrimary' | 'textLayout' | 'textStrokeFill'>;
}>();

const { t } = useI18n();
const { updateSettings } = useElementInspectorUpdate();

const inputClass =
  'h-6 text-xs font-roboto text-on-surface border-on-surface-dim/30 rounded-x-sm border bg-surface-container-high px-1.5 min-w-0 w-full outline-none focus:border-accent';

function setNumber(key: 'fontSize' | 'lineHeight' | 'letterSpacing' | 'padding' | 'strokeWidth', raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  updateSettings(props.sceneId, props.element, { [key]: value });
}

function setString(key: 'fontFamily' | 'color', value: string) {
  updateSettings(props.sceneId, props.element, { [key]: value });
}

function setFontWeight(value: string) {
  updateSettings(props.sceneId, props.element, { fontWeight: value });
}

function setOptionalColor(key: 'backgroundColor' | 'strokeColor', value: string) {
  updateSettings(props.sceneId, props.element, { [key]: value.trim() ? value : null });
}

function setBool(key: 'wrap', checked: boolean) {
  updateSettings(props.sceneId, props.element, { [key]: checked });
}

function setAlign(value: string) {
  updateSettings(props.sceneId, props.element, { textAlign: value });
}
</script>

<template>
  <template v-if="panel === 'textPrimary'">
    <InspectorField
      :label="t('studio.properties.fields.fontSize')"
      class="w-[6rem]"
      inline
    >
      <input
        type="number"
        min="1"
        :value="element.settings.fontSize"
        :class="inputClass"
        @change="setNumber('fontSize', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <InspectorField
      :label="t('studio.properties.fields.fontWeight')"
      class="w-[7rem]"
      inline
    >
      <select
        :value="String(element.settings.fontWeight)"
        :class="inputClass"
        @change="setFontWeight(($event.target as HTMLSelectElement).value)"
      >
        <option value="300">300</option>
        <option value="400">normal</option>
        <option value="600">600</option>
        <option value="700">bold</option>
      </select>
    </InspectorField>
    <InspectorField
      :label="t('studio.properties.fields.fontFamily')"
      class="min-w-[8rem]"
      inline
    >
      <input
        :value="element.settings.fontFamily"
        :class="inputClass"
        @change="setString('fontFamily', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <InspectorField
      :label="t('studio.properties.fields.color')"
      class="w-[5rem]"
      inline
    >
      <input
        type="color"
        :value="element.settings.color"
        class="border-on-surface-dim/30 rounded-x-sm h-6 w-8 cursor-pointer border bg-transparent"
        @change="setString('color', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
  </template>

  <template v-else-if="panel === 'textLayout'">
    <InspectorField
      :label="t('studio.properties.fields.textAlign')"
      class="w-[8rem]"
      inline
    >
      <select
        :value="element.settings.textAlign"
        :class="inputClass"
        @change="setAlign(($event.target as HTMLSelectElement).value)"
      >
        <option value="left">left</option>
        <option value="center">center</option>
        <option value="right">right</option>
      </select>
    </InspectorField>
    <InspectorField
      :label="t('studio.properties.fields.lineHeight')"
      class="w-[6rem]"
      inline
    >
      <input
        type="number"
        step="0.1"
        min="0.5"
        :value="element.settings.lineHeight"
        :class="inputClass"
        @change="setNumber('lineHeight', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <InspectorField
      :label="t('studio.properties.fields.letterSpacing')"
      class="w-[6rem]"
      inline
    >
      <input
        type="number"
        :value="element.settings.letterSpacing"
        :class="inputClass"
        @change="setNumber('letterSpacing', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <InspectorField
      :label="t('studio.properties.fields.padding')"
      class="w-[6rem]"
      inline
    >
      <input
        type="number"
        min="0"
        :value="element.settings.padding"
        :class="inputClass"
        @change="setNumber('padding', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <label class="gap-x-sm pb-xx-sm flex cursor-pointer items-end">
      <input
        type="checkbox"
        :checked="element.settings.wrap"
        @change="setBool('wrap', ($event.target as HTMLInputElement).checked)"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.wrap') }}</span>
    </label>
  </template>

  <template v-else-if="panel === 'textStrokeFill'">
    <InspectorField
      :label="t('studio.properties.fields.backgroundColor')"
      class="min-w-[8rem]"
      inline
    >
      <input
        :value="element.settings.backgroundColor ?? ''"
        :class="inputClass"
        placeholder="—"
        @change="setOptionalColor('backgroundColor', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <InspectorField
      :label="t('studio.properties.fields.strokeColor')"
      class="min-w-[8rem]"
      inline
    >
      <input
        :value="element.settings.strokeColor ?? ''"
        :class="inputClass"
        placeholder="—"
        @change="setOptionalColor('strokeColor', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <InspectorField
      :label="t('studio.properties.fields.strokeWidth')"
      class="w-[6rem]"
      inline
    >
      <input
        type="number"
        min="0"
        :value="element.settings.strokeWidth"
        :class="inputClass"
        @change="setNumber('strokeWidth', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
  </template>
</template>
