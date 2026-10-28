<script setup lang="ts">
import { cn } from '~/utils/index';

import {
  sceneElementTypeIconI18nKey,
  sceneElementTypeIconName,
  sceneElementTypeTone,
  type SceneListRowIconKind,
} from './scene-element-type-icons';

const props = withDefaults(
  defineProps<{
    kind: SceneListRowIconKind;
    selected?: boolean;
  }>(),
  { selected: false },
);

const { t } = useI18n();

const iconName = computed(() => sceneElementTypeIconName(props.kind));
const label = computed(() => t(sceneElementTypeIconI18nKey(props.kind)));
const tone = computed(() => sceneElementTypeTone(props.kind));

const toneClass = computed(() => {
  if (props.selected) {
    return 'text-accent';
  }
  switch (tone.value) {
    case 'accent':
      return 'text-accent';
    case 'layout':
      return 'text-category-layout';
    case 'interactive':
      return 'text-category-interactive';
    default: {
      const exhaustive: never = tone.value;
      return exhaustive;
    }
  }
});
</script>

<template>
  <Icon
    :name="iconName"
    :aria-label="label"
    :class="cn('size-md shrink-0', toneClass)"
  />
</template>
