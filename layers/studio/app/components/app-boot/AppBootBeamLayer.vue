<script setup lang="ts">
import { useBootBeamTrack } from '../../composables/useBootBeamTrack';
import type { BootBeamSwayMotionState } from './boot-beam.types';

const props = defineProps<{
  active: boolean;
  stage: HTMLElement | null;
  origin: HTMLElement | null;
  label: HTMLElement | null;
  swayMotion?: BootBeamSwayMotionState;
}>();

const stageRef = toRef(() => props.stage);
const originRef = toRef(() => props.origin);
const labelRef = toRef(() => props.label);

const polygonRef = ref<SVGPolygonElement | null>(null);
const gradientRef = ref<SVGLinearGradientElement | null>(null);
const ellipseRef = ref<SVGEllipseElement | null>(null);

const activeRef = toRef(props, 'active');

useBootBeamTrack(
  activeRef,
  {
    stage: stageRef,
    origin: originRef,
    label: labelRef,
    polygon: polygonRef,
    gradient: gradientRef,
    ellipse: ellipseRef,
  },
  props.swayMotion,
);
</script>

<template>
  <svg
    class="boot-beam-layer"
    aria-hidden="true"
  >
    <defs>
      <!-- Flat signal beam (Orbit boot artboard: signal at ~10%), fading only at the label. -->
      <linearGradient
        id="boot-beam-gradient-live"
        ref="gradientRef"
        gradientUnits="userSpaceOnUse"
        x1="0"
        y1="0"
        x2="0"
        y2="1"
      >
        <stop
          offset="0%"
          stop-color="rgb(var(--color-accent))"
          stop-opacity="0.14"
        />
        <stop
          offset="85%"
          stop-color="rgb(var(--color-accent))"
          stop-opacity="0.1"
        />
        <stop
          offset="100%"
          stop-color="rgb(var(--color-accent))"
          stop-opacity="0.06"
        />
      </linearGradient>
    </defs>
    <g class="boot-beam-shapes">
      <polygon
        ref="polygonRef"
        fill="url(#boot-beam-gradient-live)"
        class="boot-beam-polygon"
      />
      <ellipse
        ref="ellipseRef"
        fill="none"
        class="boot-beam-spot"
      />
    </g>
  </svg>
</template>

<style scoped>
.boot-beam-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.boot-beam-shapes {
  opacity: var(--boot-light, 0);
}
</style>
