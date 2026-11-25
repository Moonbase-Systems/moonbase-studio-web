<!--
  Boot UFO: viewBox="0 0 120 80", beam anchor at (60, 50) — bottom center (#craft-body).
-->
<template>
  <svg
    class="boot-craft-svg"
    viewBox="0 0 120 80"
    width="120"
    height="80"
    aria-hidden="true"
  >
    <g id="craft-body">
      <ellipse
        cx="60"
        cy="41"
        rx="40"
        ry="12"
        class="boot-craft-saucer"
      />
      <path
        d="M 22 41 Q 60 52 98 41 L 94 44 Q 60 48 26 44 Z"
        class="boot-craft-saucer-belly"
      />
      <ellipse
        cx="60"
        cy="23"
        rx="17"
        ry="15"
        class="boot-craft-dome"
      />
      <ellipse
        cx="60"
        cy="24"
        rx="11"
        ry="9"
        class="boot-craft-cabin"
      />
      <circle
        cx="38"
        cy="40"
        r="2"
        class="boot-craft-port"
      />
      <circle
        cx="60"
        cy="42"
        r="2"
        class="boot-craft-port"
      />
      <circle
        cx="82"
        cy="40"
        r="2"
        class="boot-craft-port"
      />
    </g>

    <circle
      cx="60"
      cy="50"
      r="4"
      class="boot-craft-lamp"
    />
  </svg>
</template>

<style scoped>
/* Orbit line craft: 1 px signal strokes on the surface, no gloss. */
.boot-craft-svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.boot-craft-saucer,
.boot-craft-dome {
  fill: rgb(var(--color-surface));
  stroke: rgb(var(--color-accent));
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.boot-craft-saucer-belly {
  fill: rgb(var(--color-surface-container-high));
  stroke: rgb(var(--color-line));
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.boot-craft-cabin {
  fill: rgb(var(--color-surface-container));
  stroke: rgb(var(--color-line));
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.boot-craft-port {
  fill: rgb(var(--color-accent));
}

.boot-craft-lamp {
  fill: rgb(var(--color-accent));
  opacity: calc(0.25 + var(--boot-light, 0) * 0.75);
  filter: drop-shadow(0 0 calc(6px * var(--boot-light, 0)) rgb(var(--color-accent)));
  transition:
    opacity var(--boot-light-duration, 0.45s) ease-out,
    filter var(--boot-light-duration, 0.45s) ease-out;
}
</style>
