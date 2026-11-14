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
import { inspectorBodyTextClass, inspectorFocusRingClass } from './inspector-control-classes';

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
  inspectorBodyTextClass,
  'h-control border border-line bg-transparent text-on-surface outline-none transition-colors duration-short hover:border-on-surface-dim focus:border-accent aria-[invalid=true]:border-error',
);

const stateButtonClass = cn(
  'size-row text-on-surface transition-colors duration-short hover:text-accent active:text-accent-dim',
  inspectorFocusRingClass,
);
</script>

<template>
  <div class="gap-x-sm flex min-w-0 items-center">
    <span
      class="size-xxxx-lg shrink-0"
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
    <div class="flex min-w-0 flex-1 flex-col">
      <input
        v-model="nameDraft"
        :class="cn(fieldClass, 'px-x-sm w-full text-left')"
        :aria-invalid="nameError ? true : undefined"
        @change="commitName"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />
      <p
        v-if="nameError"
        class="mt-tiny text-body-x-sm text-error font-sans"
      >
        {{ nameError }}
      </p>
    </div>
    <div class="gap-xxx-sm flex shrink-0 items-center">
      <button
        type="button"
        :class="stateButtonClass"
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
        :class="stateButtonClass"
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
