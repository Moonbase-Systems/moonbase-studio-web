<script setup lang="ts">
import { computed } from 'vue';

import { cn } from '~/utils/index';

import { alertText } from '../../application/overlay-alerts';
import { useOverlayLabConsole } from '../../composables/useOverlayLabConsole';
import { LEVEL_FLOOR_DB, normalizeLevelDb } from '../../models/audio.domain';
import { OVERLAY_ALERT_TYPES } from '../../models/overlay-sound.domain';
import {
  inspectorFieldShellClass,
  inspectorLabelClass,
  inspectorToggleClass,
} from '../properties-inspector/inspector-control-classes';
import OverlayLabPayload from './OverlayLabPayload.vue';
import OverlayLabTests from './OverlayLabTests.vue';

const { t } = useI18n();
const {
  portAvailable,
  overlayId,
  overlayHref,
  selected,
  burstCount,
  eventLog,
  audioLog,
  status,
  renderer,
  studioConnected,
  rendererConnected,
  running,
  lastVerdict,
  results,
  send,
  resend,
  burst,
  clearQueue,
  runTest,
} = useOverlayLabConsole();

const rms = computed(() => status.value?.rmsDb ?? LEVEL_FLOOR_DB);
const peak = computed(() => status.value?.peakDb ?? LEVEL_FLOOR_DB);
const shown = computed(() => (renderer.value?.phase === 'visible' ? renderer.value.alert : null));
const shownName = computed(() => (shown.value ? alertText(shown.value).name : ''));
const announcement = computed(() => {
  const latest = lastVerdict.value;
  if (!latest) {
    return t('overlayLab.announcementIdle');
  }
  return `${t(`overlayLab.tests.${latest.id}.name`)}: ${t(`overlayLab.state.${latest.verdict.state}`)}. ${t(`overlayLab.verdict.${latest.verdict.code}`)}`;
});

function clock(at: number) {
  return new Date(at).toLocaleTimeString();
}
</script>

