<script setup lang="ts">
import type { ShapeElement } from '../../models/scene-elements';

const props = defineProps<{
  element: ShapeElement;
}>();

const width = computed(() => Math.max(1, props.element.transform.width));
const height = computed(() => Math.max(1, props.element.transform.height));

const stroke = computed(() => {
  const settings = props.element.settings;
  if (!settings.strokeColor || settings.strokeWidth <= 0) {
    return 0;
  }
  return settings.strokeWidth;
});

const inset = computed(() => stroke.value / 2);

const shapeAttrs = computed(() => {
  const settings = props.element.settings;
  return {
    fill: settings.fillColor ?? 'none',
    'fill-opacity': settings.fillColor ? settings.fillOpacity : 0,
    stroke: stroke.value > 0 ? (settings.strokeColor ?? 'none') : 'none',
    'stroke-width': stroke.value,
  };
});
</script>

<template>
  <svg
    class="h-[88px] w-full max-w-[180px]"
    :viewBox="`0 0 ${width} ${height}`"
    role="img"
  >
    <rect
      v-if="element.settings.shapeType === 'rectangle'"
      :x="inset"
      :y="inset"
      :width="Math.max(0, width - stroke)"
      :height="Math.max(0, height - stroke)"
      :rx="element.settings.cornerRadius"
      v-bind="shapeAttrs"
    />
    <ellipse
      v-else-if="element.settings.shapeType === 'ellipse'"
      :cx="width / 2"
      :cy="height / 2"
      :rx="Math.max(0, width / 2 - inset)"
      :ry="Math.max(0, height / 2 - inset)"
      v-bind="shapeAttrs"
    />
    <polygon
      v-else
      :points="`${width / 2},${inset} ${width - inset},${height - inset} ${inset},${height - inset}`"
      v-bind="shapeAttrs"
    />
  </svg>
</template>
