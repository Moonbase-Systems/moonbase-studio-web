<script setup lang="ts">
import type { SceneId } from '../../models/ids.domain';
import { displayNameSchema } from '../../schemas/display-name.schema';
import { useShortcutStore } from '../../store/shortcut.store';
import { useStudioSessionStore } from '../../store/studio-session.store';
import { SceneElementListScene } from '../scene-element-list';
import SceneContextMenu from './SceneContextMenu.vue';

const store = useStudioSessionStore();
const shortcuts = useShortcutStore();
const { t } = useI18n();

const listRef = ref<HTMLElement | null>(null);
const openBySceneId = reactive<Record<string, boolean>>({});
const addPanelOpenBySceneId = reactive<Record<string, boolean>>({});
const renameId = ref<SceneId | null>(null);
const renameValue = ref('');
const renameError = ref<string | null>(null);

const scenes = computed(() => store.project?.scenes ?? []);
const canDeleteScene = computed(() => scenes.value.length > 1);

watch(
  () => scenes.value.map((scene) => scene.id),
  (ids) => {
    for (const id of ids) {
      if (!(id in openBySceneId)) {
        openBySceneId[id] = id === store.activeSceneId;
      }
      if (!(id in addPanelOpenBySceneId)) {
        addPanelOpenBySceneId[id] = false;
      }
    }
  },
  { immediate: true },
);

function onSelect(sceneId: SceneId) {
  store.setActiveScene(sceneId);
  listRef.value?.focus();
}

function onAddScene() {
  const result = store.createScene();
  if (result.ok && store.activeSceneId) {
    openBySceneId[store.activeSceneId] = true;
  }
}

function onDelete(sceneId: SceneId) {
  if (!canDeleteScene.value) {
    return;
  }
  store.deleteScene(sceneId);
}

function beginRename(sceneId: SceneId) {
  const scene = scenes.value.find((item) => item.id === sceneId);
  if (!scene) {
    return;
  }
  store.setActiveScene(sceneId);
  renameId.value = sceneId;
  renameValue.value = scene.name;
  renameError.value = null;
}

function cancelRename() {
  renameId.value = null;
  renameError.value = null;
}

function commitRename() {
  const sceneId = renameId.value;
  if (!sceneId) {
    return;
  }
  const parsed = displayNameSchema.safeParse(renameValue.value);
  if (!parsed.success) {
    renameError.value = t('studio.scene.invalidName');
    return;
  }
  const result = store.renameScene(sceneId, parsed.data);
  if (!result.ok) {
    renameError.value = t('studio.scene.invalidName');
    return;
  }
  renameId.value = null;
  renameError.value = null;
}

function moveScene(sceneId: SceneId, direction: 'up' | 'down') {
  store.moveSceneRelative(sceneId, direction);
}

function onRowContextMenu(sceneId: SceneId) {
  if (store.activeSceneId !== sceneId) {
    store.setActiveScene(sceneId);
  }
}

function handleKeyDown(event: KeyboardEvent) {
  const activeId = store.activeSceneId;
  if (!activeId) {
    return;
  }
  // Scene rename/reorder only when the scene itself is selected (no layers).
  if (store.selectedLayerIds.length > 0) {
    return;
  }
  if (shortcuts.matchesKey(event, 'rename')) {
    event.preventDefault();
    beginRename(activeId);
    return;
  }
  if (shortcuts.matchesKey(event, 'reorder.up')) {
    event.preventDefault();
    moveScene(activeId, 'up');
  }
  if (shortcuts.matchesKey(event, 'reorder.down')) {
    event.preventDefault();
    moveScene(activeId, 'down');
  }
}
</script>

<template>
  <aside class="flex h-full min-h-0 w-full flex-col">
    <h2 class="text-heading-md text-accent shrink-0 text-center font-medium">
      {{ t('studio.sceneList.title') }}
    </h2>

    <div
      ref="listRef"
      tabindex="0"
      class="gap-md mt-md flex min-h-0 flex-1 flex-col overflow-y-auto outline-none"
      @keydown="handleKeyDown"
    >
      <SceneContextMenu
        v-for="(scene, index) in scenes"
        :key="scene.id"
        :can-delete="canDeleteScene"
        :can-rename="true"
        :can-move-up="index > 0"
        :can-move-down="index < scenes.length - 1"
        @delete="onDelete(scene.id)"
        @rename="beginRename(scene.id)"
        @move-up="moveScene(scene.id, 'up')"
        @move-down="moveScene(scene.id, 'down')"
      >
        <div @contextmenu.capture="onRowContextMenu(scene.id)">
          <SceneElementListScene
            :scene="scene"
            :open="openBySceneId[scene.id] ?? false"
            :add-panel-open="addPanelOpenBySceneId[scene.id] ?? false"
            :renaming="renameId === scene.id"
            :rename-draft="renameValue"
            :rename-error="renameId === scene.id ? renameError : null"
            @update:open="openBySceneId[scene.id] = $event"
            @update:add-panel-open="addPanelOpenBySceneId[scene.id] = $event"
            @select-scene="onSelect(scene.id)"
            @deselect="store.clearSelection()"
            @delete-scene="onDelete(scene.id)"
            @update:rename-draft="renameValue = $event"
            @rename-commit="commitRename"
            @rename-cancel="cancelRename"
          />
        </div>
      </SceneContextMenu>
    </div>

    <div class="pt-md flex shrink-0 justify-center">
      <BaseIconButton
        :label="t('studio.sceneList.add')"
        class="text-accent hover:text-accent-dim"
        @click="onAddScene"
      >
        <IconPlus />
      </BaseIconButton>
    </div>
  </aside>
</template>
