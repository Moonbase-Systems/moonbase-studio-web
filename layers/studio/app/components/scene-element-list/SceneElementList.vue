<script setup lang="ts">
import type { SceneId } from '../../models/ids.domain';
import { useStudioSessionStore } from '../../store/studio-session.store';
import SceneElementListScene from './SceneElementListScene.vue';

const store = useStudioSessionStore();
const { t } = useI18n();

const openBySceneId = reactive<Record<string, boolean>>({});
const addPanelOpenBySceneId = reactive<Record<string, boolean>>({});

watch(
  () => store.project?.scenes.map((scene) => scene.id),
  (sceneIds) => {
    for (const sceneId of sceneIds ?? []) {
      if (!(sceneId in openBySceneId)) {
        openBySceneId[sceneId] = sceneId === store.activeSceneId;
      }
      if (!(sceneId in addPanelOpenBySceneId)) {
        addPanelOpenBySceneId[sceneId] = false;
      }
    }
  },
  { immediate: true },
);

const scenes = computed(() => store.project?.scenes ?? []);

function onSelectScene(sceneId: SceneId) {
  store.setActiveScene(sceneId);
}

function onDeselect() {
  store.clearSelection();
}

function onDeleteScene(sceneId: SceneId) {
  store.deleteScene(sceneId);
}
</script>

<template>
  <div
    v-if="scenes.length === 0"
    class="text-body-md text-on-surface-dim"
  >
    {{ t('studio.sceneList.empty') }}
  </div>

  <div
    v-else
    class="gap-md flex flex-col"
  >
    <SceneElementListScene
      v-for="scene in scenes"
      :key="scene.id"
      :scene="scene"
      :open="openBySceneId[scene.id] ?? false"
      :add-panel-open="addPanelOpenBySceneId[scene.id] ?? false"
      @update:open="openBySceneId[scene.id] = $event"
      @update:add-panel-open="addPanelOpenBySceneId[scene.id] = $event"
      @select-scene="onSelectScene(scene.id)"
      @deselect="onDeselect"
      @delete-scene="onDeleteScene(scene.id)"
    />
  </div>
</template>
