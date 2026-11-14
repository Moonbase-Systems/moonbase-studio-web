<script setup lang="ts">
import { cn } from '~/utils/index';

import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../../models/ids.domain';
import type { ScreenElement } from '../../../models/scene-elements';
import type { ScreenSource, Source } from '../../../models/source.domain';
import { captureConstraints, projectCaptureFrame } from '../../../playback/screen-capture-constraints';
import { useStudioSessionStore } from '../../../store/studio-session.store';
import {
  inspectorChevronClass,
  inspectorControlTextClass,
  inspectorFieldShellClass,
  inspectorFocusRingClass,
  inspectorLabelClass,
  inspectorMenuItemClass,
  inspectorMenuPanelClass,
} from '../inspector-control-classes';
import InspectorLayerFrame from '../InspectorLayerFrame.vue';
import InspectorScreenPreview from '../InspectorScreenPreview.vue';
import { holdScreenPreviewStream, peekScreenPreviewStream } from '../screen-preview-stream';

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

const textControlClass = inspectorControlTextClass;
const fieldShellClass = cn(inspectorFieldShellClass, 'min-w-[120px]');

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
  // Apply on the live track; do not rebuild the Pixi screen (that would flash black after a minimise).
  const stream = peekScreenPreviewStream(props.element.sourceId);
  if (!stream) {
    return;
  }
  void Promise.all(
    stream
      .getVideoTracks()
      .map((track) =>
        track.applyConstraints({ cursor: value ? 'always' : 'never' } as MediaTrackConstraints).catch(() => undefined),
      ),
  );
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
      <div class="gap-x-sm flex w-full max-w-[464px] flex-col items-center">
        <div class="gap-x-sm flex items-center">
          <span :class="inspectorLabelClass">{{ t('studio.properties.labels.source') }}</span>
          <div :class="fieldShellClass">
            <button
              type="button"
              :class="cn('disabled:text-on-surface-dim min-w-0 flex-1 truncate text-left', inspectorFocusRingClass)"
              :disabled="picking"
              @click="pickDisplay"
            >
              {{ sourceLabel }}
            </button>
            <button
              ref="triggerRef"
              type="button"
              :class="cn(inspectorChevronClass, 'hover:text-on-surface', inspectorFocusRingClass, open && 'rotate-180')"
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
            :class="cn(inspectorMenuPanelClass, 'overflow-y-auto')"
            :style="panelStyle"
          >
            <button
              type="button"
              :class="inspectorMenuItemClass()"
              @click="pickDisplay"
            >
              {{ t('studio.properties.screen.choose') }}
            </button>
            <p
              v-if="screenSources.length === 0"
              :class="cn(textControlClass, 'px-xxx-sm text-on-surface-dim')"
            >
              {{ t('studio.properties.noScreens') }}
            </p>
            <button
              v-for="source in screenSources"
              :key="source.id"
              type="button"
              :class="
                cn(
                  inspectorMenuItemClass(),
                  source.id === element.sourceId && 'bg-accent text-on-accent hover:bg-accent-dim',
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
