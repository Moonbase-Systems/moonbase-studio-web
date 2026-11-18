<script setup lang="ts">
import { cn } from '~/utils/index';

import { useOverlayLabFields } from '../../composables/useOverlayLabConsole';
import { inspectorFieldShellClass, inspectorLabelClass } from '../properties-inspector/inspector-control-classes';

const { drafts, soundDraft, selected, issues } = useOverlayLabFields();

const fieldClass = cn(inspectorFieldShellClass, 'w-full');
</script>

<template>
  <div class="gap-sm flex flex-col">
    <template v-if="selected === 'follow'">
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.username') }}</span>
        <input
          v-model="drafts.follow.username"
          :class="fieldClass"
          autocomplete="off"
        />
      </label>
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.displayName') }}</span>
        <input
          v-model="drafts.follow.displayName"
          :class="fieldClass"
          autocomplete="off"
        />
      </label>
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.avatarUrl') }}</span>
        <input
          v-model="drafts.follow.avatarUrl"
          :class="fieldClass"
          autocomplete="off"
          inputmode="url"
        />
      </label>
    </template>

    <template v-else-if="selected === 'subscription'">
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.username') }}</span>
        <input
          v-model="drafts.subscription.username"
          :class="fieldClass"
          autocomplete="off"
        />
      </label>
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.plan') }}</span>
        <input
          v-model="drafts.subscription.plan"
          :class="fieldClass"
          autocomplete="off"
        />
      </label>
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.months') }}</span>
        <input
          v-model.number="drafts.subscription.months"
          :class="fieldClass"
          type="number"
          min="1"
          max="120"
        />
      </label>
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.message') }}</span>
        <input
          v-model="drafts.subscription.message"
          :class="fieldClass"
          autocomplete="off"
        />
      </label>
    </template>

    <template v-else-if="selected === 'donation'">
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.username') }}</span>
        <input
          v-model="drafts.donation.username"
          :class="fieldClass"
          autocomplete="off"
        />
      </label>
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.amount') }}</span>
        <input
          v-model.number="drafts.donation.amount"
          :class="fieldClass"
          type="number"
          min="0"
          step="0.01"
        />
      </label>
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.currency') }}</span>
        <input
          v-model="drafts.donation.currency"
          :class="fieldClass"
          autocomplete="off"
          maxlength="3"
        />
      </label>
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.message') }}</span>
        <input
          v-model="drafts.donation.message"
          :class="fieldClass"
          autocomplete="off"
        />
      </label>
    </template>

    <template v-else-if="selected === 'raid'">
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.username') }}</span>
        <input
          v-model="drafts.raid.username"
          :class="fieldClass"
          autocomplete="off"
        />
      </label>
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.viewers') }}</span>
        <input
          v-model.number="drafts.raid.viewerCount"
          :class="fieldClass"
          type="number"
          min="0"
        />
      </label>
    </template>

    <template v-else-if="selected === 'cheer'">
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.username') }}</span>
        <input
          v-model="drafts.cheer.username"
          :class="fieldClass"
          autocomplete="off"
        />
      </label>
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.amount') }}</span>
        <input
          v-model.number="drafts.cheer.amount"
          :class="fieldClass"
          type="number"
          min="1"
        />
      </label>
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.message') }}</span>
        <input
          v-model="drafts.cheer.message"
          :class="fieldClass"
          autocomplete="off"
        />
      </label>
    </template>

    <template v-else-if="selected === 'chat'">
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.username') }}</span>
        <input
          v-model="drafts.chat.username"
          :class="fieldClass"
          autocomplete="off"
        />
      </label>
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.message') }}</span>
        <input
          v-model="drafts.chat.message"
          :class="fieldClass"
          autocomplete="off"
        />
      </label>
    </template>

    <template v-else>
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.title') }}</span>
        <input
          v-model="drafts.custom.title"
          :class="fieldClass"
          autocomplete="off"
        />
      </label>
      <label class="gap-xxx-sm flex min-w-0 flex-col">
        <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.message') }}</span>
        <input
          v-model="drafts.custom.message"
          :class="fieldClass"
          autocomplete="off"
        />
      </label>
    </template>

    <label class="gap-xxx-sm flex min-w-0 flex-col">
      <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.soundUrl') }}</span>
      <input
        v-model="soundDraft.url"
        :class="fieldClass"
        type="text"
        inputmode="url"
        spellcheck="false"
        autocomplete="off"
      />
    </label>
    <label class="gap-xxx-sm flex min-w-0 flex-col">
      <span :class="inspectorLabelClass">{{ $t('overlayLab.fields.soundVolume') }}</span>
      <input
        v-model.number="soundDraft.volumeDb"
        :class="fieldClass"
        type="number"
        min="-24"
        max="12"
        step="1"
      />
    </label>

    <ul
      v-if="issues.length > 0"
      class="gap-xxx-sm flex flex-col"
      role="alert"
    >
      <li
        v-for="issue in issues"
        :key="issue"
        class="text-body-sm text-error font-sans"
      >
        {{ issue }}
      </li>
    </ul>
  </div>
</template>
