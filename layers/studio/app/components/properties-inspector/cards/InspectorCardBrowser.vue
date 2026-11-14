<script setup lang="ts">
import { cn } from '~/utils/index';

import type { BrowserElement } from '../../../models/scene-elements';
import { useStudioSessionStore } from '../../../store/studio-session.store';
import {
  inspectorControlTextClass,
  inspectorFieldShellClass,
  inspectorLabelClass,
  inspectorRowClass,
  inspectorToggleClass,
} from '../inspector-control-classes';

const props = defineProps<{
  element: BrowserElement;
}>();

const { t } = useI18n();
const store = useStudioSessionStore();

const textControlClass = inspectorControlTextClass;
const labelClass = inspectorLabelClass;
const rowClass = inspectorRowClass;
const fieldShellClass = cn(inspectorFieldShellClass, 'flex-1');

const source = computed(() => {
  const linked = store.project?.sources.find((item) => item.id === props.element.sourceId);
  return linked?.type === 'browser' ? linked : null;
});

const urlDraft = ref('');
const urlFocused = ref(false);

watch(
  () => source.value?.url,
  (url) => {
    if (!urlFocused.value && url) {
      urlDraft.value = url;
    }
  },
  { immediate: true },
);

function commitUrl() {
  const linked = source.value;
  const url = urlDraft.value.trim();
  if (!linked || url === linked.url) {
    return;
  }
  const result = store.updateBrowserSource(linked.id, { url });
  if (!result.ok) {
    urlDraft.value = linked.url;
  }
}

function commitInterval(raw: string) {
  const linked = source.value;
  const value = Number(raw);
  if (!linked || !Number.isFinite(value)) {
    return;
  }
  store.updateBrowserSource(linked.id, {
    refreshSettings: { intervalMs: value <= 0 ? null : value },
  });
}

function toggleRefreshOnActivate() {
  const linked = source.value;
  if (!linked) {
    return;
  }
  store.updateBrowserSource(linked.id, {
    refreshSettings: { refreshOnActivate: !linked.refreshSettings.refreshOnActivate },
  });
}

function toggleBypassCache() {
  const linked = source.value;
  if (!linked) {
    return;
  }
  store.updateBrowserSource(linked.id, {
    refreshSettings: { bypassCache: !linked.refreshSettings.bypassCache },
  });
}

function toggleClass(active: boolean) {
  return inspectorToggleClass(active);
}
</script>

<template>
  <div
    v-if="source"
    class="gap-xxx-sm flex w-full min-w-0 flex-col items-stretch"
  >
    <div :class="cn(rowClass, 'flex-nowrap')">
      <span :class="labelClass">{{ t('studio.properties.labels.browserUrl') }}</span>
      <label :class="fieldShellClass">
        <input
          v-model="urlDraft"
          type="url"
          :class="cn(textControlClass, 'min-w-0 flex-1 border-0 bg-transparent p-0 outline-none')"
          @focus="urlFocused = true"
          @blur="
            urlFocused = false;
            commitUrl();
          "
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
      </label>
    </div>

    <div :class="rowClass">
      <BaseScrubField
        compact
        :label="t('studio.properties.labels.refreshInterval')"
        field-suffix="horizontal"
        suffix="ms"
        field-class="w-[72px]"
        :model-value="source.refreshSettings.intervalMs ?? 0"
        :min="0"
        @change="commitInterval"
      />
      <button
        type="button"
        :class="toggleClass(source.refreshSettings.refreshOnActivate)"
        :aria-pressed="source.refreshSettings.refreshOnActivate"
        @click="toggleRefreshOnActivate"
      >
        {{ t('studio.properties.labels.refreshOnActivate') }}
      </button>
      <button
        type="button"
        :class="toggleClass(source.refreshSettings.bypassCache)"
        :aria-pressed="source.refreshSettings.bypassCache"
        @click="toggleBypassCache"
      >
        {{ t('studio.properties.labels.bypassCache') }}
      </button>
    </div>
  </div>
</template>
