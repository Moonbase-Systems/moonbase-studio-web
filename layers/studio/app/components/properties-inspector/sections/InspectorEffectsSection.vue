<script setup lang="ts">
import { allowedEffectTypesForElement } from '../../../models/effects';
import type { SceneId } from '../../../models/ids.domain';
import type { SceneElement } from '../../../models/scene-element.domain';
import InspectorSection from '../InspectorSection.vue';

withDefaults(
  defineProps<{
    sceneId: SceneId;
    element: SceneElement;
    layout?: 'default' | 'compact';
  }>(),
  { layout: 'default' },
);

const { t } = useI18n();
</script>

<template>
  <div
    v-if="layout === 'compact'"
    class="gap-sm flex w-full min-w-[12rem] flex-wrap items-center"
  >
    <span class="text-body-sm font-roboto text-on-surface-dim shrink-0">
      {{ t('studio.properties.sections.effects') }}
    </span>
    <p
      v-if="element.effects.length === 0"
      class="text-body-sm font-roboto text-on-surface-dim"
    >
      {{ t('studio.properties.effectsEmpty') }}
    </p>
    <span
      v-for="effect in element.effects"
      :key="effect.id"
      class="text-body-sm font-roboto text-on-surface border-on-surface-dim/30 rounded-x-sm px-sm py-xx-sm border"
    >
      {{ effect.name }}
    </span>
  </div>
  <InspectorSection
    v-else
    :title="t('studio.properties.sections.effects')"
  >
    <p
      v-if="element.effects.length === 0"
      class="text-body-sm font-roboto text-on-surface-dim"
    >
      {{ t('studio.properties.effectsEmpty') }}
    </p>
    <ul
      v-else
      class="gap-xx-sm flex flex-col"
    >
      <li
        v-for="effect in element.effects"
        :key="effect.id"
        class="text-body-sm font-roboto text-on-surface border-on-surface-dim/20 rounded-x-sm px-sm py-xx-sm border"
      >
        {{ effect.name }}
        <span class="text-on-surface-dim"> ({{ effect.type }}) </span>
      </li>
    </ul>
    <p class="text-body-sm font-roboto text-on-surface-dim">
      {{ t('studio.properties.effectsHint', { types: allowedEffectTypesForElement(element.type).join(', ') || '—' }) }}
    </p>
  </InspectorSection>
</template>
