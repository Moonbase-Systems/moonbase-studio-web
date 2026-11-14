<script setup lang="ts">
import { allowedEffectTypesForElement } from '../../../models/effects';
import type { SceneElement } from '../../../models/scene-element.domain';

defineProps<{
  element: SceneElement;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="min-h-xxxx-lg gap-xxx-sm flex flex-col items-center justify-end">
    <Icon
      name="mdi:plus"
      class="size-x-lg text-accent"
      aria-hidden="true"
    />
    <ul
      v-if="element.effects.length > 0"
      class="gap-xxx-sm flex w-full flex-col"
    >
      <li
        v-for="effect in element.effects"
        :key="effect.id"
        class="text-body-sm text-on-surface truncate font-sans lowercase"
      >
        {{ effect.name }}
      </li>
    </ul>
    <p
      v-else
      class="text-body-sm text-on-surface-dim sr-only font-sans"
    >
      {{ t('studio.properties.effectsEmpty') }}
    </p>
    <p class="text-body-sm text-on-surface-dim sr-only font-sans">
      {{ t('studio.properties.effectsHint', { types: allowedEffectTypesForElement(element.type).join(', ') || '—' }) }}
    </p>
  </div>
</template>