<template>
  <div
    class="bg-surface text-on-surface flex h-[100dvh] min-h-0 flex-col overflow-hidden font-sans"
    data-overlay-lab
  >
    <header class="border-line gap-sm px-md py-sm flex flex-wrap items-center justify-between border-b">
      <div class="gap-xxx-sm flex min-w-0 flex-col">
        <h1 class="text-title text-on-surface font-light">{{ t('overlayLab.title') }}</h1>
        <p class="text-body-sm text-on-surface-dim max-w-[40rem]">{{ t('overlayLab.hint') }}</p>
      </div>
      <div class="gap-md flex flex-wrap items-center">
        <BaseStatusBadge
          :state="portAvailable ? 'ok' : 'error'"
          :label="portAvailable ? t('overlayLab.transportOn') : t('overlayLab.transportOff')"
        />
        <BaseStatusBadge
          :state="studioConnected ? 'live' : 'offline'"
          :label="`${t('overlayLab.studio')}: ${studioConnected ? t('overlayLab.connected') : t('overlayLab.disconnected')}`"
        />
        <BaseStatusBadge
          :state="rendererConnected ? 'live' : 'offline'"
          :label="`${t('overlayLab.renderer')}: ${rendererConnected ? t('overlayLab.connected') : t('overlayLab.disconnected')}`"
        />
      </div>
    </header>

    <div class="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[24rem_minmax(0,1fr)]">
      <div class="border-line gap-md p-md flex min-h-0 flex-col overflow-y-auto lg:border-r">
        <section class="gap-sm flex flex-col">
          <h2 class="text-label text-on-surface-dim font-mono uppercase">{{ t('overlayLab.sections.simulator') }}</h2>
          <div
            class="gap-xx-sm flex flex-wrap"
            role="group"
            :aria-label="t('overlayLab.sections.simulator')"
          >
            <button
              v-for="type in OVERLAY_ALERT_TYPES"
              :key="type"
              type="button"
              :class="cn(inspectorToggleClass(selected === type), 'cursor-pointer')"
              :aria-pressed="selected === type"
              @click="selected = type"
            >
              {{ t(`studio.audio.overlay.events.${type}`) }}
            </button>
          </div>
          <div class="gap-xx-sm flex flex-wrap">
            <button
              type="button"
              :class="cn(inspectorToggleClass(true), 'cursor-pointer')"
              @click="send"
            >
              {{ t('overlayLab.send') }}
            </button>
            <button
              type="button"
              :class="cn(inspectorToggleClass(false), 'cursor-pointer')"
              @click="resend"
            >
              {{ t('overlayLab.resend') }}
            </button>
            <label class="gap-xx-sm flex items-center">
              <span :class="inspectorLabelClass">{{ t('overlayLab.burst') }}</span>
              <input
                v-model.number="burstCount"
                :class="cn(inspectorFieldShellClass, 'w-[4.8rem]')"
                type="number"
                min="2"
                max="20"
              />
            </label>
            <button
              type="button"
              :class="cn(inspectorToggleClass(false), 'cursor-pointer')"
              @click="burst"
            >
              {{ t('overlayLab.burstSend') }}
            </button>
          </div>
        </section>

        <section class="gap-sm flex flex-col">
          <h2 class="text-label text-on-surface-dim font-mono uppercase">{{ t('overlayLab.sections.payload') }}</h2>
          <OverlayLabPayload />
        </section>
      </div>

      <div class="gap-md p-md flex min-h-0 flex-col overflow-y-auto">
        <section class="gap-sm flex flex-col">
          <div class="gap-sm flex flex-wrap items-center justify-between">
            <h2 class="text-label text-on-surface-dim font-mono uppercase">{{ t('overlayLab.sections.preview') }}</h2>
            <div class="gap-xx-sm flex flex-wrap items-center">
              <label class="gap-xx-sm flex items-center">
                <span :class="inspectorLabelClass">{{ t('overlayLab.overlayId') }}</span>
                <input
                  v-model="overlayId"
                  :class="cn(inspectorFieldShellClass, 'w-[8rem]')"
                  autocomplete="off"
                />
              </label>
              <a
                :href="overlayHref"
                target="_blank"
                rel="noopener noreferrer"
                :class="cn(inspectorToggleClass(false), 'cursor-pointer')"
              >
                {{ t('overlayLab.openRenderer') }}
              </a>
              <button
                type="button"
                :class="cn(inspectorToggleClass(false), 'cursor-pointer')"
                @click="clearQueue"
              >
                {{ t('overlayLab.clearQueue') }}
              </button>
            </div>
          </div>
          <p class="text-body-sm text-on-surface">
            {{ shownName || t('overlayLab.alertIdle') }}
            <span class="text-on-surface-dim"> · {{ t('overlayLab.queued', { count: renderer?.queued ?? 0 }) }}</span>
          </p>
          <iframe
            :key="overlayHref"
            :src="overlayHref"
            :title="t('overlayLab.previewFrame')"
            class="border-line h-[36rem] w-full border bg-transparent"
          />
        </section>

        <section class="gap-sm flex flex-col">
          <h2 class="text-label text-on-surface-dim font-mono uppercase">{{ t('overlayLab.sections.diagnostics') }}</h2>
          <p
            v-if="!studioConnected"
            class="text-body-sm text-on-surface"
          >
            {{ t('overlayLab.studioMissing') }}
          </p>
          <div class="gap-md flex flex-wrap items-end">
            <BaseLevelMeter
              :value="normalizeLevelDb(rms)"
              :peak="normalizeLevelDb(peak)"
              :label="t('overlayLab.overlayMeter')"
              :readout="`${rms.toFixed(1)} dB`"
            />
            <dl class="gap-x-md gap-y-xxx-sm grid flex-1 grid-cols-[auto_minmax(0,1fr)]">
              <dt :class="inspectorLabelClass">{{ t('overlayLab.rows.bus') }}</dt>
              <dd class="text-body-sm">
                {{ status ? (status.busMuted ? t('overlayLab.muted') : t('overlayLab.open')) : '—' }}
              </dd>
              <dt :class="inspectorLabelClass">{{ t('overlayLab.rows.instances') }}</dt>
              <dd class="text-body-sm">{{ status?.activeInstances ?? '—' }}</dd>
              <dt :class="inspectorLabelClass">{{ t('overlayLab.rows.queued') }}</dt>
              <dd class="text-body-sm">{{ status?.queued ?? '—' }}</dd>
              <dt :class="inspectorLabelClass">{{ t('overlayLab.rows.last') }}</dt>
              <dd class="text-body-sm">
                {{ status?.lastSoundName ?? '—' }}
                <span
                  v-if="status?.lastOutcome"
                  class="text-on-surface-dim"
                  >{{ status.lastOutcome }}</span
                >
              </dd>
              <dt :class="inspectorLabelClass">{{ t('overlayLab.rows.program') }}</dt>
              <dd class="text-body-sm">
                {{ status ? (status.program ? t('overlayLab.programOn') : t('overlayLab.programOff')) : '—' }}
              </dd>
              <dt :class="inspectorLabelClass">{{ t('overlayLab.rows.monitor') }}</dt>
              <dd class="text-body-sm">{{ status ? t(`overlayLab.monitoring.${status.monitoring}`) : '—' }}</dd>
              <dt :class="inspectorLabelClass">{{ t('overlayLab.rows.master') }}</dt>
              <dd class="text-body-sm">
                {{
                  status
                    ? `${Math.round(status.masterVolume * 100)}% · ${status.masterMuted ? t('overlayLab.muted') : t('overlayLab.open')}`
                    : '—'
                }}
              </dd>
              <dt :class="inspectorLabelClass">{{ t('overlayLab.rows.effects') }}</dt>
              <dd class="text-body-sm">
                {{ status ? status.effectCount : '—' }}
                <span
                  v-if="status?.chainError"
                  class="text-error"
                  >{{ status.chainError }}</span
                >
              </dd>
            </dl>
          </div>
        </section>

        <div class="gap-md grid md:grid-cols-2">
          <section class="gap-sm flex min-w-0 flex-col">
            <h2 class="text-label text-on-surface-dim font-mono uppercase">{{ t('overlayLab.sections.eventLog') }}</h2>
            <ul class="border-line max-h-[16rem] overflow-y-auto border">
              <li
                v-if="eventLog.length === 0"
                class="text-body-sm text-on-surface-dim px-xx-sm py-xx-sm"
              >
                {{ t('overlayLab.emptyLog') }}
              </li>
              <li
                v-for="row in eventLog"
                :key="row.id"
                class="border-line gap-xx-sm px-xx-sm py-xxx-sm flex border-b last:border-b-0"
              >
                <time
                  class="text-label text-on-surface-dim font-mono"
                  :datetime="new Date(row.at).toISOString()"
                  >{{ clock(row.at) }}</time
                >
                <span class="text-body-sm min-w-0">{{ t(`overlayLab.event.${row.code}`) }} · {{ row.detail }}</span>
              </li>
            </ul>
          </section>
          <section class="gap-sm flex min-w-0 flex-col">
            <h2 class="text-label text-on-surface-dim font-mono uppercase">{{ t('overlayLab.sections.audioLog') }}</h2>
            <ul class="border-line max-h-[16rem] overflow-y-auto border">
              <li
                v-if="audioLog.length === 0"
                class="text-body-sm text-on-surface-dim px-xx-sm py-xx-sm"
              >
                {{ t('overlayLab.emptyLog') }}
              </li>
              <li
                v-for="row in audioLog"
                :key="row.id"
                class="border-line gap-xx-sm px-xx-sm py-xxx-sm flex border-b last:border-b-0"
              >
                <time
                  class="text-label text-on-surface-dim font-mono"
                  :datetime="new Date(row.at).toISOString()"
                  >{{ clock(row.at) }}</time
                >
                <span
                  class="text-body-sm min-w-0"
                  :class="
                    row.status === 'error' ? 'text-error' : row.status === 'warn' ? 'text-warning' : 'text-on-surface'
                  "
                >
                  {{ t(`overlayLab.log.${row.code}`) }} · {{ row.detail }}
                </span>
              </li>
            </ul>
          </section>
        </div>

        <section class="gap-sm flex flex-col">
          <h2 class="text-label text-on-surface-dim font-mono uppercase">{{ t('overlayLab.sections.tests') }}</h2>
          <p
            role="status"
            class="text-body-sm text-on-surface"
          >
            {{ announcement }}
          </p>
          <OverlayLabTests
            :running="running"
            :results="results"
            @run="runTest"
          />
        </section>
      </div>
    </div>
  </div>
</template>
