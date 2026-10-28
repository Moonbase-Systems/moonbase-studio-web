<script setup lang="ts">
import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../../models/ids.domain';
import type { TextElement } from '../../../models/scene-elements';
import InspectorField from '../InspectorField.vue';
import InspectorSection from '../InspectorSection.vue';

const props = defineProps<{
  sceneId: SceneId;
  element: TextElement;
}>();

const { t } = useI18n();
const { updateSettings } = useElementInspectorUpdate();

const textDraft = ref(props.element.settings.text);

watch(
  () => props.element.settings.text,
  (value) => {
    textDraft.value = value;
  },
);

function commitText() {
  updateSettings(props.sceneId, props.element, { text: textDraft.value });
}

function setNumber(key: 'fontSize' | 'lineHeight' | 'letterSpacing' | 'padding' | 'strokeWidth', raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  updateSettings(props.sceneId, props.element, { [key]: value });
}

function setString(key: 'fontFamily' | 'color' | 'fontWeight', value: string) {
  updateSettings(props.sceneId, props.element, { [key]: value });
}
</script>

<template>
  <InspectorSection :title="t('studio.properties.sections.textContent')">
    <InspectorField :label="t('studio.properties.fields.text')">
      <textarea
        v-model="textDraft"
        rows="3"
        class="text-body-sm font-roboto text-on-surface border-on-surface-dim/30 rounded-x-sm px-sm py-xx-sm focus:border-accent w-full border bg-transparent outline-none"
        @change="commitText"
      />
    </InspectorField>
  </InspectorSection>

  <InspectorSection :title="t('studio.properties.sections.textTypography')">
    <InspectorField :label="t('studio.properties.fields.fontFamily')">
      <input
        :value="element.settings.fontFamily"
        class="text-body-sm font-roboto text-on-surface border-on-surface-dim/30 rounded-x-sm px-sm py-xx-sm focus:border-accent w-full border bg-transparent outline-none"
        @change="setString('fontFamily', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <InspectorField :label="t('studio.properties.fields.fontSize')">
      <input
        type="number"
        min="1"
        :value="element.settings.fontSize"
        class="text-body-sm font-roboto text-on-surface border-on-surface-dim/30 rounded-x-sm px-sm py-xx-sm focus:border-accent w-full border bg-transparent outline-none"
        @change="setNumber('fontSize', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <InspectorField :label="t('studio.properties.fields.color')">
      <input
        :value="element.settings.color"
        class="text-body-sm font-roboto text-on-surface border-on-surface-dim/30 rounded-x-sm px-sm py-xx-sm focus:border-accent w-full border bg-transparent outline-none"
        @change="setString('color', ($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
  </InspectorSection>
</template>
