<script setup lang="ts">
import { cn } from '~/utils/index';

import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../../models/ids.domain';
import type { TextElement } from '../../../models/scene-elements';

const props = defineProps<{
  sceneId: SceneId;
  element: TextElement;
}>();

const { t } = useI18n();
const { updateSettings } = useElementInspectorUpdate();

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
    backgroundColor: props.element.settings.backgroundColor ?? '#ffffff',
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

const textControlClass = 'font-inter text-body-sm font-medium tracking-normal text-white';
const labelClass = cn(textControlClass, 'shrink-0');
const fieldShellClass =
  'border border-transparent bg-[color-mix(in_srgb,white_5%,#050004)] focus-within:border-[#22FF86]';

function decorationClass(active: boolean) {
  return cn(
    textControlClass,
    'flex h-[24px] min-w-[24px] items-center justify-center border px-[6px]',
    active
      ? 'border-[#22FF86] text-[#22FF86]'
      : 'border-transparent bg-[color-mix(in_srgb,white_5%,#050004)] text-white',
  );
}
</script>

<template>
  <div class="flex w-full max-w-[464px] flex-col items-center gap-[8px]">
    <div class="flex w-full flex-wrap items-center justify-center gap-[8px] bg-[#050004] p-[6px]">
      <div class="flex items-center gap-[6px]">
        <span :class="labelClass">{{ t('studio.properties.labels.font') }}</span>
        <button
          ref="fontTriggerRef"
          type="button"
          :class="cn(fieldShellClass, textControlClass, 'flex h-[24px] items-center gap-[2px] px-[4px]')"
          :aria-expanded="fontOpen"
          :aria-haspopup="true"
          @click="toggleFontPanel"
        >
          <span>{{ element.settings.fontFamily }}</span>
          <svg
            viewBox="0 0 24 24"
            class="size-4 shrink-0 rotate-90 text-white"
            aria-hidden="true"
          >
            <path
              fill="currentColor"
              d="M7 14l5-6 5 6H7z"
            />
          </svg>
        </button>
      </div>

      <label class="flex items-center gap-[6px]">
        <span :class="labelClass">{{ t('studio.properties.labels.weight') }}</span>
        <BaseInspectorField
          :model-value="displayWeight(element.settings.fontWeight)"
          class="w-[28px]"
          @change="commitWeight($event)"
        />
      </label>

      <BaseInspectorField
        type="color"
        class="ml-[12px]"
        :model-value="element.settings.color"
        :label="t('studio.properties.fields.color')"
        @change="setString('color', $event)"
      />
    </div>

    <div class="flex w-full flex-wrap items-center justify-center gap-[8px] bg-[#050004] p-[6px]">
      <span :class="cn(textControlClass, 'text-[#22FF86]')">
        {{ t('studio.properties.labels.space') }}
      </span>
      <label class="flex items-center gap-[6px]">
        <span :class="labelClass">{{ t('studio.properties.labels.letters') }}</span>
        <BaseInspectorField
          :model-value="element.settings.letterSpacing"
          suffix="px"
          class="w-[58px]"
          @change="commitPx('letterSpacing', $event)"
        />
      </label>
      <label class="flex items-center gap-[6px]">
        <span :class="labelClass">{{ t('studio.properties.labels.lines') }}</span>
        <BaseInspectorField
          :model-value="element.settings.lineHeight"
          suffix="px"
          class="w-[58px]"
          @change="commitPx('lineHeight', $event)"
        />
      </label>
    </div>

    <div class="flex w-full flex-wrap items-center justify-center gap-[8px] bg-[#050004] p-[6px]">
      <span :class="cn(textControlClass, 'text-[#22FF86]')">
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
        :model-value="element.settings.backgroundColor ?? '#ffffff'"
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
      class="fixed z-50 flex min-w-[96px] flex-col border border-white/15 bg-[color-mix(in_srgb,white_8%,#050004)] p-[4px]"
      :style="fontPanelStyle"
    >
      <button
        v-for="font in fontChoices"
        :key="font"
        type="button"
        :class="
          cn(
            textControlClass,
            'h-[24px] px-[8px] text-left text-white hover:bg-[#22FF86] hover:text-[#050004]',
            font === element.settings.fontFamily && 'text-[#22FF86]',
          )
        "
        @click="pickFont(font)"
      >
        {{ font }}
      </button>
    </div>
  </Teleport>
</template>
