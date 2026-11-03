<script setup lang="ts">
import { cn } from '~/utils/index';

import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../../models/ids.domain';
import type { ShapeElement, ShapeType } from '../../../models/scene-elements';

const props = defineProps<{
  sceneId: SceneId;
  element: ShapeElement;
}>();

const { t } = useI18n();
const { updateSettings } = useElementInspectorUpdate();

const shapeTypes = ['rectangle', 'ellipse', 'line'] as const satisfies readonly ShapeType[];

const open = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const panelStyle = ref<Record<string, string>>({ left: '0px', bottom: '0px' });

const textControlClass = 'font-inter text-body-sm font-medium tracking-normal text-white';
const labelClass = cn(textControlClass, 'shrink-0');
const fieldShellClass =
  'flex h-[24px] items-center gap-[8px] border border-transparent bg-[color-mix(in_srgb,white_5%,#050004)] px-[8px] focus-within:border-[#22FF86]';

const fillOn = computed(() => props.element.settings.fillColor != null && props.element.settings.fillOpacity > 0);
const strokeOn = computed(() => props.element.settings.strokeColor != null && props.element.settings.strokeWidth > 0);

function placePanel() {
  const trigger = triggerRef.value;
  if (!trigger) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const width = 160;
  const left = Math.min(rect.left, window.innerWidth - width - 8);
  panelStyle.value = {
    left: `${Math.max(8, left)}px`,
    bottom: `${window.innerHeight - rect.top + 4}px`,
  };
}

function togglePanel() {
  if (!open.value) {
    placePanel();
  }
  open.value = !open.value;
}

function pickShape(shapeType: ShapeType) {
  updateSettings(props.sceneId, props.element, { shapeType });
  open.value = false;
}

function toggleFill() {
  if (fillOn.value) {
    updateSettings(props.sceneId, props.element, { fillColor: null, fillOpacity: 0 });
    return;
  }
  updateSettings(props.sceneId, props.element, {
    fillColor: props.element.settings.fillColor ?? '#3b82f6',
    fillOpacity: 1,
  });
}

function setFillColor(value: string) {
  updateSettings(props.sceneId, props.element, {
    fillColor: value,
    fillOpacity: props.element.settings.fillOpacity > 0 ? props.element.settings.fillOpacity : 1,
  });
}

function commitFillOpacity(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  updateSettings(props.sceneId, props.element, { fillOpacity: Math.min(1, Math.max(0, value / 100)) });
}

function toggleStroke() {
  if (strokeOn.value) {
    updateSettings(props.sceneId, props.element, { strokeColor: null, strokeWidth: 0 });
    return;
  }
  updateSettings(props.sceneId, props.element, {
    strokeColor: props.element.settings.strokeColor ?? '#ffffff',
    strokeWidth: props.element.settings.strokeWidth > 0 ? props.element.settings.strokeWidth : 2,
  });
}

function setStrokeColor(value: string) {
  updateSettings(props.sceneId, props.element, {
    strokeColor: value,
    strokeWidth: props.element.settings.strokeWidth > 0 ? props.element.settings.strokeWidth : 2,
  });
}

function commitStrokeWidth(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  updateSettings(props.sceneId, props.element, { strokeWidth: Math.max(0, value) });
}

function commitCornerRadius(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  updateSettings(props.sceneId, props.element, { cornerRadius: Math.max(0, value) });
}

function decorationClass(active: boolean) {
  return cn(
    textControlClass,
    'flex h-[24px] items-center justify-center border px-[8px]',
    active
      ? 'border-[#22FF86] text-[#22FF86]'
      : 'border-transparent bg-[color-mix(in_srgb,white_5%,#050004)] text-white',
  );
}
</script>

<template>
  <div class="flex w-full max-w-[464px] flex-col items-center gap-[8px]">
    <div class="flex w-full flex-wrap items-center justify-center gap-[8px] bg-[#050004] p-[6px]">
      <span :class="labelClass">{{ t('studio.properties.rails.shape') }}</span>
      <button
        ref="triggerRef"
        type="button"
        :class="cn(fieldShellClass, textControlClass)"
        :aria-expanded="open"
        @click="togglePanel"
      >
        {{ t(`studio.properties.shapeTypes.${element.settings.shapeType}`) }}
        <span
          class="text-[12px] transition-transform duration-200"
          :class="open ? 'rotate-180' : ''"
        >
          &gt;
        </span>
      </button>
    </div>

    <div class="flex w-full flex-wrap items-center justify-center gap-[8px] bg-[#050004] p-[6px]">
      <button
        type="button"
        :class="decorationClass(fillOn)"
        :aria-pressed="fillOn"
        @click="toggleFill"
      >
        {{ t('studio.properties.fields.fillColor') }}
      </button>
      <BaseInspectorField
        v-if="fillOn"
        type="color"
        :model-value="element.settings.fillColor ?? '#3b82f6'"
        :label="t('studio.properties.fields.fillColor')"
        @change="setFillColor"
      />
      <BaseScrubField
        v-if="fillOn"
        compact
        label=" "
        field-suffix="horizontal"
        suffix="%"
        field-class="w-[72px]"
        :model-value="Math.round(element.settings.fillOpacity * 100)"
        :min="0"
        :max="100"
        @change="commitFillOpacity"
      />
    </div>

    <div class="flex w-full flex-wrap items-center justify-center gap-[8px] bg-[#050004] p-[6px]">
      <button
        type="button"
        :class="decorationClass(strokeOn)"
        :aria-pressed="strokeOn"
        @click="toggleStroke"
      >
        {{ t('studio.properties.fields.strokeColor') }}
      </button>
      <BaseInspectorField
        v-if="strokeOn"
        type="color"
        :model-value="element.settings.strokeColor ?? '#ffffff'"
        :label="t('studio.properties.fields.strokeColor')"
        @change="setStrokeColor"
      />
      <BaseScrubField
        v-if="strokeOn"
        compact
        label=" "
        field-suffix="horizontal"
        suffix="px"
        field-class="w-[72px]"
        :model-value="element.settings.strokeWidth"
        :min="0"
        @change="commitStrokeWidth"
      />
    </div>

    <div
      v-if="element.settings.shapeType === 'rectangle'"
      class="flex w-full flex-wrap items-center justify-center gap-[8px] bg-[#050004] p-[6px]"
    >
      <BaseScrubField
        compact
        :label="t('studio.properties.fields.cornerRadius')"
        field-suffix="horizontal"
        suffix="px"
        field-class="w-[72px]"
        :model-value="element.settings.cornerRadius"
        :min="0"
        @change="commitCornerRadius"
      />
    </div>

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
        class="fixed z-50 flex w-[160px] flex-col gap-[4px] border border-white/15 bg-[color-mix(in_srgb,white_8%,#050004)] p-[6px]"
        :style="panelStyle"
      >
        <button
          v-for="shapeType in shapeTypes"
          :key="shapeType"
          type="button"
          :class="
            cn(
              textControlClass,
              'flex h-[24px] items-center px-[8px] text-left',
              shapeType === element.settings.shapeType && 'text-[#22FF86]',
            )
          "
          @click="pickShape(shapeType)"
        >
          {{ t(`studio.properties.shapeTypes.${shapeType}`) }}
        </button>
      </div>
    </Teleport>
  </div>
</template>
