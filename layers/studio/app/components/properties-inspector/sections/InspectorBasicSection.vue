<script setup lang="ts">
import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../../models/ids.domain';
import type { SceneElement } from '../../../models/scene-element.domain';
import { displayNameSchema } from '../../../schemas/display-name.schema';
import InspectorField from '../InspectorField.vue';
import InspectorSection from '../InspectorSection.vue';

const props = defineProps<{
  sceneId: SceneId;
  element: SceneElement;
}>();

const { t } = useI18n();
const { applyUpdate } = useElementInspectorUpdate();

const nameDraft = ref(props.element.name);
const nameError = ref<string | null>(null);

watch(
  () => props.element.name,
  (value) => {
    nameDraft.value = value;
  },
);

function commitName() {
  const parsed = displayNameSchema.safeParse(nameDraft.value);
  if (!parsed.success) {
    nameError.value = t('studio.scene.invalidName');
    return;
  }
  nameError.value = null;
  if (parsed.data === props.element.name) {
    return;
  }
  const ok = applyUpdate(props.sceneId, props.element.id, { name: parsed.data });
  if (!ok) {
    nameError.value = t('studio.properties.validationFailed');
    nameDraft.value = props.element.name;
  }
}

function toggleVisibility() {
  applyUpdate(props.sceneId, props.element.id, { visibility: !props.element.visibility });
}

function toggleLocked() {
  applyUpdate(props.sceneId, props.element.id, { locked: !props.element.locked });
}
</script>

<template>
  <InspectorSection :title="t('studio.properties.sections.basic')">
    <InspectorField
      :label="t('studio.properties.fields.name')"
      :error="nameError"
    >
      <input
        v-model="nameDraft"
        class="text-body-sm font-roboto text-on-surface border-on-surface-dim/30 rounded-x-sm px-sm py-xx-sm focus:border-accent w-full border bg-transparent outline-none"
        @change="commitName"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
    </InspectorField>
    <label class="gap-x-sm flex cursor-pointer items-center">
      <input
        type="checkbox"
        :checked="element.visibility"
        @change="toggleVisibility"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.visible') }}</span>
    </label>
    <label class="gap-x-sm flex cursor-pointer items-center">
      <input
        type="checkbox"
        :checked="element.locked"
        @change="toggleLocked"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.locked') }}</span>
    </label>
  </InspectorSection>
</template>
