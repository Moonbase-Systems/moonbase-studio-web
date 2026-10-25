<script setup lang="ts">
import { buildSceneListRoots } from '../../application/scene-list-tree';
import { useSceneElementActions } from '../../composables/useSceneElementActions';
import { type SceneDropTarget, useSceneListInteraction } from '../../composables/useSceneListInteraction';
import type { ElementId, GroupId } from '../../models/ids.domain';
import type { Scene } from '../../models/scene.domain';
import type { SceneElementType } from '../../models/scene-element.domain';
import { useStudioSessionStore } from '../../store/studio-session.store';
import { AddElementPanel } from '../add-element-panel';
import { SceneLayerContextMenu } from '../scene-layer-context-menu';
import { SceneView } from '../scene-view';
import SceneListRow from './SceneListRow.vue';

const props = defineProps<{
  scene: Scene;
  open: boolean;
  addPanelOpen: boolean;
  renaming?: boolean;
  renameDraft?: string;
  renameError?: string | null;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  'update:addPanelOpen': [value: boolean];
  selectScene: [];
  deselect: [];
  deleteScene: [];
  'update:renameDraft': [value: string];
  renameCommit: [];
  renameCancel: [];
}>();

const store = useStudioSessionStore();
const { addElementFromDefinition, removeElement } = useSceneElementActions();
const { t } = useI18n();

const openGroups = reactive<Record<string, boolean>>({});
const listRef = ref<HTMLElement | null>(null);

const sceneState = computed(() => store.project?.scenes.find((item) => item.id === props.scene.id));

const interaction = useSceneListInteraction(props.scene.id, () => sceneState.value);

const listRoots = computed(() => {
  const current = sceneState.value;
  return current ? buildSceneListRoots(current) : [];
});

const sceneHeaderSelected = computed(
  () => store.activeSceneId === props.scene.id && store.selectedLayerIds.length === 0,
);

const contextMenuListeners = {
  delete: () => interaction.deleteSelected(),
  group: () => interaction.groupSelected(),
  rename: () => interaction.beginRename(),
};

function isGroupOpen(groupId: GroupId) {
  return openGroups[groupId] ?? true;
}

function elementById(elementId: ElementId) {
  return sceneState.value?.elements.find((element) => element.id === elementId);
}

function focusList() {
  listRef.value?.focus();
}

function onElementClick(elementId: ElementId, event: MouseEvent) {
  focusList();
  interaction.handleElementSelect(elementId, event);
}

function onGroupClick(groupId: GroupId) {
  focusList();
  interaction.selectGroupMembers(groupId);
}

function onAddDefinition(definition: Parameters<typeof addElementFromDefinition>[1]) {
  emit('update:addPanelOpen', false);
  addElementFromDefinition(props.scene.id, definition);
}

function elementTarget(elementId: ElementId): SceneDropTarget {
  return { kind: 'element', elementId };
}

function groupTarget(groupId: GroupId): SceneDropTarget {
  return { kind: 'group', groupId };
}

function isEditing(kind: 'element' | 'group', id: string) {
  const draft = interaction.renameDraft.value;
  return draft?.kind === kind && draft.id === id;
}

function draftValue() {
  return interaction.renameDraft.value?.value ?? '';
}

function draftError() {
  return interaction.renameDraft.value?.error ?? null;
}

function groupLineActive(elementIds: ElementId[]) {
  return elementIds.some((id) => interaction.isElementSelected(id));
}

function onGroupContextMenu(groupId: GroupId, event: MouseEvent) {
  if (event.shiftKey) {
    return;
  }
  const group = sceneState.value?.groups.find((item) => item.id === groupId);
  if (!group) {
    return;
  }
  const allSelected = group.elementIds.every((id) => store.selectedLayerIds.includes(id));
  if (!allSelected) {
    interaction.selectGroupMembers(groupId);
  }
}

function groupMemberIconKinds(elementIds: ElementId[]): SceneElementType[] {
  const kinds: SceneElementType[] = [];
  const seen = new Set<SceneElementType>();
  for (const elementId of elementIds) {
    const element = elementById(elementId);
    if (!element || seen.has(element.type)) {
      continue;
    }
    seen.add(element.type);
    kinds.push(element.type);
  }
  return kinds;
}
</script>

