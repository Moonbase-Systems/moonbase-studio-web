<script setup lang="ts">
import { cn } from '~/utils/index';

import {
  inspectorCardTitleForRail,
  type InspectorRailId,
  inspectorRailsForElementType,
} from '../../application/inspector-sections';
import type { SceneId } from '../../models/ids.domain';
import type { SceneElement } from '../../models/scene-element.domain';
import InspectorCardEffects from './cards/InspectorCardEffects.vue';
import InspectorCardTransformation from './cards/InspectorCardTransformation.vue';
import { inspectorBodyTextClass } from './inspector-control-classes';
import { inspectorRailIcon } from './inspector-rail-icon';
import InspectorCardHeader from './InspectorCardHeader.vue';

const props = defineProps<{
  sceneId: SceneId;
  element: SceneElement;
}>();

const { t } = useI18n();

const rails = computed(() => inspectorRailsForElementType(props.element.type));
const activeRailId = ref<InspectorRailId>('source');

watch(
  () => props.element.type,
  () => {
    activeRailId.value = rails.value[0]?.id ?? 'source';
  },
  { immediate: true },
);

watch(rails, (next) => {
  if (!next.some((rail) => rail.id === activeRailId.value)) {
    activeRailId.value = next[0]?.id ?? 'source';
  }
});

const cardTitle = computed(() => inspectorCardTitleForRail(activeRailId.value, props.element.type));

const iconRailItems = computed(() =>
  rails.value.map((rail) => ({
    id: rail.id,
    label: t(rail.labelKey),
    ...inspectorRailIcon(props.element.type, rail.id),
  })),
);
</script>

<template>
  <div class="gap-md flex w-full min-w-0 flex-col">
    <InspectorCardHeader
      :scene-id="sceneId"
      :element="element"
    />

    <div class="border-line py-md px-x-sm flex min-w-0 items-center justify-center border">
      <slot name="preview">
        <p :class="cn(inspectorBodyTextClass, 'text-on-surface truncate')">
          {{ element.name }}
        </p>
      </slot>
    </div>

    <div class="gap-xxx-sm flex min-w-0 flex-col">
      <BaseIconRail
        v-model="activeRailId"
        :items="iconRailItems"
        class="flex-row self-start"
      />
      <BasePropertyCard
        :title="t(cardTitle)"
        class="h-auto w-full flex-none overflow-visible"
      >
        <slot
          v-if="activeRailId === 'source'"
          name="options"
        />
        <InspectorCardTransformation
          v-else-if="activeRailId === 'transform'"
          :scene-id="sceneId"
          :element="element"
        />
        <InspectorCardEffects
          v-else-if="activeRailId === 'effects'"
          :element="element"
        />
      </BasePropertyCard>
    </div>
  </div>
</template>
