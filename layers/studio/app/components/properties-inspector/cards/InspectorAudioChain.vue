<script setup lang="ts">
import { cn } from '~/utils/index';

import type { AudioEffectLocation } from '../../../application/commands/audio-effect-commands';
import { useStudioAudioEngine } from '../../../composables/useStudioAudioEngine';
import {
  AUDIO_EFFECT_TYPES,
  type AudioEffect,
  type AudioEffectType,
  COMPRESSOR_ATTACK_MAX,
  COMPRESSOR_ATTACK_MIN,
  COMPRESSOR_KNEE_MAX,
  COMPRESSOR_KNEE_MIN,
  COMPRESSOR_MAKEUP_MAX,
  COMPRESSOR_MAKEUP_MIN,
  COMPRESSOR_RATIO_MAX,
  COMPRESSOR_RATIO_MIN,
  COMPRESSOR_RELEASE_MAX,
  COMPRESSOR_RELEASE_MIN,
  COMPRESSOR_THRESHOLD_MAX,
  COMPRESSOR_THRESHOLD_MIN,
  defaultEffectName,
  EQ_FILTERS,
  EQ_FREQUENCY_MAX,
  EQ_FREQUENCY_MIN,
  EQ_GAIN_MAX,
  EQ_GAIN_MIN,
  EQ_Q_MAX,
  EQ_Q_MIN,
  GATE_ATTACK_MAX,
  GATE_ATTACK_MIN,
  GATE_HOLD_MAX,
  GATE_HOLD_MIN,
  GATE_RANGE_MAX,
  GATE_RANGE_MIN,
  GATE_RELEASE_MAX,
  GATE_RELEASE_MIN,
  GATE_THRESHOLD_MAX,
  GATE_THRESHOLD_MIN,
  HPF_FREQUENCY_MAX,
  HPF_FREQUENCY_MIN,
  HPF_Q_MAX,
  HPF_Q_MIN,
  LIMITER_CEILING_MAX,
  LIMITER_CEILING_MIN,
  LIMITER_LOOKAHEAD_MAX,
  LIMITER_LOOKAHEAD_MIN,
  LIMITER_RELEASE_MAX,
  LIMITER_RELEASE_MIN,
} from '../../../models/audio-effect.domain';
import { useStudioSessionStore } from '../../../store/studio-session.store';
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
  location: AudioEffectLocation;
  effects: AudioEffect[];
  heading: string;
  hint?: string;
  reportChainError?: boolean;
}>();

const { t } = useI18n();
const store = useStudioSessionStore();
const audioEngine = useStudioAudioEngine();
const nextType = ref<AudioEffectType>('eq-band');
const curveCache = new Map<string, string>();
const openMenu = ref<null | { kind: 'add' } | { kind: 'filter'; effectId: string }>(null);
const panelStyle = ref<Record<string, string>>({});

type Field = {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  suffix: string;
};

