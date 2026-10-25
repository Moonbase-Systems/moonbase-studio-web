import { buildSceneListRoots, flattenSelectableElementIds } from '../application/scene-list-tree';
import type { ElementId, GroupId, SceneId } from '../models/ids.domain';
import type { Scene } from '../models/scene.domain';
import { displayNameSchema } from '../schemas/display-name.schema';
import { useStudioSessionStore } from '../store/studio-session.store';

export type SceneDropZone = 'before' | 'center' | 'after';

export type SceneDragSource = { kind: 'element'; elementId: ElementId } | { kind: 'group'; groupId: GroupId };

export type SceneDropTarget = { kind: 'element'; elementId: ElementId } | { kind: 'group'; groupId: GroupId };

export type SceneRenameDraft = {
  kind: 'element' | 'group';
  id: string;
  value: string;
  error: string | null;
};

export function useSceneListInteraction(sceneId: SceneId, scene: () => Scene | undefined) {
  const store = useStudioSessionStore();
  const { t } = useI18n();
  const selectionAnchorId = ref<ElementId | null>(null);
  const dragSource = ref<SceneDragSource | null>(null);
  const dropHint = ref<{ target: SceneDropTarget; zone: SceneDropZone } | null>(null);
  const renameDraft = ref<SceneRenameDraft | null>(null);

  function ensureActiveScene() {
    if (store.activeSceneId !== sceneId) {
      store.setActiveScene(sceneId);
    }
  }

  const orderedElementIds = computed(() => {
    const current = scene();
    if (!current) {
      return [];
    }
    return flattenSelectableElementIds(current, buildSceneListRoots(current));
  });

  function ungroupedSelectedIds() {
    const current = scene();
    if (!current) {
      return [];
    }
    return store.selectedLayerIds.filter((id) => {
      const element = current.elements.find((item) => item.id === id);
      return element && !element.parentGroupId;
    });
  }

  function isElementSelected(elementId: ElementId) {
    return store.selectedLayerIds.includes(elementId);
  }

  function handleElementSelect(elementId: ElementId, event: MouseEvent) {
    ensureActiveScene();

    if (event.shiftKey) {
      const anchor = selectionAnchorId.value ?? (store.selectedLayerIds.length > 0 ? store.selectedLayerIds[0]! : null);
      if (anchor) {
        selectRange(anchor, elementId);
        selectionAnchorId.value = anchor;
        return;
      }
    }

    if (event.metaKey || event.ctrlKey) {
      toggleElementSelection(elementId);
      selectionAnchorId.value = elementId;
      return;
    }

    store.selectLayer(elementId);
    selectionAnchorId.value = elementId;
  }

  function handleRowContextMenu(elementId: ElementId, event: MouseEvent) {
    ensureActiveScene();
    if (event.shiftKey) {
      return;
    }
    if (store.selectedLayerIds.includes(elementId)) {
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      toggleElementSelection(elementId);
      selectionAnchorId.value = elementId;
      return;
    }
    store.selectLayer(elementId);
    selectionAnchorId.value = elementId;
  }

  function selectRange(fromId: ElementId, toId: ElementId) {
    const ordered = orderedElementIds.value;
    const fromIndex = ordered.indexOf(fromId);
    const toIndex = ordered.indexOf(toId);
    if (fromIndex === -1 || toIndex === -1) {
      return;
    }
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    store.setSelectedLayers(ordered.slice(start, end + 1));
  }

  function toggleElementSelection(elementId: ElementId) {
    const next = new Set(store.selectedLayerIds);
    if (next.has(elementId)) {
      next.delete(elementId);
    } else {
      next.add(elementId);
    }
    store.setSelectedLayers([...next]);
  }

  function selectGroupMembers(groupId: GroupId) {
    ensureActiveScene();
    const current = scene();
    if (!current) {
      return;
    }
    const group = current.groups.find((item) => item.id === groupId);
    if (!group) {
      return;
    }
    store.setSelectedLayers([...group.elementIds]);
    selectionAnchorId.value = group.elementIds[0] ?? null;
  }

  function deleteSelected() {
    const ids = store.selectedLayerIds;
    if (ids.length === 0) {
      return;
    }
    store.removeLayers(sceneId, ids);
  }

  function groupSelected() {
    const ids = ungroupedSelectedIds();
    if (ids.length < 2) {
      return;
    }
    store.createGroupFromElements(sceneId, ids);
  }

  function ungroupSelected() {
    const current = scene();
    if (!current) {
      return;
    }
    const ids = store.selectedLayerIds.filter((id) => {
      const element = current.elements.find((item) => item.id === id);
      return element?.parentGroupId;
    });
    if (ids.length === 0) {
      return;
    }
    store.removeElementsFromGroup(sceneId, ids);
  }

  function dissolveSelectedGroup() {
    const current = scene();
    if (!current) {
      return;
    }
    const selected = store.selectedLayerIds;
    const group = current.groups.find(
      (item) =>
        item.elementIds.length > 0 &&
        item.elementIds.every((id) => selected.includes(id)) &&
        selected.every((id) => item.elementIds.includes(id)),
    );
    if (!group) {
      return;
    }
    store.dissolveGroup(sceneId, group.id);
  }

  function selectedGroup() {
    const current = scene();
    const ids = store.selectedLayerIds;
    if (!current || ids.length === 0) {
      return undefined;
    }
    return current.groups.find(
      (group) => group.elementIds.length === ids.length && group.elementIds.every((id) => ids.includes(id)),
    );
  }

  function beginRename() {
    const current = scene();
    if (!current) {
      return;
    }
    const group = selectedGroup();
    if (group) {
      renameDraft.value = { kind: 'group', id: group.id, value: group.name, error: null };
      return;
    }
    if (store.selectedLayerIds.length !== 1) {
      return;
    }
    const elementId = store.selectedLayerIds[0]!;
    const element = current.elements.find((item) => item.id === elementId);
    if (!element) {
      return;
    }
    renameDraft.value = { kind: 'element', id: elementId, value: element.name, error: null };
  }

  function setRenameValue(value: string) {
    if (!renameDraft.value) {
      return;
    }
    renameDraft.value = { ...renameDraft.value, value, error: null };
  }

  function cancelRename() {
    renameDraft.value = null;
  }

  function commitRename() {
    const draft = renameDraft.value;
    if (!draft) {
      return;
    }
    const parsed = displayNameSchema.safeParse(draft.value);
    if (!parsed.success) {
      renameDraft.value = { ...draft, error: t('studio.scene.invalidName') };
      return;
    }
    const result =
      draft.kind === 'group'
        ? store.renameGroup(sceneId, draft.id, parsed.data)
        : store.renameLayer(sceneId, draft.id, parsed.data);
    if (!result.ok) {
      renameDraft.value = { ...draft, error: t('studio.scene.invalidName') };
      return;
    }
    renameDraft.value = null;
  }

  function moveSelected(direction: 'up' | 'down' | 'top' | 'bottom') {
    const ids =
      direction === 'up' || direction === 'top' ? [...store.selectedLayerIds].reverse() : [...store.selectedLayerIds];
    for (const elementId of ids) {
      store.moveLayerRelative(sceneId, elementId, direction);
    }
  }

  function groupMemberIds(groupId: GroupId) {
    const current = scene();
    const group = current?.groups.find((item) => item.id === groupId);
    if (!current || !group) {
      return [];
    }
    const index = new Map(current.elements.map((element, position) => [element.id, position]));
    return [...group.elementIds].sort((left, right) => (index.get(left) ?? 0) - (index.get(right) ?? 0));
  }

  function parentGroupId(elementId: ElementId) {
    return scene()?.elements.find((element) => element.id === elementId)?.parentGroupId ?? null;
  }

  function zoneFromEvent(event: DragEvent): SceneDropZone {
    const row = event.currentTarget;
    if (!(row instanceof HTMLElement)) {
      return 'center';
    }
    const rect = row.getBoundingClientRect();
    const ratio = rect.height === 0 ? 0.5 : (event.clientY - rect.top) / rect.height;
    if (ratio < 0.3) {
      return 'before';
    }
    if (ratio > 0.7) {
      return 'after';
    }
    return 'center';
  }

  function writeDragData(event: DragEvent, token: string) {
    if (!event.dataTransfer) {
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-scene-row', token);
    event.dataTransfer.setData('text/plain', token);
  }

  function onDragStartElement(elementId: ElementId, event: DragEvent) {
    ensureActiveScene();
    dragSource.value = { kind: 'element', elementId };
    if (!store.selectedLayerIds.includes(elementId)) {
      store.selectLayer(elementId);
    }
    writeDragData(event, elementId);
  }

  function onDragStartGroup(groupId: GroupId, event: DragEvent) {
    ensureActiveScene();
    dragSource.value = { kind: 'group', groupId };
    const members = groupMemberIds(groupId);
    const selected = store.selectedLayerIds;
    const already =
      members.length > 0 && members.length === selected.length && members.every((id) => selected.includes(id));
    if (!already) {
      selectGroupMembers(groupId);
    }
    writeDragData(event, groupId);
  }

  function onDragEnd() {
    dragSource.value = null;
    dropHint.value = null;
  }

  function onDragOver(target: SceneDropTarget, event: DragEvent) {
    if (!dragSource.value) {
      return;
    }
    dropHint.value = { target, zone: zoneFromEvent(event) };
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function resolveAnchor(target: SceneDropTarget, place: 'before' | 'after') {
    if (target.kind === 'element') {
      return target.elementId;
    }
    const members = groupMemberIds(target.groupId);
    if (members.length === 0) {
      return null;
    }
    return place === 'before' ? members[0]! : members[members.length - 1]!;
  }

  function destinationGroup(target: SceneDropTarget): GroupId | null {
    if (target.kind === 'group') {
      return null;
    }
    return parentGroupId(target.elementId);
  }

  function applyDrop(target: SceneDropTarget, zone: SceneDropZone) {
    const source = dragSource.value;
    if (!source) {
      onDragEnd();
      return;
    }

    if (source.kind === 'group') {
      const members = groupMemberIds(source.groupId);
      if (target.kind === 'group' && target.groupId === source.groupId) {
        onDragEnd();
        return;
      }
      if (target.kind === 'element' && members.includes(target.elementId)) {
        onDragEnd();
        return;
      }
      const place = zone === 'after' ? 'after' : 'before';
      const anchor = resolveAnchor(target, place);
      if (anchor) {
        store.moveElementBlock(sceneId, members, anchor, place);
      }
      onDragEnd();
      return;
    }

    const draggedId = source.elementId;
    if (target.kind === 'element' && target.elementId === draggedId) {
      onDragEnd();
      return;
    }

    if (zone === 'center') {
      if (target.kind === 'group') {
        if (parentGroupId(draggedId) !== target.groupId) {
          store.groupElementsByDrop(sceneId, draggedId, { kind: 'group', groupId: target.groupId });
        }
      } else {
        store.groupElementsByDrop(sceneId, draggedId, { kind: 'element', elementId: target.elementId });
      }
      onDragEnd();
      return;
    }

    const place = zone;
    const draggedParent = parentGroupId(draggedId);
    const nextGroup = destinationGroup(target);

    if (draggedParent !== nextGroup) {
      if (nextGroup) {
        store.addElementToGroup(sceneId, draggedId, nextGroup);
      } else if (draggedParent) {
        store.removeElementsFromGroup(sceneId, [draggedId]);
      }
    }

    const anchor = resolveAnchor(target, place);
    if (anchor && anchor !== draggedId) {
      store.moveElementBlock(sceneId, [draggedId], anchor, place);
    }
    onDragEnd();
  }

  function onDrop(target: SceneDropTarget, event: DragEvent) {
    applyDrop(target, zoneFromEvent(event));
  }

  function dropZoneFor(target: SceneDropTarget): SceneDropZone | null {
    const hint = dropHint.value;
    if (!hint) {
      return null;
    }
    const same =
      hint.target.kind === target.kind &&
      (hint.target.kind === 'element'
        ? target.kind === 'element' && hint.target.elementId === target.elementId
        : target.kind === 'group' && hint.target.groupId === target.groupId);
    return same ? hint.zone : null;
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'F2') {
      event.preventDefault();
      event.stopPropagation();
      beginRename();
      return;
    }
    if (!event.shiftKey || store.selectedLayerIds.length === 0) {
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      moveSelected('up');
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      moveSelected('down');
    }
  }

  return {
    selectionAnchorId,
    dragSource,
    dropHint,
    renameDraft,
    ungroupedSelectedIds,
    isElementSelected,
    handleElementSelect,
    handleRowContextMenu,
    selectGroupMembers,
    deleteSelected,
    groupSelected,
    ungroupSelected,
    dissolveSelectedGroup,
    beginRename,
    setRenameValue,
    cancelRename,
    commitRename,
    moveSelected,
    onDragStartElement,
    onDragStartGroup,
    onDragEnd,
    onDragOver,
    onDrop,
    dropZoneFor,
    handleKeyDown,
  };
}
