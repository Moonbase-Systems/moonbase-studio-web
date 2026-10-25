<script setup lang="ts">
import { type AddElementPanelKey, createSourceDefinitionForPanelKey } from '../../application/add-element-definitions';
import type { SourceDefinition } from '../../application/commands/source-commands';

const emit = defineEmits<{
  select: [definition: SourceDefinition];
}>();

const { t } = useI18n();

const coreOptions: AddElementPanelKey[] = ['screen', 'audio'];
const layoutOptions: AddElementPanelKey[] = ['text', 'shape', 'image'];
const interactiveOptions: AddElementPanelKey[] = ['browser', 'animation'];

function onPick(key: AddElementPanelKey) {
  const name = t(`studio.addPanel.options.${key}`);
  emit('select', createSourceDefinitionForPanelKey(key, name));
}
</script>

<template>
  <div class="gap-x-sm flex h-full min-h-0 flex-col">
    <BaseOptionGroup
      :title="t('studio.addPanel.groups.core')"
      tone="accent"
      class="min-h-0 flex-1"
    >
      <BaseOptionButton
        v-for="key in coreOptions"
        :key="key"
        :label="t(`studio.addPanel.options.${key}`)"
        tone="accent"
        @click="onPick(key)"
      />
    </BaseOptionGroup>

    <BaseOptionGroup
      :title="t('studio.addPanel.groups.layout')"
      tone="layout"
      class="min-h-0 flex-1"
    >
      <BaseOptionButton
        v-for="key in layoutOptions"
        :key="key"
        :label="t(`studio.addPanel.options.${key}`)"
        tone="layout"
        @click="onPick(key)"
      />
    </BaseOptionGroup>

    <BaseOptionGroup
      :title="t('studio.addPanel.groups.interactive')"
      tone="interactive"
      class="min-h-0 flex-1"
    >
      <BaseOptionButton
        v-for="key in interactiveOptions"
        :key="key"
        :label="t(`studio.addPanel.options.${key}`)"
        tone="interactive"
        @click="onPick(key)"
      />
    </BaseOptionGroup>
  </div>
</template>