const fieldsFor = (effect: AudioEffect): Field[] => {
  switch (effect.type) {
    case 'eq-band':
      return [
        { key: 'frequencyHz', label: 'frequency', min: EQ_FREQUENCY_MIN, max: EQ_FREQUENCY_MAX, step: 1, suffix: 'Hz' },
        { key: 'gainDb', label: 'gain', min: EQ_GAIN_MIN, max: EQ_GAIN_MAX, step: 0.5, suffix: 'dB' },
        { key: 'q', label: 'q', min: EQ_Q_MIN, max: EQ_Q_MAX, step: 0.1, suffix: '' },
      ];
    case 'high-pass':
      return [
        {
          key: 'frequencyHz',
          label: 'frequency',
          min: HPF_FREQUENCY_MIN,
          max: HPF_FREQUENCY_MAX,
          step: 1,
          suffix: 'Hz',
        },
        { key: 'q', label: 'q', min: HPF_Q_MIN, max: HPF_Q_MAX, step: 0.01, suffix: '' },
      ];
    case 'compressor':
      return [
        {
          key: 'thresholdDb',
          label: 'threshold',
          min: COMPRESSOR_THRESHOLD_MIN,
          max: COMPRESSOR_THRESHOLD_MAX,
          step: 0.5,
          suffix: 'dB',
        },
        { key: 'kneeDb', label: 'knee', min: COMPRESSOR_KNEE_MIN, max: COMPRESSOR_KNEE_MAX, step: 0.5, suffix: 'dB' },
        { key: 'ratio', label: 'ratio', min: COMPRESSOR_RATIO_MIN, max: COMPRESSOR_RATIO_MAX, step: 0.1, suffix: ':1' },
        {
          key: 'attackMs',
          label: 'attack',
          min: COMPRESSOR_ATTACK_MIN,
          max: COMPRESSOR_ATTACK_MAX,
          step: 1,
          suffix: 'ms',
        },
        {
          key: 'releaseMs',
          label: 'release',
          min: COMPRESSOR_RELEASE_MIN,
          max: COMPRESSOR_RELEASE_MAX,
          step: 1,
          suffix: 'ms',
        },
        {
          key: 'makeupDb',
          label: 'makeup',
          min: COMPRESSOR_MAKEUP_MIN,
          max: COMPRESSOR_MAKEUP_MAX,
          step: 0.5,
          suffix: 'dB',
        },
      ];
    case 'noise-gate':
      return [
        {
          key: 'thresholdDb',
          label: 'threshold',
          min: GATE_THRESHOLD_MIN,
          max: GATE_THRESHOLD_MAX,
          step: 0.5,
          suffix: 'dB',
        },
        { key: 'attackMs', label: 'attack', min: GATE_ATTACK_MIN, max: GATE_ATTACK_MAX, step: 0.1, suffix: 'ms' },
        { key: 'holdMs', label: 'hold', min: GATE_HOLD_MIN, max: GATE_HOLD_MAX, step: 1, suffix: 'ms' },
        { key: 'releaseMs', label: 'release', min: GATE_RELEASE_MIN, max: GATE_RELEASE_MAX, step: 1, suffix: 'ms' },
        { key: 'rangeDb', label: 'range', min: GATE_RANGE_MIN, max: GATE_RANGE_MAX, step: 1, suffix: 'dB' },
      ];
    case 'limiter':
      return [
        {
          key: 'ceilingDb',
          label: 'ceiling',
          min: LIMITER_CEILING_MIN,
          max: LIMITER_CEILING_MAX,
          step: 0.1,
          suffix: 'dB',
        },
        {
          key: 'releaseMs',
          label: 'release',
          min: LIMITER_RELEASE_MIN,
          max: LIMITER_RELEASE_MAX,
          step: 1,
          suffix: 'ms',
        },
        {
          key: 'lookaheadMs',
          label: 'lookahead',
          min: LIMITER_LOOKAHEAD_MIN,
          max: LIMITER_LOOKAHEAD_MAX,
          step: 1,
          suffix: 'ms',
        },
      ];
    default: {
      const unreachable: never = effect;
      return unreachable;
    }
  }
};

const fieldValue = (effect: AudioEffect, key: string): number => {
  const parameters = effect.parameters as Record<string, number | string>;
  const value = parameters[key];
  return typeof value === 'number' ? value : 0;
};

function commitField(effect: AudioEffect, key: string, raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return;
  }
  store.updateAudioEffectParameters(props.location, effect.id, { ...effect.parameters, [key]: value });
}

function setEqFilter(effect: AudioEffect, filter: string) {
  if (effect.type !== 'eq-band' || !EQ_FILTERS.includes(filter as (typeof EQ_FILTERS)[number])) {
    return;
  }
  store.updateAudioEffectParameters(props.location, effect.id, {
    ...effect.parameters,
    filter: filter as (typeof EQ_FILTERS)[number],
  });
}

function addEffect() {
  store.addAudioEffect(props.location, nextType.value);
  openMenu.value = null;
}

