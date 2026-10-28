<script setup lang="ts">
import type { SourceId } from '../../../models/ids.domain';
import type { Source } from '../../../models/source.domain';
import InspectorSection from '../InspectorSection.vue';

withDefaults(
  defineProps<{
    source: Source | undefined;
    sourceId: SourceId;
    layout?: 'default' | 'compact';
  }>(),
  { layout: 'default' },
);

const { t } = useI18n();
</script>

<template>
  <div
    v-if="layout === 'compact'"
    class="gap-md flex min-w-[12rem] flex-wrap items-center"
  >
    <span class="text-body-sm font-roboto text-on-surface font-medium">
      {{ source?.name ?? sourceId }}
    </span>
    <span
      v-if="source"
      class="text-body-sm font-roboto text-on-surface-dim"
    >
      {{ source.type }}
    </span>
  </div>
  <InspectorSection
    v-else
    :title="t('studio.properties.sections.source')"
  >
    <p class="text-body-sm font-roboto text-on-surface">
      {{ source?.name ?? sourceId }}
    </p>
    <p
      v-if="source"
      class="text-body-sm font-roboto text-on-surface-dim"
    >
      {{ source.type }}
    </p>
  </InspectorSection>
</template>
