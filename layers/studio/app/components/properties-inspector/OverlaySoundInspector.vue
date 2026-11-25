<script setup lang="ts">
import { useStudioOverlayPlayback } from '../../composables/useStudioOverlayPlayback';
import {
  OVERLAY_COOLDOWN_MS_MAX,
  OVERLAY_CUE_EVENTS,
  OVERLAY_FADER_DB_MAX,
  OVERLAY_FADER_DB_MIN,
  OVERLAY_PLAYBACK_RATE_MAX,
  OVERLAY_PLAYBACK_RATE_MIN,
  OVERLAY_SOUND_INSTANCES_MAX,
  OVERLAY_VOLUME_DB_MAX,
  OVERLAY_VOLUME_DB_MIN,
  type OverlayCueEvent,
  type OverlayMonitoringMode,
  type OverlayRestartPolicy,
  type OverlaySceneChangePolicy,
  type OverlaySound,
} from '../../models/overlay-sound.domain';
import { useStudioSessionStore } from '../../store/studio-session.store';
import InspectorAudioChain from './cards/InspectorAudioChain.vue';
import { inspectorLabelClass, inspectorRowClass, inspectorToggleClass } from './inspector-control-classes';

const props = defineProps<{
  sound: OverlaySound;
}>();

const store = useStudioSessionStore();
const playback = useStudioOverlayPlayback();
const { t } = useI18n();

const bus = computed(() => store.project?.audioMixer.overlay ?? null);
const audioAssets = computed(() => store.project?.assets.filter((asset) => asset.type === 'audio') ?? []);
const triggers = computed(() => bus.value?.triggers.filter((trigger) => trigger.soundId === props.sound.id) ?? []);
const instances = computed(() => playback.instances.value.filter((instance) => instance.soundId === props.sound.id));
const errorText = computed(() => {
  const code = playback.error.value;
  if (code === 'missing-bytes') {
    return t('studio.audio.overlay.missingBytes');
  }
  if (code === 'decode-failed') {
    return t('studio.audio.overlay.decodeFailed');
  }
  return null;
});

const triggerEvent = ref<OverlayCueEvent>('custom');
const triggerSceneId = ref('');
const triggerElementId = ref('');

const sceneElements = computed(() => {
  const scene = store.project?.scenes.find((item) => item.id === triggerSceneId.value);
  return scene?.elements ?? [];
});

function numberFrom(raw: string) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function monitorLabel(mode: OverlayMonitoringMode) {
  if (mode === 'monitor') {
    return t('studio.audio.overlay.monitorOnly');
  }
  if (mode === 'monitor-and-output') {
    return t('studio.audio.overlay.monitorBoth');
  }
  return t('studio.audio.overlay.monitorOff');
}

function cycleMonitor() {
  if (!bus.value) {
    return;
  }
  const order: OverlayMonitoringMode[] = ['off', 'monitor', 'monitor-and-output'];
  const next = order[(order.indexOf(bus.value.monitoring) + 1) % order.length] ?? 'off';
  store.updateOverlayBus({ monitoring: next });
}

function cycleScenePolicy() {
  if (!bus.value) {
    return;
  }
  const order: OverlaySceneChangePolicy[] = ['continue', 'stop-scene-sounds', 'stop-all-overlay-sounds'];
  const next = order[(order.indexOf(bus.value.sceneChangePolicy) + 1) % order.length] ?? 'continue';
  store.updateOverlayBus({ sceneChangePolicy: next });
}

function cycleSoundPolicy() {
  const order: OverlayRestartPolicy[] = ['allow', 'restart', 'ignore', 'queue'];
  const next = order[(order.indexOf(props.sound.restartPolicy) + 1) % order.length] ?? 'allow';
  store.updateOverlaySound(props.sound.id, { restartPolicy: next });
}

function cycleEvent() {
  const next = OVERLAY_CUE_EVENTS[(OVERLAY_CUE_EVENTS.indexOf(triggerEvent.value) + 1) % OVERLAY_CUE_EVENTS.length];
  if (next) {
    triggerEvent.value = next;
  }
}

function cycleScene() {
  const ids = ['', ...(store.project?.scenes.map((scene) => scene.id) ?? [])];
  const next = ids[(ids.indexOf(triggerSceneId.value) + 1) % ids.length] ?? '';
  triggerSceneId.value = next;
  triggerElementId.value = '';
}

function cycleElement() {
  const ids = ['', ...sceneElements.value.map((element) => element.id)];
  triggerElementId.value = ids[(ids.indexOf(triggerElementId.value) + 1) % ids.length] ?? '';
}

