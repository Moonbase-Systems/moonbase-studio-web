<script setup lang="ts">
import type { SceneId } from '../../../models/ids.domain';
import type { AudioVisualElement } from '../../../models/scene-elements';
import { useStudioSessionStore } from '../../../store/studio-session.store';
import InspectorAudioChain from '../cards/InspectorAudioChain.vue';
import InspectorAudioPresets from '../cards/InspectorAudioPresets.vue';
import InspectorCardAudio from '../cards/InspectorCardAudio.vue';
import InspectorAudioPreview from '../InspectorAudioPreview.vue';
import InspectorLayerFrame from '../InspectorLayerFrame.vue';

const props = defineProps<{
  sceneId: SceneId;
  element: AudioVisualElement;
}>();

const { t } = useI18n();
const store = useStudioSessionStore();

const channel = computed(() => store.project?.audioMixer.channels.find((item) => item.id === props.element.channelId));
</script>

<template>
  <InspectorLayerFrame
    :scene-id="sceneId"
    :element="element"
  >
    <template #preview>
      <InspectorAudioPreview
        v-if="channel"
        class="w-full"
        :channel-id="channel.id"
      />
    </template>
    <template #options>
      <InspectorCardAudio
        v-if="channel"
        :channel-id="channel.id"
        :scene-id="sceneId"
        :element="element"
      />
    </template>
    <template #effects>
      <div class="gap-xxx-sm flex w-full min-w-0 flex-col">
        <InspectorAudioChain
          v-if="channel"
          report-chain-error
          :location="{ scope: 'channel', channelId: channel.id }"
          :effects="channel.effects"
          :heading="t('studio.audio.effects')"
        />
        <InspectorAudioPresets
          v-if="channel"
          :channel-id="channel.id"
        />
      </div>
    </template>
  </InspectorLayerFrame>
</template>
