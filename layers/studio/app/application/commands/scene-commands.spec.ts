import { describe, expect, it } from 'vitest';

import { createSessionWithProject } from '../../test-utils/studio-session-fixtures';
import { addLayer } from './layer-commands';
import { createScene, deleteScene, duplicateScene, moveSceneRelative, renameScene } from './scene-commands';
import { selectLayer } from './session-commands';
import { addSource } from './source-commands';

describe('scene commands', () => {
  it('creates, renames, duplicates, and deletes scenes', () => {
    const { session: initial, ctx } = createSessionWithProject([
      'p1',
      's1',
      's2',
      'dup-scene',
      'el1',
      'el2',
      'grp1',
      'fx1',
      'src1',
    ]);
    let session = initial;
    const firstSceneId = session.project!.scenes[0]!.id;

    const renamed = renameScene(session, firstSceneId, 'Intro', ctx);
    expect(renamed.ok).toBe(true);
    if (renamed.ok) {
      session = renamed.value;
      expect(session.project?.scenes[0]?.name).toBe('Intro');
      expect(session.isDirty).toBe(true);
    }

    const sourceAdded = addSource(session, { type: 'text', name: 'Label', content: 'A' }, ctx);
    if (sourceAdded.ok) {
      session = sourceAdded.value;
    }
    const sourceId = session.project!.sources[0]!.id;
    const layerAdded = addLayer(session, firstSceneId, sourceId, undefined, ctx);
    if (layerAdded.ok) {
      session = layerAdded.value;
    }

    const duplicated = duplicateScene(session, firstSceneId, ctx);
    expect(duplicated.ok).toBe(true);
    if (duplicated.ok) {
      session = duplicated.value;
      expect(session.project?.scenes).toHaveLength(2);
      const copy = session.project!.scenes[1]!;
      expect(copy.id).not.toBe(firstSceneId);
      expect(copy.name).toBe('Intro copy');
      expect(copy.elements[0]?.id).not.toBe(session.project!.scenes[0]!.elements[0]?.id);
      const originalElement = session.project!.scenes[0]!.elements[0];
      const copiedElement = copy.elements[0];
      expect(originalElement?.type).not.toBe('overlay');
      expect(copiedElement?.type).not.toBe('overlay');
      expect(originalElement).toBeDefined();
      expect(copiedElement).toBeDefined();
      if (originalElement!.type !== 'overlay' && copiedElement!.type !== 'overlay') {
        expect(copiedElement!.sourceId).toBe(originalElement!.sourceId);
      }
      expect(copy.elements[0]?.transform).not.toBe(session.project!.scenes[0]!.elements[0]?.transform);
      expect(session.editor.activeSceneId).toBe(copy.id);
    }

    const created = createScene(session, 'Outro', ctx);
    expect(created.ok).toBe(true);
    if (created.ok) {
      session = created.value;
      expect(session.project?.scenes).toHaveLength(3);
    }

    const activeId = session.editor.activeSceneId!;
    const deleted = deleteScene(session, activeId, ctx);
    expect(deleted.ok).toBe(true);
    if (deleted.ok) {
      session = deleted.value;
      expect(session.project?.scenes.some((scene) => scene.id === activeId)).toBe(false);
      expect(session.editor.selectedElementIds).toEqual([]);
    }
  });

  it('rejects deleting the last scene', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1']);
    const sceneId = session.project!.scenes[0]!.id;
    const before = structuredClone(session);
    const result = deleteScene(session, sceneId, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('rule-violation');
    }
    expect(session).toEqual(before);
  });

  it('clears selection when deleting active scene', () => {
    const { session, ctx } = createSessionWithProject(['p1', 's1', 's2', 'layer1', 'src1']);
    let current = session;
    const source = addSource(current, { type: 'text', name: 'T', content: 'x' }, ctx);
    if (source.ok) {
      current = source.value;
    }
    const scene1 = current.project!.scenes[0]!.id;
    const added = addLayer(current, scene1, current.project!.sources[0]!.id, undefined, ctx);
    if (added.ok) {
      current = added.value;
    }
    const layerId = current.project!.scenes[0]!.elements[0]!.id;
    const selected = selectLayer(current, layerId);
    if (selected.ok) {
      current = selected.value;
    }

    const secondScene = createScene(current, 'B', ctx);
    if (secondScene.ok) {
      current = secondScene.value;
    }

    const active = current.editor.activeSceneId!;
    const deleted = deleteScene(current, active, ctx);
    expect(deleted.ok).toBe(true);
    if (deleted.ok) {
      expect(deleted.value.editor.selectedElementIds).toEqual([]);
      expect(deleted.value.editor.activeSceneId).not.toBe(active);
    }
  });

  it('moves scenes up and down in the list', () => {
    const { session: initial, ctx } = createSessionWithProject(['p1', 's1', 's2']);
    let session = initial;
    const firstId = session.project!.scenes[0]!.id;

    const second = createScene(session, 'Second', ctx);
    expect(second.ok).toBe(true);
    if (second.ok) {
      session = second.value;
    }
    const secondId = session.project!.scenes[1]!.id;

    const movedUp = moveSceneRelative(session, secondId, 'up', ctx);
    expect(movedUp.ok).toBe(true);
    if (movedUp.ok) {
      session = movedUp.value;
      expect(session.project!.scenes.map((scene) => scene.id)).toEqual([secondId, firstId]);
    }

    const movedDown = moveSceneRelative(session, secondId, 'down', ctx);
    expect(movedDown.ok).toBe(true);
    if (movedDown.ok) {
      expect(movedDown.value.project!.scenes.map((scene) => scene.id)).toEqual([firstId, secondId]);
    }
  });
});
