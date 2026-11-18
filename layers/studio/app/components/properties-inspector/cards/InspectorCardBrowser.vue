<script setup lang="ts">
import { cn } from '~/utils/index';

import { useStudioAudioDevices } from '../../../composables/useStudioAudioDevices';
import type { BrowserElement } from '../../../models/scene-elements';
import { BROWSER_TAB_AUDIO_DEVICE_ID } from '../../../models/source.domain';
import { browserZoom, isExternalBrowserPageUrl } from '../../../schemas/browser-source.schema';
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
const devices = useStudioAudioDevices();

const textControlClass = inspectorControlTextClass;
const labelClass = inspectorLabelClass;
const rowClass = inspectorRowClass;
const fieldShellClass = cn(inspectorFieldShellClass, 'flex-1');

const source = computed(() => {
  const linked = store.project?.sources.find((item) => item.id === props.element.sourceId);
  return linked?.type === 'browser' ? linked : null;
});

const externalPage = computed(() => isExternalBrowserPageUrl(source.value?.url));
const pageAudio = computed(() => source.value?.audio === true);
const hintId = computed(() => (source.value ? `browser-audio-${source.value.id}` : undefined));

function tabAudioSource() {
  return store.project?.sources.find((item) => item.type === 'audio' && item.deviceId === BROWSER_TAB_AUDIO_DEVICE_ID);
}

function stopStream(stream: MediaStream | null) {
  if (!stream) {
    return;
  }
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function selectTabChannel() {
  const audio = tabAudioSource();
  const channel = store.project?.audioMixer.channels.find((item) => audio && item.sourceIds.includes(audio.id));
  if (channel) {
    store.selectGlobalChannel(channel.id);
  }
}

async function togglePageAudio() {
  const linked = source.value;
  if (!linked) {
    return;
  }
  if (linked.audio === true) {
    store.setBrowserPageAudio(linked.id, false);
    return;
  }
  const stream = devices.browserTabLive ? null : await devices.captureBrowserTab();
  if (!devices.browserTabLive && !stream) {
    return;
  }
  const result = store.setBrowserPageAudio(linked.id, true);
  if (!result.ok) {
    stopStream(stream);
    return;
  }
  const audio = tabAudioSource();
  if (stream && audio) {
    devices.attachBrowserTab(audio.id, stream);
  } else {
    stopStream(stream);
  }
  selectTabChannel();
}

async function connectPageAudio() {
  const linked = source.value;
  if (!linked) {
    return;
  }
  const stream = await devices.captureBrowserTab();
  if (!stream) {
    return;
  }
  if (!tabAudioSource()) {
    const healed = store.setBrowserPageAudio(linked.id, true);
    if (!healed.ok) {
      stopStream(stream);
      return;
    }
  }
  const audio = tabAudioSource();
  if (!audio) {
    stopStream(stream);
    return;
  }
  devices.attachBrowserTab(audio.id, stream);
  selectTabChannel();
}

const urlDraft = ref('');
const urlFocused = ref(false);

watch(
  () => source.value?.url,
  (url) => {
    if (!urlFocused.value) {
      urlDraft.value = url ?? '';
    }
  },
  { immediate: true },
);

const zoomPercent = computed(() => Math.round(browserZoom(source.value?.zoom) * 100));

function commitZoom(raw: string) {
  const linked = source.value;
  const percent = Number(raw);
  if (!linked || !Number.isFinite(percent)) {
    return;
  }
  const zoom = Math.round(percent) / 100;
  if (zoom === browserZoom(linked.zoom)) {
    return;
  }
  store.updateBrowserSource(linked.id, { zoom });
}

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
          type="text"
          inputmode="url"
          spellcheck="false"
          :placeholder="t('studio.properties.labels.browserUrlPlaceholder')"
          :class="
            cn(
              textControlClass,
              'placeholder:text-on-surface-dim min-w-0 flex-1 border-0 bg-transparent p-0 outline-none',
            )
          "
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
      <button
        type="button"
        :class="toggleClass(pageAudio)"
        :aria-pressed="pageAudio"
        :aria-describedby="pageAudio ? hintId : undefined"
        @click="togglePageAudio"
      >
        {{ t('studio.properties.labels.browserAudio') }}
      </button>
      <button
        v-if="pageAudio && !devices.browserTabLive"
        type="button"
        :class="toggleClass(false)"
        @click="connectPageAudio"
      >
        {{ t('studio.properties.labels.browserAudioConnect') }}
      </button>
    </div>
    <p
      v-if="pageAudio"
      :id="hintId"
      class="text-label text-on-surface-dim"
    >
      {{ t('studio.properties.labels.browserAudioHint') }}
    </p>

    <BaseScrubField
      v-if="!externalPage"
      compact
      :label="t('studio.properties.labels.browserZoom')"
      field-suffix="horizontal"
      suffix="%"
      field-class="w-[72px]"
      :model-value="zoomPercent"
      :min="100"
      :max="400"
      :step="10"
      @change="commitZoom"
    />

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
