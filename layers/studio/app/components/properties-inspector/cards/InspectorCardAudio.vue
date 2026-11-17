<script setup lang="ts">
import { cn } from '~/utils/index';

import { useStudioAudioEngine } from '../../../composables/useStudioAudioEngine';
import {
  type AudioMonitoringMode,
  FADER_DB_MAX,
  FADER_DB_MIN,
  SYNC_OFFSET_MS_MAX,
  SYNC_OFFSET_MS_MIN,
  TRIM_DB_MAX,
  TRIM_DB_MIN,
} from '../../../models/audio.domain';
import type { SceneId } from '../../../models/ids.domain';
import type { AudioVisualElement } from '../../../models/scene-elements';
import type { AudioSource } from '../../../models/source.domain';
import { useStudioSessionStore } from '../../../store/studio-session.store';
import AudioBalanceSlider from '../AudioBalanceSlider.vue';
import AudioVolumeSlider from '../AudioVolumeSlider.vue';
import {
  inspectorChevronClass,
  inspectorControlTextClass,
  inspectorFocusRingClass,
  inspectorLabelClass,
  inspectorRowClass,
  inspectorToggleClass,
} from '../inspector-control-classes';
import InspectorAudioDevices from './InspectorAudioDevices.vue';

const props = defineProps<{
  sceneId: SceneId;
  element: AudioVisualElement;
}>();

const { t } = useI18n();
const store = useStudioSessionStore();
const audioEngine = useStudioAudioEngine();

const advancedOpen = ref(false);

const textControlClass = inspectorControlTextClass;
const labelClass = inspectorLabelClass;
const rowClass = inspectorRowClass;

const channel = computed(() => store.project?.audioMixer.channels.find((item) => item.id === props.element.channelId));

const channelSources = computed(() => {
  const ids = new Set(channel.value?.sourceIds ?? []);
  return (store.project?.sources.filter((source) => source.type === 'audio' && ids.has(source.id)) ??
    []) as AudioSource[];
});

function patchChannel(changes: Parameters<typeof store.updateAudioChannel>[1]) {
  const current = channel.value;
  if (!current) {
    return;
  }
  store.updateAudioChannel(current.id, changes);
}

function commitFader(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  patchChannel({ faderDb: Math.min(FADER_DB_MAX, Math.max(FADER_DB_MIN, value)) });
}

function setFader(faderDb: number) {
  patchChannel({ faderDb });
}

function commitGain(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  patchChannel({ trimDb: Math.min(TRIM_DB_MAX, Math.max(TRIM_DB_MIN, value)) });
}

function setPan(pan: number) {
  patchChannel({ pan });
}

function commitPan(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  patchChannel({ pan: Math.min(1, Math.max(-1, value / 100)) });
}

function commitOffset(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  patchChannel({
    syncOffsetMs: Math.min(SYNC_OFFSET_MS_MAX, Math.max(SYNC_OFFSET_MS_MIN, Math.round(value))),
  });
}

function cycleMonitoring() {
  const order: AudioMonitoringMode[] = ['off', 'monitor', 'monitor-and-output'];
  const current = channel.value?.monitoring ?? 'off';
  const next = order[(order.indexOf(current) + 1) % order.length] ?? 'off';
  patchChannel({ monitoring: next });
}

async function startFile() {
  const source = channelSources.value.find((item) => item.assetId);
  if (!source?.assetId) {
    return;
  }
  const asset = store.project?.assets.find((item) => item.id === source.assetId);
  if (asset?.location.kind !== 'remoteUrl') {
    return;
  }
  await audioEngine.armFile(source.id, asset.location.url);
}

function removeGroupedSource(sourceId: string) {
  const current = channel.value;
  if (!current) {
    return;
  }
  store.removeAudioSource(current.id, sourceId);
}

function decorationClass(active: boolean) {
  return inspectorToggleClass(active);
}
</script>

