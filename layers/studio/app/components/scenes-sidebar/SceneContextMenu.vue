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
        <ContextMenuSeparator class="my-tiny bg-line h-px" />
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
