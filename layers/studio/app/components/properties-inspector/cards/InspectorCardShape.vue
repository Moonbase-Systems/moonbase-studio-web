<script setup lang="ts">
import { cn } from '~/utils/index';

import { useElementInspectorUpdate } from '../../../composables/useElementInspectorUpdate';
import type { SceneId } from '../../../models/ids.domain';
import {
  createDefaultShapeElementSettings,
  createDefaultTextElementSettings,
  type ShapeElement,
  type ShapeType,
} from '../../../models/scene-elements';
import {
  inspectorChevronClass,
  inspectorFieldShellClass,
  inspectorLabelClass,
  inspectorMenuItemClass,
  inspectorMenuPanelClass,
  inspectorRowClass,
  inspectorToggleClass,
} from '../inspector-control-classes';

const props = defineProps<{
  sceneId: SceneId;
  element: ShapeElement;
}>();

const { t } = useI18n();
const { updateSettings } = useElementInspectorUpdate();

const shapeTypes = ['rectangle', 'ellipse', 'triangle'] as const satisfies readonly ShapeType[];

/** Stroke colour applied when the stroke is first switched on (the default text colour). */
const DEFAULT_STROKE_COLOR = createDefaultTextElementSettings().color;
/** Fill colour applied when the fill is first switched on (the default shape fill). */
const DEFAULT_FILL_COLOR = createDefaultShapeElementSettings().fillColor ?? DEFAULT_STROKE_COLOR;

const open = ref(false);
const triggerRef = ref<HTMLButtonElement | null>(null);
const panelStyle = ref<Record<string, string>>({ left: '0px', bottom: '0px' });

const labelClass = inspectorLabelClass;
const rowClass = inspectorRowClass;
const fieldShellClass = inspectorFieldShellClass;

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
    fillColor: props.element.settings.fillColor ?? DEFAULT_FILL_COLOR,
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
    strokeColor: props.element.settings.strokeColor ?? DEFAULT_STROKE_COLOR,
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
  return inspectorToggleClass(active);
}
</script>

<template>
  <div class="gap-xxx-sm flex w-full min-w-0 flex-col items-stretch">
    <div :class="rowClass">
      <span :class="labelClass">{{ t('studio.properties.rails.shape') }}</span>
      <button
        ref="triggerRef"
        type="button"
        :class="fieldShellClass"
        :aria-expanded="open"
        @click="togglePanel"
      >
        {{ t(`studio.properties.shapeTypes.${element.settings.shapeType}`) }}
        <span :class="cn(inspectorChevronClass, open && 'rotate-180')"> &gt; </span>
      </button>
    </div>

    <div :class="rowClass">
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
        :model-value="element.settings.fillColor ?? DEFAULT_FILL_COLOR"
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

    <div :class="rowClass">
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
        :model-value="element.settings.strokeColor ?? DEFAULT_STROKE_COLOR"
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
      :class="rowClass"
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
        :class="cn(inspectorMenuPanelClass, 'w-[160px]')"
        :style="panelStyle"
      >
        <button
          v-for="shapeType in shapeTypes"
          :key="shapeType"
          type="button"
          :class="inspectorMenuItemClass(shapeType === element.settings.shapeType)"
          @click="pickShape(shapeType)"
        >
          {{ t(`studio.properties.shapeTypes.${shapeType}`) }}
        </button>
      </div>
    </Teleport>
  </div>
</template>