<template>
  <div class="gap-xxx-sm flex w-full min-w-0 flex-col items-stretch">
    <InspectorAudioDevices
      :scene-id="sceneId"
      :element="element"
    />

    <div
      v-for="source in channelSources"
      :key="source.id"
      :class="rowClass"
    >
      <span :class="cn(labelClass, 'truncate')">{{ source.name }}</span>
      <button
        type="button"
        :class="decorationClass(false)"
        @click="removeGroupedSource(source.id)"
      >
        {{ t('studio.properties.labels.removeSource') }}
      </button>
    </div>

    <div :class="rowClass">
      <span :class="labelClass">{{ t('studio.properties.fields.volume') }}</span>
      <BaseScrubField
        compact
        label=" "
        field-suffix="horizontal"
        suffix="dB"
        field-class="w-[72px]"
        :model-value="channel?.faderDb ?? 0"
        :min="FADER_DB_MIN"
        :max="FADER_DB_MAX"
        :step="0.5"
        @change="commitFader"
      />
      <AudioVolumeSlider
        :model-value="channel?.faderDb ?? 0"
        @change="setFader"
      />
    </div>

    <div :class="rowClass">
      <button
        type="button"
        :class="decorationClass(channel?.muted === true)"
        :aria-pressed="channel?.muted === true"
        @click="patchChannel({ muted: !(channel?.muted ?? false) })"
      >
        {{ t('studio.properties.labels.mute') }}
      </button>
      <button
        type="button"
        :class="decorationClass(channel?.solo === true)"
        :aria-pressed="channel?.solo === true"
        @click="patchChannel({ solo: !(channel?.solo ?? false) })"
      >
        {{ t('studio.properties.labels.solo') }}
      </button>
      <button
        type="button"
        :class="decorationClass(channel?.monitoring !== 'off')"
        :aria-pressed="channel?.monitoring !== 'off'"
        @click="cycleMonitoring"
      >
        {{ t('studio.properties.labels.monitor') }}
      </button>
    </div>

    <button
      type="button"
      :class="
        cn(textControlClass, 'h-row gap-xxx-sm px-xxx-sm hover:text-accent flex items-center', inspectorFocusRingClass)
      "
      :aria-expanded="advancedOpen"
      @click="advancedOpen = !advancedOpen"
    >
      {{ t('studio.properties.labels.advanced') }}
      <span :class="cn(inspectorChevronClass, advancedOpen && 'rotate-90')"> &gt; </span>
    </button>

    <template v-if="advancedOpen">
      <div :class="rowClass">
        <span :class="labelClass">{{ t('studio.properties.labels.gain') }}</span>
        <BaseScrubField
          compact
          label=" "
          field-suffix="horizontal"
          suffix="dB"
          field-class="w-[88px]"
          :model-value="channel?.trimDb ?? 0"
          :min="TRIM_DB_MIN"
          :max="TRIM_DB_MAX"
          :step="0.5"
          @change="commitGain"
        />
      </div>

      <div :class="rowClass">
        <span :class="labelClass">{{ t('studio.properties.labels.balance') }}</span>
        <BaseScrubField
          compact
          label=" "
          field-suffix="horizontal"
          field-class="w-[64px]"
          :model-value="Math.round((channel?.pan ?? 0) * 100)"
          :min="-100"
          :max="100"
          :step="1"
          @change="commitPan"
        />
        <AudioBalanceSlider
          :model-value="channel?.pan ?? 0"
          @change="setPan"
        />
      </div>

      <div :class="rowClass">
        <span :class="labelClass">{{ t('studio.properties.labels.offset') }}</span>
        <BaseScrubField
          compact
          label=" "
          field-suffix="horizontal"
          suffix="ms"
          field-class="w-[96px]"
          :model-value="channel?.syncOffsetMs ?? 0"
          :min="SYNC_OFFSET_MS_MIN"
          :max="SYNC_OFFSET_MS_MAX"
          :step="1"
          @change="commitOffset"
        />
      </div>
      <div
        v-if="channelSources.some((source) => source.assetId)"
        :class="rowClass"
      >
        <button
          type="button"
          :class="decorationClass(false)"
          @click="startFile"
        >
          {{ t('studio.properties.labels.startFile') }}
        </button>
      </div>
    </template>
  </div>
</template>
