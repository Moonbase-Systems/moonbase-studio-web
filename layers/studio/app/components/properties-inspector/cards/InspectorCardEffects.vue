<script setup lang="ts">
import { allowedEffectTypesForElement } from '../../../models/effects';
import type { SceneElement } from '../../../models/scene-element.domain';

defineProps<{
  element: SceneElement;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="gap-xx-sm flex min-h-[3rem] flex-col items-center justify-end">
    <Icon
      name="mdi:plus"
      class="text-accent size-8"
      aria-hidden="true"
    />
    <ul
      v-if="element.effects.length > 0"
      class="gap-xx-sm flex w-full flex-col"
    >
      <li
        v-for="effect in element.effects"
        :key="effect.id"
        class="font-roboto text-body-x-sm text-on-surface truncate lowercase"
      >
        {{ effect.name }}
      </li>
    </ul>
    <p
      v-else
      class="font-roboto text-body-x-sm text-on-surface-dim sr-only"
    >
      {{ t('studio.properties.effectsEmpty') }}
    </p>
    <p class="font-roboto text-body-x-sm text-on-surface-dim sr-only">
      {{ t('studio.properties.effectsHint', { types: allowedEffectTypesForElement(element.type).join(', ') || '—' }) }}
    </p>
  </div>
</template>
