<script setup lang="ts">
import { cn } from '~/utils/index';

import { useElementInspectorUpdate } from '../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../models/ids.domain';
import type { SceneElement } from '../../models/scene-element.domain';
import { displayNameSchema } from '../../schemas/display-name.schema';
import {
  sceneElementTypeIconI18nKey,
  sceneElementTypeIconName,
  sceneElementTypeTone,
} from '../scene-element-list/scene-element-type-icons';

const props = withDefaults(
  defineProps<{
    sceneId: SceneId;
    element: SceneElement;
    showName?: boolean;
  }>(),
  { showName: true },
);

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

const iconName = computed(() => sceneElementTypeIconName(props.element.type));
const iconLabel = computed(() => t(sceneElementTypeIconI18nKey(props.element.type)));
const iconToneClass = computed(() => {
  switch (sceneElementTypeTone(props.element.type)) {
    case 'accent':
      return 'text-accent';
    case 'layout':
      return 'text-category-layout';
    case 'interactive':
      return 'text-category-interactive';
    default:
      return 'text-on-surface';
  }
});
</script>

<template>
  <div class="gap-sm flex min-w-0 items-center">
    <Icon
      :name="iconName"
      :aria-label="iconLabel"
      :class="cn('size-8 shrink-0', iconToneClass)"
    />
    <div
      v-if="showName"
      class="min-w-0 flex-1"
    >
      <input
        v-model="nameDraft"
        class="font-roboto text-on-surface border-on-surface-dim/40 bg-surface-container h-6 w-full truncate rounded-sm border px-1.5 text-xs outline-none"
        :aria-invalid="nameError ? true : undefined"
        @change="commitName"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
      <p
        v-if="nameError"
        class="text-body-sm text-on-surface-dim"
      >
        {{ nameError }}
      </p>
    </div>
    <div class="gap-x-tiny flex shrink-0 items-center">
      <BaseIconButton
        :label="t('studio.properties.fields.visible')"
        @click="toggleVisibility"
      >
        <Icon
          :name="element.visibility ? 'mdi:eye-outline' : 'mdi:eye-off-outline'"
          class="size-5"
        />
      </BaseIconButton>
      <BaseIconButton
        :label="t('studio.properties.fields.locked')"
        @click="toggleLocked"
      >
        <Icon
          :name="element.locked ? 'mdi:lock' : 'mdi:lock-open-variant-outline'"
          class="size-5"
        />
      </BaseIconButton>
    </div>
  </div>
</template>
