<script setup lang="ts">
import { cn } from '~/utils/index';

import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../../models/ids.domain';
import type { ScreenElement } from '../../../models/scene-elements';
import type { ScreenSource, Source } from '../../../models/source.domain';
import { captureConstraints, projectCaptureFrame } from '../../../playback/screen-capture-constraints';
import { useStudioSessionStore } from '../../../store/studio-session.store';
import InspectorLayerFrame from '../InspectorLayerFrame.vue';
import InspectorScreenPreview from '../InspectorScreenPreview.vue';
import { holdScreenPreviewStream } from '../screen-preview-stream';

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
const panelStyle = ref<Record<string, string>>({ left: '0px', top: '0px' });
const picking = ref(false);

const textControlClass = 'font-inter text-body-sm font-medium tracking-normal text-white';
const fieldShellClass =
  'flex h-[24px] min-w-[120px] items-center gap-[8px] border border-transparent bg-[color-mix(in_srgb,white_5%,#050004)] px-[4px] focus-within:border-[#22FF86]';

const linkedScreen = computed(() => (props.linkedSource?.type === 'screen' ? props.linkedSource : null));

const screenSources = computed(() => store.project?.sources.filter((source) => source.type === 'screen') ?? []);

const sourceLabel = computed(() => {
  const source = linkedScreen.value;
  if (!source || !source.width || !source.height) {
    return t('studio.properties.screen.choose');
  }
  return source.name;
});

function placePanel() {
  const trigger = triggerRef.value;
  if (!trigger) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const width = 220;
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const spaceAbove = rect.top - 8;
  const openBelow = spaceBelow >= spaceAbove;
  const maxHeight = Math.max(96, Math.min(280, openBelow ? spaceBelow : spaceAbove));
  panelStyle.value = openBelow
    ? { left: `${left}px`, top: `${rect.bottom + 4}px`, width: `${width}px`, maxHeight: `${maxHeight}px` }
    : {
        left: `${left}px`,
        bottom: `${window.innerHeight - rect.top + 4}px`,
        width: `${width}px`,
        maxHeight: `${maxHeight}px`,
      };
}

function togglePanel() {
  if (!open.value) {
    placePanel();
  }
  open.value = !open.value;
}

function setShowCursor(value: boolean) {
  updateSettings(props.sceneId, props.element, { showCursor: value });
}

function selectScreen(sourceId: string) {
  const ok = applyUpdate(props.sceneId, props.element.id, { sourceId });
  if (ok) {
    open.value = false;
  }
}

function isEmptyScreen(source: ScreenSource) {
  return !(source.width && source.height);
}

async function readCaptureSize(stream: MediaStream) {
  const track = stream.getVideoTracks()[0];
  const settings = track?.getSettings();
  if (settings?.width && settings?.height) {
    return { width: settings.width, height: settings.height, label: track?.label ?? '' };
  }

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  const size = await new Promise<{ width?: number; height?: number }>((resolve) => {
    const finish = (width?: number, height?: number) => {
      video.srcObject = null;
      resolve({ width, height });
    };
    video.onloadedmetadata = () => {
      finish(
        video.videoWidth > 0 ? video.videoWidth : undefined,
        video.videoHeight > 0 ? video.videoHeight : undefined,
      );
    };
    video.onerror = () => finish();
  });
  return { width: size.width, height: size.height, label: track?.label ?? '' };
}

async function pickDisplay() {
  if (!navigator.mediaDevices?.getDisplayMedia || picking.value) {
    return;
  }
  picking.value = true;
  open.value = false;
  let stream: MediaStream | null = null;
  const frame = store.project?.settings.video;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        ...(frame ? captureConstraints(projectCaptureFrame(frame)) : {}),
        cursor: props.element.settings.showCursor ? 'always' : 'never',
      } as MediaTrackConstraints,
      audio: false,
    });
    const size = await readCaptureSize(stream);
    const width = size.width ?? frame?.width;
    const height = size.height ?? frame?.height;
    const name = (size.label || t('studio.properties.cardTitles.screen')).slice(0, 128);
    const sourceIdsBefore = new Set(store.project?.sources.map((source) => source.id) ?? []);
    const previousSourceId = props.element.sourceId;
    const previous = linkedScreen.value;
    const previousWasEmpty = previous ? isEmptyScreen(previous) : false;

    const added = store.addSource({
      type: 'screen',
      name,
      ...(width && height ? { width, height } : {}),
    });
    if (!added.ok) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      return;
    }

    const created = store.project?.sources.find((source) => !sourceIdsBefore.has(source.id));
    if (!created) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      return;
    }

    holdScreenPreviewStream(created.id, stream);
    stream = null;
    const linked = store.updateLayer(props.sceneId, props.element.id, { sourceId: created.id });
    if (!linked.ok) {
      return;
    }
    if (previousWasEmpty && previousSourceId !== created.id) {
      store.removeSource(previousSourceId);
    }
  } catch {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
  } finally {
    picking.value = false;
  }
}
</script>

<template>
  <InspectorLayerFrame
    :scene-id="sceneId"
    :element="element"
  >
    <template #preview>
      <InspectorScreenPreview :element="element" />
    </template>
    <template #options>
      <div class="flex w-full max-w-[464px] flex-col items-center gap-[10px]">
        <div class="flex items-center gap-[10px]">
          <span :class="cn(textControlClass, 'shrink-0')">{{ t('studio.properties.labels.source') }}</span>
          <div :class="cn(fieldShellClass, textControlClass)">
            <button
              type="button"
              class="min-w-0 flex-1 truncate text-left"
              :disabled="picking"
              @click="pickDisplay"
            >
              {{ sourceLabel }}
            </button>
            <button
              ref="triggerRef"
              type="button"
              class="text-[12px] transition-transform duration-200"
              :class="open ? 'rotate-180' : ''"
              :aria-expanded="open"
              :aria-label="t('studio.properties.labels.source')"
              @click="togglePanel"
            >
              &gt;
            </button>
          </div>
        </div>

        <BaseToggleDot
          :model-value="element.settings.showCursor"
          label-typography="inspector"
          :label="t('studio.properties.labels.cursor')"
          @change="setShowCursor"
        />

        <Teleport to="body">
          <button
            v-if="open"
            type="button"
            class="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="close"
            @click="open = false"
          />
          <div
            v-if="open"
            class="fixed z-50 flex flex-col gap-[6px] overflow-y-auto border border-white/15 bg-[color-mix(in_srgb,white_8%,#050004)] p-[10px]"
            :style="panelStyle"
          >
            <button
              type="button"
              :class="cn(textControlClass, 'h-[24px] shrink-0 px-[8px] text-left')"
              @click="pickDisplay"
            >
              {{ t('studio.properties.screen.choose') }}
            </button>
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
                  'h-[24px] shrink-0 px-[8px] text-left',
                  source.id === element.sourceId
                    ? 'bg-[#22FF86] text-[#050004]'
                    : 'text-white hover:bg-[#22FF86] hover:text-[#050004]',
                )
              "
              @click="selectScreen(source.id)"
            >
              <span class="truncate">{{ source.name }}</span>
            </button>
          </div>
        </Teleport>
      </div>
    </template>
  </InspectorLayerFrame>
</template>
