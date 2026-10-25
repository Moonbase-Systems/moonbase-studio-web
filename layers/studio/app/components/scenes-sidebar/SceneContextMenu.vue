<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuPortal,
  ContextMenuRoot,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from 'reka-ui';

import { cn } from '~/utils/index';

defineProps<{
  canDelete: boolean;
  canRename: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}>();

const emit = defineEmits<{
  delete: [];
  rename: [];
  moveUp: [];
  moveDown: [];
}>();

const { t } = useI18n();

const itemClass =
  'cursor-pointer rounded-x-sm px-sm py-xx-sm font-roboto text-body-sm text-on-surface outline-none data-[highlighted]:bg-surface-inverted/10 data-[disabled]:pointer-events-none data-[disabled]:opacity-40';
</script>

<template>
  <ContextMenuRoot>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent
        data-scene-context-menu
        :class="
          cn(
            'border-on-surface-dim/30 bg-surface-container p-x-sm py-tiny z-50 min-w-[12rem] rounded-sm border shadow-lg outline-none',
          )
        "
      >
        <ContextMenuItem
          :class="itemClass"
          :disabled="!canRename"
          @select="emit('rename')"
        >
          {{ t('studio.contextMenu.rename') }}
        </ContextMenuItem>
        <ContextMenuItem
          :class="itemClass"
          :disabled="!canDelete"
          @select="emit('delete')"
        >
          {{ t('studio.sceneList.delete') }}
        </ContextMenuItem>
        <ContextMenuSeparator class="my-tiny bg-on-surface-dim/30 h-px" />
        <ContextMenuItem
          :class="itemClass"
          :disabled="!canMoveUp"
          @select="emit('moveUp')"
        >
          {{ t('studio.contextMenu.moveUp') }}
        </ContextMenuItem>
        <ContextMenuItem
          :class="itemClass"
          :disabled="!canMoveDown"
          @select="emit('moveDown')"
        >
          {{ t('studio.contextMenu.moveDown') }}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
</template>
