<script setup lang="ts">
import { useStudioAudioEngine } from '../../composables/useStudioAudioEngine';
import { FADER_DB_MAX, FADER_DB_MIN } from '../../models/audio.domain';
import type { ChannelId } from '../../models/ids.domain';
import { useStudioSessionStore } from '../../store/studio-session.store';
import AudioLevelMeter from './AudioLevelMeter.vue';
import AudioVolumeSlider from './AudioVolumeSlider.vue';

const props = defineProps<{
  channelId: ChannelId;
}>();

const store = useStudioSessionStore();
const audioEngine = useStudioAudioEngine();

const channel = computed(() => store.project?.audioMixer.channels.find((item) => item.id === props.channelId));

const levelDb = computed(() => audioEngine.levels.channels[props.channelId]?.rmsDb ?? -60);

function setVolume(faderDb: number) {
  const current = channel.value;
  if (!current) {
    return;
  }
  store.updateAudioChannel(current.id, {
    faderDb: Math.min(FADER_DB_MAX, Math.max(FADER_DB_MIN, faderDb)),
  });
}
</script>

<template>
  <div class="gap-md flex w-full max-w-[280px] flex-col items-center">
    <AudioLevelMeter :level-db="levelDb" />
    <AudioVolumeSlider
      wide
      :model-value="channel?.faderDb ?? 0"
      @change="setVolume"
    />
  </div>
</template>
