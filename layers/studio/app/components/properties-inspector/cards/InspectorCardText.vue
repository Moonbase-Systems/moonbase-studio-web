<script setup lang="ts">
import { cn } from '~/utils/index';

import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../../models/ids.domain';
import { createDefaultTextElementSettings, type TextElement } from '../../../models/scene-elements';
import {
  inspectorFieldShellClass,
  inspectorLabelClass,
  inspectorMenuItemClass,
  inspectorMenuPanelClass,
  inspectorRowClass,
  inspectorToggleClass,
} from '../inspector-control-classes';

const props = defineProps<{
  sceneId: SceneId;
  element: TextElement;
}>();

const { t } = useI18n();
const { updateSettings } = useElementInspectorUpdate();

/** Background colour applied when the background is first switched on (the default text colour). */
const DEFAULT_BACKGROUND_COLOR = createDefaultTextElementSettings().color;

function setString(key: 'fontFamily' | 'color', value: string) {
  updateSettings(props.sceneId, props.element, { [key]: value });
}

const fontChoices = computed(() => {
  const current = props.element.type === 'text' ? props.element.settings.fontFamily : 'Inter';
  const base = ['Arial', 'Inter', 'Roboto'];
  return base.includes(current) ? base : [current, ...base];
});

const fontOpen = ref(false);
const fontTriggerRef = ref<HTMLButtonElement | null>(null);
const fontPanelStyle = ref({ top: '0px', left: '0px' });

function placeFontPanel() {
  const trigger = fontTriggerRef.value;
  if (!trigger) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  fontPanelStyle.value = {
    top: `${rect.bottom + 4}px`,
    left: `${rect.left}px`,
  };
}

function toggleFontPanel() {
  if (!fontOpen.value) {
    placeFontPanel();
  }
  fontOpen.value = !fontOpen.value;
}

function pickFont(font: string) {
  setString('fontFamily', font);
  fontOpen.value = false;
}

const backgroundOn = computed(
  () => props.element.settings.backgroundColor != null && props.element.settings.backgroundOpacity > 0,
);

function toggleBackground() {
  if (backgroundOn.value) {
    updateSettings(props.sceneId, props.element, { backgroundColor: null, backgroundOpacity: 0 });
    return;
  }
  updateSettings(props.sceneId, props.element, {
    backgroundColor: props.element.settings.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
    backgroundOpacity: 1,
  });
}

function setBackground(value: string) {
  updateSettings(props.sceneId, props.element, {
    backgroundColor: value,
    backgroundOpacity: props.element.settings.backgroundOpacity > 0 ? props.element.settings.backgroundOpacity : 1,
  });
}

function toggleItalic() {
  updateSettings(props.sceneId, props.element, {
    fontStyle: props.element.settings.fontStyle === 'italic' ? 'normal' : 'italic',
  });
}

function toggleUnderline() {
  updateSettings(props.sceneId, props.element, {
    underline: !props.element.settings.underline,
  });
}

function toggleStrikethrough() {
  updateSettings(props.sceneId, props.element, {
    strikethrough: !props.element.settings.strikethrough,
  });
}

function displayWeight(weight: string | number) {
  const numeric = Number(weight);
  if (Number.isFinite(numeric) && numeric >= 100 && numeric <= 900 && numeric % 100 === 0) {
    return String(numeric / 100);
  }
  return String(weight);
}

function commitWeight(raw: string) {
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) {
    return;
  }
  const fontWeight = numeric > 0 && numeric < 10 ? numeric * 100 : numeric;
  updateSettings(props.sceneId, props.element, { fontWeight });
}

function commitPx(key: 'letterSpacing' | 'lineHeight', raw: string) {
  const value = Number(raw.replace(/px/gi, '').trim());
  if (!Number.isFinite(value)) {
    return;
  }
  updateSettings(props.sceneId, props.element, { [key]: value });
}

const labelClass = inspectorLabelClass;
const rowClass = inspectorRowClass;

function decorationClass(active: boolean) {
  return inspectorToggleClass(active);
}
</script>