<template>
  <SceneView
    :name="scene.name"
    :open="open"
    :selected="sceneHeaderSelected"
    :renaming="renaming"
    :rename-draft="renameDraft"
    :rename-error="renameError"
    @update:open="emit('update:open', $event)"
    @select="emit('selectScene')"
    @deselect="emit('deselect')"
    @delete="emit('deleteScene')"
    @update:rename-draft="emit('update:renameDraft', $event)"
    @rename-commit="emit('renameCommit')"
    @rename-cancel="emit('renameCancel')"
  >
    <div
      ref="listRef"
      tabindex="0"
      class="outline-none"
      @keydown="interaction.handleKeyDown($event)"
    >
      <template
        v-for="root in listRoots"
        :key="root.kind === 'element' ? root.element.id : root.group.id"
      >
        <SceneLayerContextMenu
          v-if="root.kind === 'element'"
          :scene-id="scene.id"
          v-on="contextMenuListeners"
        >
          <div
            draggable="true"
            :data-element-id="root.element.id"
            :data-element-type="root.element.type"
            class="cursor-grab active:cursor-grabbing"
            @dragstart="interaction.onDragStartElement(root.element.id, $event)"
            @dragend="interaction.onDragEnd()"
            @dragover.prevent="interaction.onDragOver(elementTarget(root.element.id), $event)"
            @drop.prevent="interaction.onDrop(elementTarget(root.element.id), $event)"
            @click="onElementClick(root.element.id, $event)"
            @contextmenu.capture="interaction.handleRowContextMenu(root.element.id, $event)"
          >
            <SceneListRow
              :label="root.element.name"
              :icon-kind="root.element.type"
              :selected="interaction.isElementSelected(root.element.id)"
              :zone="interaction.dropZoneFor(elementTarget(root.element.id))"
              :editing="isEditing('element', root.element.id)"
              :draft="draftValue()"
              :error="isEditing('element', root.element.id) ? draftError() : null"
              :delete-label="t('studio.scene.deleteElement')"
              @update:draft="interaction.setRenameValue($event)"
              @commit="interaction.commitRename()"
              @cancel="interaction.cancelRename()"
              @delete="removeElement(scene.id, root.element.id)"
            />
          </div>
        </SceneLayerContextMenu>

        <div
          v-else
          :data-group-id="root.group.id"
        >
          <SceneLayerContextMenu
            :scene-id="scene.id"
            v-on="contextMenuListeners"
          >
            <div
              draggable="true"
              class="cursor-grab active:cursor-grabbing"
              @dragstart="interaction.onDragStartGroup(root.group.id, $event)"
              @dragend="interaction.onDragEnd()"
              @dragover.prevent="interaction.onDragOver(groupTarget(root.group.id), $event)"
              @drop.prevent="interaction.onDrop(groupTarget(root.group.id), $event)"
              @click="onGroupClick(root.group.id)"
              @contextmenu.capture="onGroupContextMenu(root.group.id, $event)"
            >
              <SceneListRow
                :label="root.group.name"
                :icon-kinds="groupMemberIconKinds(root.group.elementIds)"
                :selected="root.group.elementIds.every((id) => interaction.isElementSelected(id))"
                :zone="interaction.dropZoneFor(groupTarget(root.group.id))"
                :editing="isEditing('group', root.group.id)"
                :draft="draftValue()"
                :error="isEditing('group', root.group.id) ? draftError() : null"
                :delete-label="t('studio.contextMenu.dissolveGroup')"
                expandable
                :open="isGroupOpen(root.group.id)"
                :toggle-label="t('studio.scene.toggleGroup')"
                @update:draft="interaction.setRenameValue($event)"
                @commit="interaction.commitRename()"
                @cancel="interaction.cancelRename()"
                @delete="store.dissolveGroup(scene.id, root.group.id)"
                @toggle="openGroups[root.group.id] = !isGroupOpen(root.group.id)"
              />
            </div>
          </SceneLayerContextMenu>

          <BaseRevealList
            v-if="isGroupOpen(root.group.id)"
            dense
            :active="groupLineActive(root.group.elementIds)"
          >
            <SceneLayerContextMenu
              v-for="elementId in root.group.elementIds"
              :key="elementId"
              :scene-id="scene.id"
              v-on="contextMenuListeners"
            >
              <div
                v-if="elementById(elementId)"
                draggable="true"
                :data-element-id="elementId"
                :data-element-type="elementById(elementId)?.type"
                class="cursor-grab active:cursor-grabbing"
                @dragstart="interaction.onDragStartElement(elementId, $event)"
                @dragend="interaction.onDragEnd()"
                @dragover.prevent="interaction.onDragOver(elementTarget(elementId), $event)"
                @drop.prevent="interaction.onDrop(elementTarget(elementId), $event)"
                @click="onElementClick(elementId, $event)"
                @contextmenu.capture="interaction.handleRowContextMenu(elementId, $event)"
              >
                <SceneListRow
                  :label="elementById(elementId)!.name"
                  :icon-kind="elementById(elementId)!.type"
                  :selected="interaction.isElementSelected(elementId)"
                  :zone="interaction.dropZoneFor(elementTarget(elementId))"
                  :editing="isEditing('element', elementId)"
                  :draft="draftValue()"
                  :error="isEditing('element', elementId) ? draftError() : null"
                  :delete-label="t('studio.scene.deleteElement')"
                  @update:draft="interaction.setRenameValue($event)"
                  @commit="interaction.commitRename()"
                  @cancel="interaction.cancelRename()"
                  @delete="removeElement(scene.id, elementId)"
                />
              </div>
            </SceneLayerContextMenu>
          </BaseRevealList>
        </div>
      </template>
    </div>

    <template #add>
      <BasePopover
        :open="addPanelOpen"
        @update:open="emit('update:addPanelOpen', $event)"
      >
        <template #trigger>
          <BaseIconButton :label="t('studio.scene.addElement')">
            <IconPlus />
          </BaseIconButton>
        </template>
        <AddElementPanel @select="onAddDefinition" />
      </BasePopover>
    </template>
  </SceneView>
</template>
