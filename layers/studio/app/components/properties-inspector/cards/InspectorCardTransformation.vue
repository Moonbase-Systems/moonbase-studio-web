<script setup lang="ts">
import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { ElementCrop } from '../../../models/common.domain';
import type { SceneId } from '../../../models/ids.domain';
import type { SceneElement } from '../../../models/scene-element.domain';
import { useStudioSessionStore } from '../../../store/studio-session.store';
import { inspectorLabelClass } from '../inspector-control-classes';
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
  <!-- One form grid: a label column sized to the longest label, every field fills the rest. -->
  <div class="gap-x-sm gap-y-xxx-sm grid w-full grid-cols-[auto_minmax(0,1fr)] items-center">
    <BaseScrubField
      compact
      class="contents"
      :model-value="element.transform.x"
      :label="t('studio.properties.fields.x')"
      suffix="px"
      field-suffix="horizontal"
      :min="0"
      :max="video.width"
      @change="commitTransform('x', $event)"
    />
    <BaseScrubField
      compact
      class="contents"
      :model-value="element.transform.y"
      :label="t('studio.properties.fields.y')"
      suffix="px"
      field-suffix="vertical"
      :min="0"
      :max="video.height"
      @change="commitTransform('y', $event)"
    />
    <BaseScrubField
      compact
      class="contents"
      :model-value="element.transform.width"
      :label="t('studio.properties.labels.width')"
      suffix="px"
      show-lock
      :min="0"
      :max="video.width"
      @change="commitTransform('width', $event)"
      @lock-click="toggleKeepAspectRatio"
    />
    <BaseScrubField
      compact
      class="contents"
      :model-value="element.transform.height"
      :label="t('studio.properties.labels.height')"
      suffix="px"
      show-lock
      :min="0"
      :max="video.height"
      @change="commitTransform('height', $event)"
      @lock-click="toggleKeepAspectRatio"
    />
    <BaseScrubField
      compact
      class="contents"
      :model-value="element.transform.rotation"
      :label="t('studio.properties.labels.rotation')"
      suffix="°"
      field-suffix="horizontal"
      :min="0"
      :max="360"
      @change="commitTransform('rotation', $event)"
    />

    <span :class="inspectorLabelClass">{{ t('studio.properties.labels.crop') }}</span>
    <div class="gap-xxx-sm grid min-w-0 grid-cols-2">
      <InspectorTransformCropField
        v-for="field in cropFields"
        :key="field.key"
        :model-value="element.crop[field.key]"
        :edge="field.edge"
        :label="t(`studio.properties.fields.crop.${field.key}`)"
        @change="commitCrop(field.key, $event)"
      />
    </div>
  </div>
</template>