function addTrigger() {
  store.addOverlayTrigger({
    soundId: props.sound.id,
    event: triggerEvent.value,
    ...(triggerSceneId.value ? { sceneId: triggerSceneId.value } : {}),
    ...(triggerElementId.value ? { elementId: triggerElementId.value } : {}),
  });
}

function stopSound() {
  for (const instance of instances.value) {
    playback.stop(instance.id);
  }
}
</script>

<template>
  <div
    v-if="bus"
    class="gap-md flex flex-col"
  >
    <h2 class="text-title text-on-surface font-sans font-light">
      {{ sound.name }}
    </h2>

    <p
      v-if="errorText"
      class="text-body-sm text-accent font-sans"
      role="status"
    >
      {{ errorText }}
    </p>

    <section class="gap-xxx-sm flex flex-col">
      <h3 :class="inspectorLabelClass">
        {{ t('studio.audio.overlay.title') }}
      </h3>
      <div :class="inspectorRowClass">
        <span :class="inspectorLabelClass">{{ t('studio.audio.overlay.fader') }}</span>
        <BaseScrubField
          compact
          label=" "
          field-suffix="horizontal"
          suffix="dB"
          field-class="w-[72px]"
          :model-value="bus.faderDb"
          :min="OVERLAY_FADER_DB_MIN"
          :max="OVERLAY_FADER_DB_MAX"
          :step="0.5"
          @change="store.updateOverlayBus({ faderDb: numberFrom($event) })"
        />
        <button
          type="button"
          :class="inspectorToggleClass(bus.muted)"
          :aria-pressed="bus.muted"
          @click="store.updateOverlayBus({ muted: !bus.muted })"
        >
          {{ t('studio.audio.overlay.mute') }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(bus.solo)"
          :aria-pressed="bus.solo"
          @click="store.updateOverlayBus({ solo: !bus.solo })"
        >
          {{ t('studio.audio.overlay.solo') }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(bus.monitoring !== 'off')"
          :aria-pressed="bus.monitoring !== 'off'"
          @click="cycleMonitor"
        >
          {{ monitorLabel(bus.monitoring) }}
        </button>
      </div>
      <div :class="inspectorRowClass">
        <span :class="inspectorLabelClass">{{ t('studio.audio.overlay.busLimit') }}</span>
        <BaseScrubField
          compact
          label=" "
          field-suffix="horizontal"
          :model-value="bus.maxInstances"
          :min="1"
          :max="64"
          :step="1"
          @change="store.updateOverlayBus({ maxInstances: Math.round(numberFrom($event)) })"
        />
        <button
          type="button"
          :class="inspectorToggleClass(false)"
          @click="cycleScenePolicy"
        >
          {{ t(`studio.audio.overlay.scenePolicies.${bus.sceneChangePolicy}`) }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(false)"
          @click="playback.stopAll()"
        >
          {{ t('studio.audio.overlay.stopAll') }}
        </button>
      </div>
      <InspectorAudioChain
        :location="{ scope: 'overlay' }"
        :effects="bus.effects"
        :heading="t('studio.audio.overlay.effects')"
      />
    </section>

    <section class="gap-xxx-sm flex flex-col">
      <h3 :class="inspectorLabelClass">
        {{ t('studio.audio.overlay.sounds') }}
      </h3>
      <div :class="inspectorRowClass">
        <button
          type="button"
          :class="inspectorToggleClass(false)"
          @click="playback.play(sound.id)"
        >
          {{ t('studio.audio.overlay.play') }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(false)"
          @click="stopSound"
        >
          {{ t('studio.audio.overlay.stop') }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(sound.enabled)"
          :aria-pressed="sound.enabled"
          @click="store.updateOverlaySound(sound.id, { enabled: !sound.enabled })"
        >
          {{ t('studio.audio.overlay.enabled') }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(sound.loop)"
          :aria-pressed="sound.loop"
          @click="store.updateOverlaySound(sound.id, { loop: !sound.loop })"
        >
          {{ t('studio.audio.overlay.loop') }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(false)"
          @click="cycleSoundPolicy"
        >
          {{ t(`studio.audio.overlay.policies.${sound.restartPolicy}`) }}
        </button>
      </div>
      <div :class="inspectorRowClass">
        <span :class="inspectorLabelClass">{{ t('studio.audio.overlay.volume') }}</span>
        <BaseScrubField
          compact
          label=" "
          field-suffix="horizontal"
          suffix="dB"
          field-class="w-[72px]"
          :model-value="sound.volumeDb"
          :min="OVERLAY_VOLUME_DB_MIN"
          :max="OVERLAY_VOLUME_DB_MAX"
          :step="0.5"
          @change="store.updateOverlaySound(sound.id, { volumeDb: numberFrom($event) })"
        />
        <span :class="inspectorLabelClass">{{ t('studio.audio.overlay.playbackRate') }}</span>
        <BaseScrubField
          compact
          label=" "
          field-suffix="horizontal"
          :model-value="sound.playbackRate"
          :min="OVERLAY_PLAYBACK_RATE_MIN"
          :max="OVERLAY_PLAYBACK_RATE_MAX"
          :step="0.05"
          @change="store.updateOverlaySound(sound.id, { playbackRate: numberFrom($event) })"
        />
      </div>
      <div :class="inspectorRowClass">
        <span :class="inspectorLabelClass">{{ t('studio.audio.overlay.cooldown') }}</span>
        <BaseScrubField
          compact
          label=" "
          field-suffix="horizontal"
          :model-value="sound.cooldownMs"
          :min="0"
          :max="OVERLAY_COOLDOWN_MS_MAX"
          :step="50"
          @change="store.updateOverlaySound(sound.id, { cooldownMs: Math.round(numberFrom($event)) })"
        />
        <span :class="inspectorLabelClass">{{ t('studio.audio.overlay.maxInstances') }}</span>
        <BaseScrubField
          compact
          label=" "
          field-suffix="horizontal"
          :model-value="sound.maxInstances"
          :min="1"
          :max="OVERLAY_SOUND_INSTANCES_MAX"
          :step="1"
          @change="store.updateOverlaySound(sound.id, { maxInstances: Math.round(numberFrom($event)) })"
        />
      </div>
      <div :class="inspectorRowClass">
        <span :class="inspectorLabelClass">{{ t('studio.audio.overlay.asset') }}</span>
        <button
          v-for="asset in audioAssets"
          :key="asset.id"
          type="button"
          :class="inspectorToggleClass(asset.id === sound.assetId)"
          :aria-pressed="asset.id === sound.assetId"
          @click="store.updateOverlaySound(sound.id, { assetId: asset.id })"
        >
          {{ asset.name }}
        </button>
      </div>
    </section>

    <section class="gap-xxx-sm flex flex-col">
      <h3 :class="inspectorLabelClass">
        {{ t('studio.audio.overlay.triggers') }}
      </h3>
      <p
        v-if="triggers.length === 0"
        class="text-body-sm text-on-surface-dim font-sans"
      >
        {{ t('studio.audio.overlay.noTriggers') }}
      </p>
      <div
        v-for="trigger in triggers"
        :key="trigger.id"
        :class="inspectorRowClass"
      >
        <button
          type="button"
          :class="inspectorToggleClass(trigger.enabled)"
          :aria-pressed="trigger.enabled"
          @click="store.updateOverlayTrigger(trigger.id, { enabled: !trigger.enabled })"
        >
          {{ t(`studio.audio.overlay.events.${trigger.event}`) }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(false)"
          @click="store.removeOverlayTrigger(trigger.id)"
        >
          {{ t('studio.audio.overlay.remove') }}
        </button>
      </div>
      <div :class="inspectorRowClass">
        <button
          type="button"
          :class="inspectorToggleClass(false)"
          @click="cycleEvent"
        >
          {{ t(`studio.audio.overlay.events.${triggerEvent}`) }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(triggerSceneId !== '')"
          :aria-pressed="triggerSceneId !== ''"
          @click="cycleScene"
        >
          {{
            store.project?.scenes.find((scene) => scene.id === triggerSceneId)?.name ??
            t('studio.audio.overlay.anyScene')
          }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(triggerElementId !== '')"
          :aria-pressed="triggerElementId !== ''"
          @click="cycleElement"
        >
          {{
            sceneElements.find((element) => element.id === triggerElementId)?.name ??
            t('studio.audio.overlay.anyElement')
          }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(false)"
          @click="addTrigger"
        >
          {{ t('studio.audio.overlay.addTrigger') }}
        </button>
      </div>
      <p
        v-if="instances.length === 0"
        class="text-body-sm text-on-surface-dim font-sans"
      >
        {{ t('studio.audio.overlay.noInstances') }}
      </p>
      <div
        v-for="instance in instances"
        :key="instance.id"
        :class="inspectorRowClass"
      >
        <span class="text-body-sm text-on-surface font-sans">{{ instance.id }}</span>
        <button
          type="button"
          :class="inspectorToggleClass(false)"
          @click="playback.stop(instance.id)"
        >
          {{ t('studio.audio.overlay.stop') }}
        </button>
      </div>
    </section>
  </div>
</template>