function toggleMenu(event: MouseEvent, menu: { kind: 'add' } | { kind: 'filter'; effectId: string }) {
  const trigger = event.currentTarget;
  if (!(trigger instanceof HTMLButtonElement)) {
    return;
  }
  const current = openMenu.value;
  const same =
    current?.kind === menu.kind &&
    (menu.kind === 'add' || (current.kind === 'filter' && current.effectId === menu.effectId));
  if (same) {
    openMenu.value = null;
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const width = 220;
  const left = Math.min(rect.left, window.innerWidth - width - 8);
  panelStyle.value = {
    left: `${Math.max(8, left)}px`,
    bottom: `${window.innerHeight - rect.top + 4}px`,
    width: `${width}px`,
    maxHeight: `${Math.max(120, rect.top - 12)}px`,
  };
  openMenu.value = menu;
}

function chooseType(type: AudioEffectType) {
  nextType.value = type;
  openMenu.value = null;
}

function filterMenuOpen(effectId: string): boolean {
  return openMenu.value?.kind === 'filter' && openMenu.value.effectId === effectId;
}

const filterMenuEffect = computed(() => {
  if (openMenu.value?.kind !== 'filter') {
    return null;
  }
  const effectId = openMenu.value.effectId;
  return props.effects.find((effect) => effect.id === effectId && effect.type === 'eq-band') ?? null;
});

function chooseFilter(filter: string) {
  const effect = filterMenuEffect.value;
  if (!effect) {
    return;
  }
  setEqFilter(effect, filter);
  openMenu.value = null;
}

function filterSelected(filter: string): boolean {
  const effect = filterMenuEffect.value;
  return effect?.type === 'eq-band' && effect.parameters.filter === filter;
}

function effectTitle(effect: AudioEffect): string {
  const typeLabel = t(`studio.audio.types.${effect.type}`);
  return effect.name === defaultEffectName(effect.type) ? typeLabel : `${typeLabel} · ${effect.name}`;
}

function curvePoints(effect: AudioEffect): string {
  if (effect.type !== 'eq-band' && effect.type !== 'high-pass') {
    return '';
  }
  const key = `${effect.type}:${JSON.stringify(effect.parameters)}`;
  const cached = curveCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const curve = audioEngine.readCurve(effect);
  if (!curve || curve.magnitudeDb.length < 2) {
    return '';
  }
  const points = curve.magnitudeDb
    .map((db, index) => {
      const x = (index / (curve.magnitudeDb.length - 1)) * 240;
      const y = 32 - (Math.max(-18, Math.min(18, db)) / 18) * 28;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  curveCache.set(key, points);
  return points;
}

function curveSummary(effect: AudioEffect): string {
  if (effect.type === 'high-pass') {
    return t('studio.audio.curveHighPass', { frequency: Math.round(effect.parameters.frequencyHz) });
  }
  if (effect.type === 'eq-band') {
    return t('studio.audio.curveEq', {
      frequency: Math.round(effect.parameters.frequencyHz),
      gain: effect.parameters.gainDb.toFixed(1),
    });
  }
  return '';
}

function reductionText(effectId: string): string {
  const value = audioEngine.levels.reductions[effectId];
  if (value === undefined || !Number.isFinite(value)) {
    return t('studio.audio.reductionUnknown');
  }
  return t('studio.audio.reductionValue', { db: value.toFixed(1) });
}
</script>

<template>
  <section class="border-line gap-xxx-sm pt-sm flex w-full min-w-0 flex-col border-t">
    <p :class="inspectorLabelClass">{{ heading }}</p>
    <p
      v-if="hint"
      class="text-body-sm text-on-surface-dim font-sans"
    >
      {{ hint }}
    </p>
    <p
      v-if="reportChainError && audioEngine.levels.chainError"
      role="status"
      aria-atomic="true"
      class="text-body-sm text-on-surface font-sans"
    >
      {{ t('studio.audio.chainFailed') }}
    </p>
    <div :class="inspectorRowClass">
      <button
        type="button"
        :class="cn(inspectorFieldShellClass, 'min-w-0 flex-1')"
        :aria-expanded="openMenu?.kind === 'add'"
        :aria-label="t('studio.audio.addEffect')"
        @click="toggleMenu($event, { kind: 'add' })"
      >
        <span class="min-w-0 flex-1 truncate text-left">{{ t(`studio.audio.types.${nextType}`) }}</span>
        <span :class="cn(inspectorChevronClass, openMenu?.kind === 'add' && 'rotate-180')"> &gt; </span>
      </button>
      <button
        type="button"
        :class="inspectorToggleClass(false)"
        @click="addEffect"
      >
        {{ t('studio.audio.addEffect') }}
      </button>
    </div>

    <article
      v-for="(effect, index) in effects"
      :key="effect.id"
      class="border-line gap-xxx-sm p-xxx-sm flex flex-col border"
    >
      <div :class="inspectorRowClass">
        <span class="min-w-0 flex-1 truncate font-sans">{{ effectTitle(effect) }}</span>
        <button
          type="button"
          :class="inspectorToggleClass(effect.enabled)"
          :aria-pressed="effect.enabled"
          @click="store.setAudioEffectEnabled(location, effect.id, !effect.enabled)"
        >
          {{ effect.enabled ? t('studio.audio.enabled') : t('studio.audio.bypassed') }}
        </button>
      </div>
      <div :class="inspectorRowClass">
        <button
          type="button"
          :class="inspectorToggleClass(false)"
          @click="store.saveAudioEffectPreset(location, effect.id, effect.name)"
        >
          {{ t('studio.audio.saveEffectPreset') }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(false, index === 0)"
          :disabled="index === 0"
          @click="store.reorderAudioEffect(location, effect.id, index - 1)"
        >
          {{ t('studio.audio.moveUp') }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(false, index === effects.length - 1)"
          :disabled="index === effects.length - 1"
          @click="store.reorderAudioEffect(location, effect.id, index + 1)"
        >
          {{ t('studio.audio.moveDown') }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(false)"
          @click="store.resetAudioEffect(location, effect.id)"
        >
          {{ t('studio.audio.resetEffect') }}
        </button>
        <button
          type="button"
          :class="inspectorToggleClass(false)"
          @click="store.removeAudioEffect(location, effect.id)"
        >
          {{ t('studio.audio.removeEffect') }}
        </button>
      </div>

      <div
        v-if="effect.type === 'eq-band'"
        :class="inspectorRowClass"
      >
        <span :class="inspectorLabelClass">{{ t('studio.audio.params.filter') }}</span>
        <button
          type="button"
          :class="cn(inspectorFieldShellClass, 'min-w-0 flex-1')"
          :aria-expanded="filterMenuOpen(effect.id)"
          :aria-label="t('studio.audio.params.filter')"
          @click="toggleMenu($event, { kind: 'filter', effectId: effect.id })"
        >
          <span class="min-w-0 flex-1 truncate text-left">{{
            t(`studio.audio.filters.${effect.parameters.filter}`)
          }}</span>
          <span :class="cn(inspectorChevronClass, filterMenuOpen(effect.id) && 'rotate-180')"> &gt; </span>
        </button>
      </div>

      <div
        v-for="field in fieldsFor(effect)"
        :key="`${effect.id}-${field.key}`"
        :class="inspectorRowClass"
      >
        <span :class="inspectorLabelClass">{{ t(`studio.audio.params.${field.label}`) }}</span>
        <BaseScrubField
          compact
          label=" "
          field-suffix="horizontal"
          :suffix="field.suffix"
          field-class="w-[88px]"
          :model-value="fieldValue(effect, field.key)"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          @change="commitField(effect, field.key, $event)"
        />
      </div>

      <p
        v-if="effect.type === 'eq-band' || effect.type === 'high-pass'"
        class="text-body-sm text-on-surface font-sans"
      >
        {{ curveSummary(effect) }}
      </p>
      <svg
        v-if="curvePoints(effect)"
        viewBox="0 0 240 64"
        class="border-line h-16 w-full border"
        role="img"
        :aria-label="curveSummary(effect)"
      >
        <line
          x1="0"
          x2="240"
          y1="32"
          y2="32"
          class="text-on-surface-dim"
          stroke="currentColor"
          stroke-opacity="0.35"
        />
        <polyline
          fill="none"
          class="text-accent"
          stroke="currentColor"
          stroke-width="1.5"
          :points="curvePoints(effect)"
        />
      </svg>

      <p
        v-if="effect.type === 'compressor'"
        class="text-body-sm text-on-surface font-sans"
      >
        {{ t('studio.audio.reduction') }}
        <span>{{ reductionText(effect.id) }}</span>
      </p>
      <p
        v-if="effect.type === 'limiter'"
        class="text-body-sm text-on-surface font-sans"
      >
        {{ t('studio.audio.lookahead', { ms: effect.parameters.lookaheadMs }) }}
      </p>
    </article>

    <Teleport to="body">
      <button
        v-if="openMenu"
        type="button"
        class="fixed inset-0 z-40 cursor-default bg-transparent"
        :aria-label="t('studio.document.cancel')"
        @click="openMenu = null"
      />
      <div
        v-if="openMenu"
        :class="cn(inspectorMenuPanelClass, 'overflow-y-auto')"
        :style="panelStyle"
        @keydown.esc="openMenu = null"
      >
        <template v-if="openMenu.kind === 'add'">
          <button
            v-for="type in AUDIO_EFFECT_TYPES"
            :key="type"
            type="button"
            :class="inspectorMenuItemClass(type === nextType)"
            @click="chooseType(type)"
          >
            {{ t(`studio.audio.types.${type}`) }}
          </button>
        </template>
        <template v-else-if="filterMenuEffect">
          <button
            v-for="filter in EQ_FILTERS"
            :key="filter"
            type="button"
            :class="inspectorMenuItemClass(filterSelected(filter))"
            @click="chooseFilter(filter)"
          >
            {{ t(`studio.audio.filters.${filter}`) }}
          </button>
        </template>
      </div>
    </Teleport>
  </section>
</template>
