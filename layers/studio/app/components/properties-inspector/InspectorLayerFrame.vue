<script setup lang="ts">
import { cn, inspectorTypography } from '~/utils/index';

import {
  inspectorCardTitleForRail,
  type InspectorRailId,
  inspectorRailsForElementType,
} from '../../application/inspector-sections';
import type { SceneId } from '../../models/ids.domain';
import type { SceneElement } from '../../models/scene-element.domain';
import InspectorCardEffects from './cards/InspectorCardEffects.vue';
import InspectorCardTransformation from './cards/InspectorCardTransformation.vue';
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
  <div class="flex h-full min-h-0 w-full min-w-0 items-stretch justify-center gap-[10px]">
    <InspectorCardHeader
      :scene-id="sceneId"
      :element="element"
    />

    <div class="flex h-full min-h-0 min-w-0 flex-[437] items-center justify-center px-[10px]">
      <slot name="preview">
        <p :class="cn(inspectorTypography.standardSmall, 'truncate text-white')">
          {{ element.name }}
        </p>
      </slot>
    </div>

    <div class="flex h-full min-w-0 flex-[631] items-stretch overflow-hidden bg-[#050004] pl-[17px]">
      <BaseIconRail
        v-model="activeRailId"
        :items="iconRailItems"
        class="shrink-0 self-center"
      />
      <BasePropertyCard
        :title="t(cardTitle)"
        class="ml-[24px] h-full"
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
