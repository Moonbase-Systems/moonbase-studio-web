<script setup lang="ts">
import { cn } from '~/utils/index';

import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../../models/ids.domain';
import type { ScreenElement } from '../../../models/scene-elements';
import type { Source } from '../../../models/source.domain';
import { useStudioSessionStore } from '../../../store/studio-session.store';
import InspectorLayerFrame from '../InspectorLayerFrame.vue';

const props = defineProps<{
  sceneId: SceneId;
  element: ScreenElement;
  linkedSource?: Source;
}>();

const { t } = useI18n();
const store = useStudioSessionStore();
const { applyUpdate, updateSettings } = useElementInspectorUpdate();

const open = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const panelStyle = ref({ top: '0px', left: '0px' });

const textControlClass = 'font-inter text-body-sm font-medium tracking-normal text-white';
const fieldShellClass =
  'flex h-[24px] min-w-[120px] items-center gap-[8px] border border-transparent bg-[color-mix(in_srgb,white_5%,#050004)] px-[4px] focus-within:border-[#22FF86]';

function placePanel() {
  const trigger = triggerRef.value;
  if (!trigger) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  panelStyle.value = {
    top: `${rect.top}px`,
    left: `${rect.right + 10}px`,
  };
}

function togglePanel() {
  if (!open.value) {
    placePanel();
  }
  open.value = !open.value;
}

const sourceLabel = computed(() => props.linkedSource?.name ?? props.element.sourceId);
const screenSources = computed(() => store.project?.sources.filter((source) => source.type === 'screen') ?? []);

function setShowCursor(value: boolean) {
  updateSettings(props.sceneId, props.element, { showCursor: value });
}

function selectScreen(sourceId: string) {
  const ok = applyUpdate(props.sceneId, props.element.id, { sourceId });
  if (ok) {
    open.value = false;
  }
}
</script>

<template>
  <InspectorLayerFrame
    :scene-id="sceneId"
    :element="element"
  >
    <template #preview>
      <div
        class="flex size-[160px] max-h-full max-w-full items-center justify-center bg-[color-mix(in_srgb,white_5%,#050004)] px-[12px]"
      >
        <p :class="cn(textControlClass, 'text-center')">
          {{ t('studio.properties.previewUnavailable') }}
        </p>
      </div>
    </template>
    <template #options>
      <div class="flex w-full max-w-[464px] flex-col items-center gap-[10px]">
        <div class="flex items-center gap-[10px]">
          <span :class="cn(textControlClass, 'shrink-0')">{{ t('studio.properties.labels.source') }}</span>
          <button
            ref="triggerRef"
            type="button"
            :class="cn(fieldShellClass, textControlClass)"
            :aria-expanded="open"
            @click="togglePanel"
          >
            <span class="min-w-0 flex-1 truncate text-left">{{ sourceLabel }}</span>
            <span
              class="text-[12px] transition-transform duration-200"
              :class="open ? 'rotate-180' : ''"
            >
              &gt;
            </span>
          </button>
        </div>

        <BaseToggleDot
          :model-value="element.settings.showCursor"
          label-typography="inspector"
          :label="t('studio.properties.labels.cursor')"
          @change="setShowCursor"
        />

        <Teleport to="body">
          <Transition name="screen-source-panel">
            <div
              v-if="open"
              class="fixed z-50 flex w-[220px] flex-col gap-[6px] border border-white/15 bg-[color-mix(in_srgb,white_8%,#050004)] p-[10px]"
              :style="panelStyle"
            >
              <p
                v-if="screenSources.length === 0"
                :class="textControlClass"
              >
                {{ t('studio.properties.noScreens') }}
              </p>
              <button
                v-for="source in screenSources"
                :key="source.id"
                type="button"
                :class="
                  cn(
                    textControlClass,
                    'h-[24px] px-[8px] text-left',
                    source.id === element.sourceId
                      ? 'bg-[#22FF86] text-[#050004]'
                      : 'text-white hover:bg-[#22FF86] hover:text-[#050004]',
                  )
                "
                @click="selectScreen(source.id)"
              >
                {{ source.name }}
              </button>
            </div>
          </Transition>
        </Teleport>
      </div>
    </template>
  </InspectorLayerFrame>
</template>

<style scoped>
.screen-source-panel-enter-active,
.screen-source-panel-leave-active {
  transition:
    transform 180ms ease-out,
    opacity 180ms ease-out;
}

.screen-source-panel-enter-from,
.screen-source-panel-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}
</style>
