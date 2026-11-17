<script setup lang="ts">
import { useStudioSessionStore } from '../../store/studio-session.store';

const store = useStudioSessionStore();
const { t } = useI18n();

const conflicts = computed(() => store.audioMigrationConflicts);

function voteLabel(conflictIndex: number, voteIndex: number): string {
  const vote = conflicts.value[conflictIndex]?.votes[voteIndex];
  if (!vote) {
    return '';
  }
  const place =
    vote.origin.kind === 'scene'
      ? vote.origin.sceneName
      : t('studio.audioMigration.channelVote', { name: vote.origin.channelName });
  return t('studio.audioMigration.vote', {
    place,
    fader: vote.strip.faderDb,
    monitoring: vote.strip.monitoring,
  });
}
</script>

<template>
  <section
    v-if="conflicts.length > 0"
    class="border-warning bg-surface-container gap-sm p-md mx-md mt-md flex shrink-0 flex-col border"
    role="status"
  >
    <h2 class="text-title font-sans font-light">
      {{ t('studio.audioMigration.title') }}
    </h2>
    <p class="text-body-sm text-on-surface-dim font-sans">
      {{ t('studio.audioMigration.body') }}
    </p>
    <ul class="gap-tiny flex flex-col">
      <li
        v-for="(conflict, conflictIndex) in conflicts"
        :key="conflict.channelId"
        class="text-body-sm font-sans"
      >
        <span class="text-on-surface">{{ conflict.channelName }}</span>
        <span class="text-on-surface-dim"> — {{ t('studio.audioMigration.monitoringOff') }}</span>
        <ul class="mt-tiny ml-md list-disc">
          <li
            v-for="(_vote, voteIndex) in conflict.votes"
            :key="voteIndex"
            class="text-on-surface-dim"
          >
            {{ voteLabel(conflictIndex, voteIndex) }}
          </li>
        </ul>
      </li>
    </ul>
    <button
      type="button"
      class="text-body-sm text-accent w-fit font-sans"
      @click="store.dismissAudioMigrationConflicts()"
    >
      {{ t('studio.audioMigration.dismiss') }}
    </button>
  </section>
</template>
