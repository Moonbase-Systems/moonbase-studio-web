<script setup lang="ts">
import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { ElementCrop } from '../../../models/common.domain';
import type { SceneId } from '../../../models/ids.domain';
import type { SceneElement } from '../../../models/scene-element.domain';
import { useStudioSessionStore } from '../../../store/studio-session.store';
import InspectorTransformCropField from './InspectorTransformCropField.vue';

const props = defineProps<{
  sceneId: SceneId;
  element: SceneElement;
}>();

const { t } = useI18n();
const store = useStudioSessionStore();
const { applyUpdate } = useElementInspectorUpdate();

const video = computed(() => store.project?.settings.video ?? { width: 1920, height: 1080, frameRate: 30 });

type TransformKey = 'x' | 'y' | 'width' | 'height' | 'rotation';

function commitTransform(key: TransformKey, raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  applyUpdate(props.sceneId, props.element.id, {
    transform: { [key]: value },
  });
}

function commitCrop(key: keyof ElementCrop, raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  applyUpdate(props.sceneId, props.element.id, {
    crop: { [key]: value },
  });
}

function toggleKeepAspectRatio() {
  applyUpdate(props.sceneId, props.element.id, {
    transform: { keepAspectRatio: !props.element.transform.keepAspectRatio },
  });
}

const cropFields: { key: keyof ElementCrop; edge: 'top' | 'right' | 'bottom' | 'left' }[] = [
  { key: 'top', edge: 'top' },
  { key: 'right', edge: 'right' },
  { key: 'bottom', edge: 'bottom' },
  { key: 'left', edge: 'left' },
];
</script>

<template>
  <div class="flex w-full flex-col items-center gap-[8px]">
    <div class="flex w-full min-w-0 flex-wrap items-center justify-center gap-x-[16px] gap-y-[8px]">
      <span class="flex size-[24px] shrink-0 items-center justify-center text-white">
        <IconInspectorMove />
      </span>
      <BaseScrubField
        compact
        :model-value="element.transform.x"
        :label="t('studio.properties.fields.x')"
        field-suffix="horizontal"
        field-class="w-[64px]"
        :min="0"
        :max="video.width"
        @change="commitTransform('x', $event)"
      />
      <BaseScrubField
        compact
        :model-value="element.transform.y"
        :label="t('studio.properties.fields.y')"
        field-suffix="vertical"
        field-class="w-[64px]"
        :min="0"
        :max="video.height"
        @change="commitTransform('y', $event)"
      />
    </div>

    <div class="flex w-full min-w-0 flex-wrap items-center justify-center gap-x-[16px] gap-y-[8px]">
      <span class="flex size-[24px] shrink-0 items-center justify-center text-white">
        <IconInspectorScale />
      </span>
      <BaseScrubField
        compact
        :model-value="element.transform.width"
        :label="t('studio.properties.labels.width')"
        show-lock
        field-class="w-[72px]"
        :min="0"
        :max="video.width"
        @change="commitTransform('width', $event)"
        @lock-click="toggleKeepAspectRatio"
      />
      <BaseScrubField
        compact
        :model-value="element.transform.height"
        :label="t('studio.properties.labels.height')"
        show-lock
        field-class="w-[72px]"
        :min="0"
        :max="video.height"
        @change="commitTransform('height', $event)"
        @lock-click="toggleKeepAspectRatio"
      />
    </div>

    <div class="flex w-full min-w-0 flex-wrap items-center justify-center gap-x-[16px] gap-y-[8px]">
      <span class="flex size-[20px] shrink-0 items-center justify-center text-white">
        <IconInspectorRotate />
      </span>
      <BaseScrubField
        compact
        :model-value="element.transform.rotation"
        label=" "
        suffix="°"
        field-suffix="horizontal"
        field-class="w-[64px]"
        :min="0"
        :max="360"
        @change="commitTransform('rotation', $event)"
      />
    </div>

    <div class="flex w-full min-w-0 flex-wrap items-center justify-center gap-[8px]">
      <span class="flex size-[24px] shrink-0 items-center justify-center text-white">
        <IconInspectorCropInset />
      </span>
      <InspectorTransformCropField
        v-for="field in cropFields"
        :key="field.key"
        :model-value="element.crop[field.key]"
        :edge="field.edge"
        @change="commitCrop(field.key, $event)"
      />
    </div>
  </div>
</template>
