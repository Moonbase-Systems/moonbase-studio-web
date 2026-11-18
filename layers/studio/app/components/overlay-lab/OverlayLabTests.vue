<script setup lang="ts">
import { cn } from '~/utils/index';

import { type LabVerdict, OVERLAY_LAB_TEST_IDS, type OverlayLabTestId } from '../../application/overlay-lab-tests';
import { inspectorToggleClass } from '../properties-inspector/inspector-control-classes';

defineProps<{
  running: OverlayLabTestId | null;
  results: Partial<Record<OverlayLabTestId, LabVerdict>>;
}>();

const emit = defineEmits<{
  run: [id: OverlayLabTestId];
}>();

function stateClass(state: LabVerdict['state'] | 'running' | 'idle') {
  if (state === 'pass') {
    return 'text-accent';
  }
  if (state === 'fail') {
    return 'text-error';
  }
  if (state === 'manual' || state === 'running') {
    return 'text-warning';
  }
  return 'text-on-surface-dim';
}
</script>

<template>
  <ul class="gap-xx-sm flex flex-col">
    <li
      v-for="id in OVERLAY_LAB_TEST_IDS"
      :key="id"
      class="border-line gap-xx-sm p-xx-sm grid border md:grid-cols-[11rem_minmax(0,1fr)_auto]"
    >
      <div class="gap-xxx-sm flex min-w-0 flex-col">
        <span class="text-body-sm text-on-surface font-sans">{{ $t(`overlayLab.tests.${id}.name`) }}</span>
        <span
          :class="
            cn(
              'text-label font-mono uppercase',
              stateClass(running === id ? 'running' : (results[id]?.state ?? 'idle')),
            )
          "
        >
          {{ $t(`overlayLab.state.${running === id ? 'running' : (results[id]?.state ?? 'idle')}`) }}
        </span>
      </div>
      <div class="gap-xxx-sm flex min-w-0 flex-col">
        <p class="text-body-sm text-on-surface-dim font-sans">{{ $t(`overlayLab.tests.${id}.expect`) }}</p>
        <p
          v-if="results[id]"
          class="text-body-sm text-on-surface font-sans"
        >
          {{ $t(`overlayLab.verdict.${results[id]?.code}`) }}
        </p>
      </div>
      <button
        type="button"
        :class="cn(inspectorToggleClass(false), 'cursor-pointer')"
        :disabled="running !== null"
        @click="emit('run', id)"
      >
        {{ $t('overlayLab.run') }}
      </button>
    </li>
  </ul>
</template>
