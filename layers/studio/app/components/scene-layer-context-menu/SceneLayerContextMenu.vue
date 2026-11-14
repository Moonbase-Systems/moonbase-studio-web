<script setup lang="ts">
import { ContextMenuContent, ContextMenuItem, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from 'reka-ui';

import { cn } from '~/utils/index';

import type { SceneId } from '../../models/ids.domain';
import { useStudioSessionStore } from '../../store/studio-session.store';

const props = defineProps<{
  sceneId: SceneId;
}>();

const emit = defineEmits<{
  delete: [];
  group: [];
  rename: [];
  duplicate: [];
  moveUp: [];
  moveDown: [];
  moveTop: [];
  moveBottom: [];
}>();

const store = useStudioSessionStore();
const { t } = useI18n();

const scene = computed(() => store.project?.scenes.find((item) => item.id === props.sceneId));

const canDelete = computed(() => store.selectedLayerIds.length > 0);

const canDuplicate = computed(() => store.selectedLayerIds.length === 1);

const canGroup = computed(() => {
  const current = scene.value;
  if (!current) {
    return false;
  }
  const ungrouped = store.selectedLayerIds.filter((id) => {
    const element = current.elements.find((item) => item.id === id);
    return element && !element.parentGroupId;
  });
  return ungrouped.length >= 2;
});

const canRename = computed(() => {
  const current = scene.value;
  const selected = store.selectedLayerIds;
  if (!current || selected.length === 0) {
    return false;
  }
  if (selected.length === 1) {
    return true;
  }
  return current.groups.some(
    (group) => group.elementIds.length === selected.length && group.elementIds.every((id) => selected.includes(id)),
  );
});

const canReorder = computed(() => store.selectedLayerIds.length > 0);

const itemClass =
  'flex h-control cursor-pointer items-center px-x-sm font-sans text-body-sm text-on-surface outline-none data-[highlighted]:bg-surface-container-high data-[disabled]:pointer-events-none data-[disabled]:text-on-surface-dim';
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        data-scene-context-menu
        :class="cn('border-line bg-surface-container p-tiny z-50 min-w-[20.8rem] border outline-none')"
      >
        <ContextMenuItem
          :class="itemClass"
          :disabled="!canDelete"
          @select="emit('delete')"
        >
          {{ t('studio.contextMenu.deleteElement') }}
        </ContextMenuItem>
        <ContextMenuItem
          :class="itemClass"
          :disabled="!canDuplicate"
          @select="emit('duplicate')"
        >
          {{ t('studio.contextMenu.duplicate') }}
        </ContextMenuItem>
        <ContextMenuItem
          :class="itemClass"
          :disabled="!canGroup"
          @select="emit('group')"
        >
          {{ t('studio.contextMenu.group') }}
        </ContextMenuItem>
        <ContextMenuItem
          :class="itemClass"
          :disabled="!canRename"
          @select="emit('rename')"
        >
          {{ t('studio.contextMenu.rename') }}
        </ContextMenuItem>
        <ContextMenuItem
          :class="itemClass"
          :disabled="!canReorder"
          @select="emit('moveUp')"
        >
          {{ t('studio.contextMenu.moveUp') }}
        </ContextMenuItem>
        <ContextMenuItem
          :class="itemClass"
          :disabled="!canReorder"
          @select="emit('moveDown')"
        >
          {{ t('studio.contextMenu.moveDown') }}
        </ContextMenuItem>
        <ContextMenuItem
          :class="itemClass"
          :disabled="!canReorder"
          @select="emit('moveTop')"
        >
          {{ t('studio.contextMenu.moveTop') }}
        </ContextMenuItem>
        <ContextMenuItem
          :class="itemClass"
          :disabled="!canReorder"
          @select="emit('moveBottom')"
        >
          {{ t('studio.contextMenu.moveBottom') }}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
