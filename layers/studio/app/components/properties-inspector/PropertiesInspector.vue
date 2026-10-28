<script setup lang="ts">
import { inspectorTabsForElementType } from '../../application/inspector-sections';
import { useElementInspectorUpdate } from '../../composables/useElementInspectorUpdate';
import { useStudioSessionStore } from '../../store/studio-session.store';
import InspectorCardHeader from './InspectorCardHeader.vue';
import InspectorCardPanelContent from './InspectorCardPanelContent.vue';
import InspectorTabs from './InspectorTabs.vue';

const store = useStudioSessionStore();

const selectedElement = computed(() => {
  const scene = store.activeScene;
  const id = store.selectedLayerId;
  if (!scene || !id || store.selectedLayerIds.length !== 1) {
    return null;
  }
  return scene.elements.find((element) => element.id === id) ?? null;
});

const tabs = computed(() => {
  const element = selectedElement.value;
  if (!element) {
    return [];
  }
  return inspectorTabsForElementType(element.type);
});

const activeTabId = ref('');

watch(
  () => selectedElement.value?.type,
  () => {
    activeTabId.value = tabs.value[0]?.id ?? '';
  },
  { immediate: true },
);

watch(tabs, (next) => {
  if (!next.some((tab) => tab.id === activeTabId.value)) {
    activeTabId.value = next[0]?.id ?? '';
  }
});

const activeTab = computed(() => tabs.value.find((tab) => tab.id === activeTabId.value));

const linkedSource = computed(() => {
  const element = selectedElement.value;
  if (!element || element.type === 'overlay') {
    return undefined;
  }
  const result = store.findSource(element.sourceId);
  return result.ok ? result.value : undefined;
});

const { updateSettings } = useElementInspectorUpdate();
const textDraft = ref('');

watch(
  () => (selectedElement.value?.type === 'text' ? selectedElement.value.settings.text : ''),
  (value) => {
    textDraft.value = value;
  },
  { immediate: true },
);

function commitText() {
  const element = selectedElement.value;
  const sceneId = store.activeSceneId;
  if (!element || element.type !== 'text' || !sceneId) {
    return;
  }
  updateSettings(sceneId, element, { text: textDraft.value });
}

const centerPreview = computed(() => {
  const element = selectedElement.value;
  if (!element) {
    return '';
  }
  if (element.type === 'text') {
    return element.settings.text;
  }
  return element.name;
});
</script>

<template>
  <div
    class="bg-surface px-md flex h-full min-h-0 flex-col justify-center overflow-hidden"
    data-properties-inspector
    @pointerdown.stop
  >
    <div
      v-if="selectedElement && store.activeSceneId && activeTab"
      class="gap-md flex items-center"
    >
      <div class="gap-x-sm flex w-[14rem] shrink-0 items-center">
        <InspectorCardHeader
          :scene-id="store.activeSceneId"
          :element="selectedElement"
          :show-name="selectedElement.type !== 'text'"
        />
        <input
          v-if="selectedElement.type === 'text'"
          v-model="textDraft"
          type="text"
          class="font-roboto text-on-surface border-on-surface-dim/40 bg-surface-container h-6 min-w-0 flex-1 rounded-sm border px-1.5 text-xs outline-none"
          @change="commitText"
        />
      </div>

      <p class="text-on-surface-dim px-md min-w-0 flex-1 truncate text-center text-[11px] leading-none">
        {{ centerPreview }}
      </p>

      <div class="flex w-[22rem] shrink-0 flex-col items-end gap-0.5">
        <InspectorTabs
          v-if="tabs.length > 1"
          v-model="activeTabId"
          :tabs="tabs"
        />
        <div
          class="grid w-full grid-cols-2 justify-items-end gap-x-3 gap-y-0.5"
          role="tabpanel"
        >
          <InspectorCardPanelContent
            v-for="panel in activeTab.panels"
            :key="panel"
            :scene-id="store.activeSceneId"
            :element="selectedElement"
            :panel="panel"
            :linked-source="linkedSource"
          />
        </div>
      </div>
    </div>
  </div>
</template>
