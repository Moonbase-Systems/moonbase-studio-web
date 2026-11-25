<script setup lang="ts">
import { cn } from '~/utils/index';

import {
  inspectorCardTitleForRail,
  type InspectorRailId,
  inspectorRailsForElementType,
} from '../../application/inspector-sections';
import type { AudioChannel } from '../../models/audio.domain';
import { displayNameSchema } from '../../schemas/display-name.schema';
import { useStudioSessionStore } from '../../store/studio-session.store';
import { sceneElementTypeIconName } from '../scene-element-list/scene-element-type-icons';
import InspectorAudioChain from './cards/InspectorAudioChain.vue';
import InspectorAudioPresets from './cards/InspectorAudioPresets.vue';
import InspectorCardAudio from './cards/InspectorCardAudio.vue';
import { inspectorBodyTextClass, inspectorFocusRingClass } from './inspector-control-classes';
import { inspectorRailIcon } from './inspector-rail-icon';
import InspectorAudioPreview from './InspectorAudioPreview.vue';

const props = defineProps<{
  channel: AudioChannel;
}>();

const store = useStudioSessionStore();
const { t } = useI18n();

const rails = inspectorRailsForElementType('audioVisual');
const activeRailId = ref<InspectorRailId>('source');
const cardTitle = computed(() => inspectorCardTitleForRail(activeRailId.value, 'audioVisual'));
const iconRailItems = computed(() =>
  rails.map((rail) => ({
    id: rail.id,
    label: t(rail.labelKey),
    ...inspectorRailIcon('audioVisual', rail.id),
  })),
);

const nameDraft = ref(props.channel.name);
const nameError = ref<string | null>(null);

watch(
  () => props.channel.name,
  (name) => {
    nameDraft.value = name;
  },
);

const fieldClass = cn(
  inspectorBodyTextClass,
  'h-control border border-line bg-transparent px-x-sm text-on-surface outline-none transition-colors duration-short hover:border-on-surface-dim focus:border-accent aria-[invalid=true]:border-error',
  inspectorFocusRingClass,
);

function commitName() {
  const parsed = displayNameSchema.safeParse(nameDraft.value);
  if (!parsed.success) {
    nameError.value = t('studio.scene.invalidName');
    return;
  }
  nameError.value = null;
  if (parsed.data === props.channel.name) {
    return;
  }
  const renamed = store.updateAudioChannel(props.channel.id, { name: parsed.data });
  if (!renamed.ok) {
    nameError.value = t('studio.properties.validationFailed');
    nameDraft.value = props.channel.name;
    return;
  }
  if (props.channel.sourceIds.length === 1) {
    const sourceId = props.channel.sourceIds[0];
    if (sourceId) {
      store.renameSource(sourceId, parsed.data);
    }
  }
}
</script>

<template>
  <div class="gap-md flex w-full min-w-0 flex-col">
    <div class="gap-x-sm flex min-w-0 items-center">
      <span
        class="text-accent size-xxxx-lg shrink-0"
        :aria-label="t('studio.scene.elementIcon.audioVisual')"
      >
        <Icon
          :name="sceneElementTypeIconName('audioVisual')"
          class="size-full"
        />
      </span>
      <div class="flex min-w-0 flex-1 flex-col">
        <input
          v-model="nameDraft"
          :class="cn(fieldClass, 'w-full text-left')"
          :aria-label="t('studio.audio.overlay.name')"
          :aria-invalid="nameError ? true : undefined"
          @change="commitName"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
        <p
          v-if="nameError"
          class="text-body-x-sm text-error mt-tiny font-sans"
        >
          {{ nameError }}
        </p>
      </div>
    </div>

    <div class="border-line py-md px-x-sm flex min-w-0 items-center justify-center border">
      <InspectorAudioPreview
        class="w-full"
        :channel-id="channel.id"
      />
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
        <InspectorCardAudio
          v-if="activeRailId === 'source'"
          :channel-id="channel.id"
        />
        <div
          v-else
          class="gap-xxx-sm flex w-full min-w-0 flex-col"
        >
          <InspectorAudioChain
            report-chain-error
            :location="{ scope: 'channel', channelId: channel.id }"
            :effects="channel.effects"
            :heading="t('studio.audio.effects')"
          />
          <InspectorAudioPresets :channel-id="channel.id" />
        </div>
      </BasePropertyCard>
    </div>
  </div>
</template>
