<script setup lang="ts">
import { cn, inspectorTypography } from '~/utils/index';

import { useElementInspectorUpdate } from '../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../models/ids.domain';
import type { SceneElement } from '../../models/scene-element.domain';
import { displayNameSchema } from '../../schemas/display-name.schema';
import {
  sceneElementTypeIconI18nKey,
  sceneElementTypeIconName,
  sceneElementTypeTone,
} from '../scene-element-list/scene-element-type-icons';

const props = defineProps<{
  sceneId: SceneId;
  element: SceneElement;
}>();

const { t } = useI18n();
const { applyUpdate } = useElementInspectorUpdate();

const isText = computed(() => props.element.type === 'text');

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

const fieldClass = cn(
  inspectorTypography.standardSmall,
  'h-[36px] border-0 bg-[color-mix(in_srgb,white_5%,#050004)] text-white outline-none',
);
</script>

<template>
  <div
    class="flex h-full min-w-0 flex-[460] flex-col items-center justify-center gap-[clamp(12px,4vh,41px)] overflow-hidden px-[54px] py-[9px]"
  >
    <span
      class="size-[46.5px]"
      :class="iconToneClass"
      :aria-label="iconLabel"
    >
      <InspectorMaskIcon
        v-if="isText || element.type === 'screen'"
        :name="isText ? 'type-text' : 'type-screen'"
      />
      <Icon
        v-else
        :name="iconName"
        class="size-full"
      />
    </span>
    <div class="flex w-full max-w-[352px] flex-col">
      <input
        v-model="nameDraft"
        :class="cn(fieldClass, 'w-full px-[14px] text-left')"
        :aria-invalid="nameError ? true : undefined"
        @change="commitName"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
      <p
        v-if="nameError"
        class="text-on-surface-dim mt-tiny text-[10px] leading-none"
      >
        {{ nameError }}
      </p>
    </div>
    <div class="flex items-center gap-[17px] text-white">
      <button
        type="button"
        class="size-[27px]"
        :aria-label="t('studio.properties.fields.visible')"
        :aria-pressed="element.visibility"
        @click="toggleVisibility"
      >
        <InspectorMaskIcon
          :key="`eye-${element.visibility}`"
          :name="element.visibility ? 'eye' : 'eye-hidden'"
          class="inspector-state-icon"
        />
      </button>
      <button
        type="button"
        class="size-[27px]"
        :aria-label="t('studio.properties.fields.locked')"
        :aria-pressed="element.locked"
        @click="toggleLocked"
      >
        <InspectorMaskIcon
          :key="`lock-${element.locked}`"
          :name="element.locked ? 'lock-closed' : 'lock-open'"
          class="inspector-state-icon"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.inspector-state-icon {
  animation: inspector-state-in 180ms ease-out;
}

@keyframes inspector-state-in {
  from {
    opacity: 0.35;
    transform: scale(0.82);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
