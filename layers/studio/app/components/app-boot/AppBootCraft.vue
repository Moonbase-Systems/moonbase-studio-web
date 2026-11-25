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
        cy="38"
        rx="36"
        ry="4"
        class="boot-craft-rim-glow"
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
      <ellipse
        cx="52"
        cy="17"
        rx="5"
        ry="3"
        class="boot-craft-shine"
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
.boot-craft-saucer {
  fill: rgb(var(--color-surface-container));
  stroke: rgb(var(--color-accent));
  stroke-width: 1.5;
}

.boot-craft-saucer-belly {
  fill: rgb(var(--color-surface));
  opacity: 0.55;
}

.boot-craft-rim-glow {
  fill: rgb(var(--color-accent));
  opacity: 0.12;
}

.boot-craft-dome {
  fill: rgb(var(--color-surface-container));
  stroke: rgb(var(--color-accent));
  stroke-width: 1.5;
}

.boot-craft-cabin {
  fill: rgb(var(--color-accent));
  opacity: 0.2;
}

.boot-craft-shine {
  fill: rgb(var(--color-on-surface));
  opacity: 0.35;
}

.boot-craft-port {
  fill: rgb(var(--color-accent));
  opacity: 0.85;
}

.boot-craft-lamp {
  fill: rgb(var(--color-accent));
  opacity: calc(0.25 + var(--boot-light, 0) * 0.75);
  filter: drop-shadow(0 0 calc(5px * var(--boot-light, 0)) rgb(var(--color-accent)));
  transition:
    opacity var(--boot-light-duration, 0.45s) ease-out,
    filter var(--boot-light-duration, 0.45s) ease-out;
}
</style>
