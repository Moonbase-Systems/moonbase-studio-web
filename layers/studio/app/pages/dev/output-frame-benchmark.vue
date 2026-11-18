<script setup lang="ts">
import { ref } from 'vue';

definePageMeta({
  title: 'nav.app',
});

const running = ref(false);
const report = ref('Run the harness in this browser. This page does not invent frame times.');

async function run() {
  running.value = true;
  report.value = 'Measuring…';
  try {
    const { runOutputFrameBenchmark } = await import('../../infrastructure/pixi/output-frame-benchmark');
    const samples = await runOutputFrameBenchmark();
    report.value = JSON.stringify(samples, null, 2);
  } catch (error) {
    report.value = error instanceof Error ? error.message : String(error);
  } finally {
    running.value = false;
  }
}
</script>

<template>
  <main class="gap-md p-lg flex flex-col">
    <h1 class="text-title font-sans">Output frame benchmark</h1>
    <button
      type="button"
      class="text-body-sm w-fit font-sans"
      :disabled="running"
      @click="run"
    >
      Measure 720p–4K
    </button>
    <pre class="text-body-sm whitespace-pre-wrap font-mono">{{ report }}</pre>
  </main>
</template>