<template>
  <div class="gap-xxx-sm flex w-full min-w-0 flex-col items-stretch">
    <div :class="rowClass">
      <div class="gap-xxx-sm flex items-center">
        <span :class="labelClass">{{ t('studio.properties.labels.font') }}</span>
        <button
          ref="fontTriggerRef"
          type="button"
          :class="cn(inspectorFieldShellClass, 'gap-x-tiny')"
          :aria-expanded="fontOpen"
          :aria-haspopup="true"
          @click="toggleFontPanel"
        >
          <span>{{ element.settings.fontFamily }}</span>
          <svg
            viewBox="0 0 24 24"
            class="size-md text-on-surface-dim shrink-0 rotate-90"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M7 14l5-6 5 6H7z"
            />
          </svg>
        </button>
      </div>

      <label class="gap-xxx-sm flex items-center">
        <span :class="labelClass">{{ t('studio.properties.labels.weight') }}</span>
        <BaseInspectorField
          :model-value="displayWeight(element.settings.fontWeight)"
          class="w-row"
          @change="commitWeight($event)"
        />
      </label>

      <BaseInspectorField
        type="color"
        class="ml-x-sm"
        :model-value="element.settings.color"
        :label="t('studio.properties.fields.color')"
        @change="setString('color', $event)"
      />
    </div>

    <div :class="rowClass">
      <span :class="labelClass">
        {{ t('studio.properties.labels.space') }}
      </span>
      <label class="gap-xxx-sm flex items-center">
        <span :class="labelClass">{{ t('studio.properties.labels.letters') }}</span>
        <BaseInspectorField
          :model-value="element.settings.letterSpacing"
          suffix="px"
          class="w-[58px]"
          @change="commitPx('letterSpacing', $event)"
        />
      </label>
      <label class="gap-xxx-sm flex items-center">
        <span :class="labelClass">{{ t('studio.properties.labels.lines') }}</span>
        <BaseInspectorField
          :model-value="element.settings.lineHeight"
          suffix="px"
          class="w-[58px]"
          @change="commitPx('lineHeight', $event)"
        />
      </label>
    </div>

    <div :class="rowClass">
      <span :class="labelClass">
        {{ t('studio.properties.labels.style') }}
      </span>
      <button
        type="button"
        :class="decorationClass(backgroundOn)"
        :aria-pressed="backgroundOn"
        @click="toggleBackground"
      >
        {{ t('studio.properties.fields.backgroundColor') }}
      </button>
      <BaseInspectorField
        v-if="backgroundOn"
        type="color"
        :model-value="element.settings.backgroundColor ?? DEFAULT_BACKGROUND_COLOR"
        :label="t('studio.properties.fields.backgroundColor')"
        @change="setBackground"
      />
      <button
        type="button"
        :class="decorationClass(element.settings.fontStyle === 'italic')"
        :aria-pressed="element.settings.fontStyle === 'italic'"
        :aria-label="t('studio.properties.labels.italic')"
        @click="toggleItalic"
      >
        <span class="italic">I</span>
      </button>
      <button
        type="button"
        :class="decorationClass(element.settings.underline)"
        :aria-pressed="element.settings.underline"
        :aria-label="t('studio.properties.labels.underline')"
        @click="toggleUnderline"
      >
        <span class="underline">U</span>
      </button>
      <button
        type="button"
        :class="decorationClass(element.settings.strikethrough)"
        :aria-pressed="element.settings.strikethrough"
        :aria-label="t('studio.properties.labels.strike')"
        @click="toggleStrikethrough"
      >
        <span class="line-through">S</span>
      </button>
    </div>
  </div>

  <Teleport to="body">
    <button
      v-if="fontOpen"
      type="button"
      class="fixed inset-0 z-40 cursor-default bg-transparent"
      aria-label="close"
      @click="fontOpen = false"
    />
    <div
      v-if="fontOpen"
      :class="cn(inspectorMenuPanelClass, 'min-w-[96px]')"
      :style="fontPanelStyle"
    >
      <button
        v-for="font in fontChoices"
        :key="font"
        type="button"
        :class="inspectorMenuItemClass(font === element.settings.fontFamily)"
        @click="pickFont(font)"
      >
        {{ font }}
      </button>
    </div>
  </Teleport>
</template>
