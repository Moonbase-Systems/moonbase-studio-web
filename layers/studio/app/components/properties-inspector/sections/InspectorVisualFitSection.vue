<script setup lang="ts">
import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { FitMode } from '../../../models/common.domain';
import type { SceneId } from '../../../models/ids.domain';
import type { CameraElement, ImageElement, ScreenElement, VideoElement } from '../../../models/scene-elements';
import { inspectorInputClass } from '../inspector-input-class';
import InspectorField from '../InspectorField.vue';
import InspectorSection from '../InspectorSection.vue';

const props = withDefaults(
  defineProps<{
    sceneId: SceneId;
    element: ImageElement | VideoElement | CameraElement | ScreenElement;
    titleKey: string;
    layout?: 'default' | 'compact';
  }>(),
  { layout: 'default' },
);

const { t } = useI18n();
const { updateSettings } = useElementInspectorUpdate();

const fitModes: FitMode[] = ['contain', 'cover', 'fill', 'none'];

function setFitMode(value: string) {
  updateSettings(props.sceneId, props.element, { fitMode: value });
}

function setCornerRadius(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return;
  }
  updateSettings(props.sceneId, props.element, { cornerRadius: value });
}

function setSmoothing(checked: boolean) {
  if (props.element.type !== 'image') {
    return;
  }
  updateSettings(props.sceneId, props.element, { smoothing: checked });
}

function setMirror(checked: boolean) {
  if (props.element.type !== 'camera') {
    return;
  }
  updateSettings(props.sceneId, props.element, { mirror: checked });
}

function setShowCursor(checked: boolean) {
  if (props.element.type !== 'screen') {
    return;
  }
  updateSettings(props.sceneId, props.element, { showCursor: checked });
}
</script>

<template>
  <div
    v-if="layout === 'compact'"
    class="gap-md contents"
  >
    <InspectorField
      :label="t('studio.properties.fields.fitMode')"
      inline
      class="min-w-[8rem]"
    >
      <select
        :value="element.settings.fitMode"
        :class="inspectorInputClass"
        @change="setFitMode(($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="mode in fitModes"
          :key="mode"
          :value="mode"
        >
          {{ mode }}
        </option>
      </select>
    </InspectorField>
    <InspectorField
      :label="t('studio.properties.fields.cornerRadius')"
      inline
      class="w-[6rem]"
    >
      <input
        type="number"
        min="0"
        step="1"
        :value="element.settings.cornerRadius"
        :class="inspectorInputClass"
        @change="setCornerRadius(($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <label
      v-if="element.type === 'image'"
      class="gap-x-sm pb-xx-sm flex cursor-pointer items-end"
    >
      <input
        type="checkbox"
        :checked="element.settings.smoothing"
        @change="setSmoothing(($event.target as HTMLInputElement).checked)"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.smoothing') }}</span>
    </label>
    <label
      v-if="element.type === 'camera'"
      class="gap-x-sm pb-xx-sm flex cursor-pointer items-end"
    >
      <input
        type="checkbox"
        :checked="element.settings.mirror"
        @change="setMirror(($event.target as HTMLInputElement).checked)"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.mirror') }}</span>
    </label>
    <label
      v-if="element.type === 'screen'"
      class="gap-x-sm pb-xx-sm flex cursor-pointer items-end"
    >
      <input
        type="checkbox"
        :checked="element.settings.showCursor"
        @change="setShowCursor(($event.target as HTMLInputElement).checked)"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.showCursor') }}</span>
    </label>
  </div>
  <InspectorSection
    v-else
    :title="t(titleKey)"
  >
    <InspectorField :label="t('studio.properties.fields.fitMode')">
      <select
        :value="element.settings.fitMode"
        :class="inspectorInputClass"
        @change="setFitMode(($event.target as HTMLSelectElement).value)"
      >
        <option
          v-for="mode in fitModes"
          :key="mode"
          :value="mode"
        >
          {{ mode }}
        </option>
      </select>
    </InspectorField>
    <InspectorField :label="t('studio.properties.fields.cornerRadius')">
      <input
        type="number"
        min="0"
        step="1"
        :value="element.settings.cornerRadius"
        :class="inspectorInputClass"
        @change="setCornerRadius(($event.target as HTMLInputElement).value)"
      />
    </InspectorField>
    <label
      v-if="element.type === 'image'"
      class="gap-x-sm flex cursor-pointer items-center"
    >
      <input
        type="checkbox"
        :checked="element.settings.smoothing"
        @change="setSmoothing(($event.target as HTMLInputElement).checked)"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.smoothing') }}</span>
    </label>
    <label
      v-if="element.type === 'camera'"
      class="gap-x-sm flex cursor-pointer items-center"
    >
      <input
        type="checkbox"
        :checked="element.settings.mirror"
        @change="setMirror(($event.target as HTMLInputElement).checked)"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.mirror') }}</span>
    </label>
    <label
      v-if="element.type === 'screen'"
      class="gap-x-sm flex cursor-pointer items-center"
    >
      <input
        type="checkbox"
        :checked="element.settings.showCursor"
        @change="setShowCursor(($event.target as HTMLInputElement).checked)"
      />
      <span class="text-body-sm font-roboto">{{ t('studio.properties.fields.showCursor') }}</span>
    </label>
  </InspectorSection>
</template>
