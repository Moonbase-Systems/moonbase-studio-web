import { describe, expect, it } from 'vitest';

import { createValidProject } from '../../test-utils/project-fixtures';
import {
  createInitializedSession,
  createSessionWithProject,
  createTestContext,
} from '../../test-utils/studio-session-fixtures';
import { createEmptyStudioSession } from '../session';
import { addLayer } from './layer-commands';
import { createScene } from './scene-commands';
import {
  clearSelection,
  closeProject,
  createProject,
  initializeSession,
  openProject,
  selectLayer,
  setActiveScene,
} from './session-commands';
import { addSource } from './source-commands';

describe('session commands', () => {
  it('requires initialization before project operations', () => {
    const session = createEmptyStudioSession();
    const result = createProject(session, undefined, createTestContext(['p1', 's1']));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid-state');
    }
  });

  it('creates, opens, and closes a project', () => {
    const ctx = createTestContext(['project-1']);
    let session = createInitializedSession();

    const created = createProject(session, { name: 'My Project' }, ctx);
    expect(created.ok).toBe(true);
    if (created.ok) {
      session = created.value;
      expect(session.project?.name).toBe('My Project');
      expect(session.project?.scenes).toEqual([]);
      expect(session.isDirty).toBe(false);
      expect(session.editor.activeSceneId).toBeNull();
    }

    const closed = closeProject(session);
    expect(closed.ok).toBe(true);
    if (closed.ok) {
      expect(closed.value.project).toBeNull();
      expect(closed.value.editor.activeSceneId).toBeNull();
    }

    const opened = openProject(createInitializedSession(), createValidProject(), ctx);
    expect(opened.ok).toBe(true);
    if (opened.ok) {
      expect(opened.value.isDirty).toBe(false);
      expect(opened.value.project?.scenes[0]?.id).toBeTruthy();
    }
  });

  it('rejects invalid project on open without mutating session', () => {
    const session = createInitializedSession();
    const invalid = { ...createValidProject(), name: '' };
    const before = structuredClone(session);
    const result = openProject(session, invalid, createTestContext([]));
    expect(result.ok).toBe(false);
    expect(session).toEqual(before);
  });

  it('does not mark dirty when changing selection or active scene', () => {
    const { session: initial, ctx } = createSessionWithProject(['p1', 's1', 's2', 's3', 'src1', 'layer1']);
    let session = initial;

    const source = addSource(session, { type: 'text', name: 'Title', content: 'Hello' }, ctx);
    expect(source.ok).toBe(true);
    if (source.ok) {
      session = source.value;
    }

    const scene2 = createScene(session, 'Scene 2', ctx);
    expect(scene2.ok).toBe(true);
    if (scene2.ok) {
      session = scene2.value;
    }

    const sourceId = session.project!.sources[0]!.id;
    const activeSceneId = session.editor.activeSceneId!;
    const added = addLayer(session, activeSceneId, sourceId, undefined, ctx);
    expect(added.ok).toBe(true);
    if (added.ok) {
      session = added.value;
      expect(session.isDirty).toBe(true);
    }

    const dirtySnapshot = structuredClone(session);
    const switched = setActiveScene(session, session.project!.scenes[0]!.id);
    expect(switched.ok).toBe(true);
    if (switched.ok) {
      expect(switched.value.isDirty).toBe(dirtySnapshot.isDirty);
    }

    session = switched.ok ? switched.value : session;
    const layerOnFirstScene = session.project!.scenes[0]!.elements[0];
    if (layerOnFirstScene) {
      const activeFirst = setActiveScene(session, session.project!.scenes[0]!.id);
      if (activeFirst.ok) {
        session = activeFirst.value;
      }
      const selected = selectLayer(session, layerOnFirstScene.id);
      expect(selected.ok).toBe(true);
      if (selected.ok) {
        expect(selected.value.isDirty).toBe(dirtySnapshot.isDirty);
      }
      session = selected.ok ? selected.value : session;
    }

    const cleared = clearSelection(session);
    expect(cleared.ok).toBe(true);
    if (cleared.ok) {
      expect(cleared.value.isDirty).toBe(dirtySnapshot.isDirty);
    }
  });

  it('returns no-project when selecting without an open project', () => {
    let session = createInitializedSession();
    const created = createProject(session, undefined, createTestContext(['p1', 's1']));
    if (created.ok) {
      session = created.value;
    }
    const closed = closeProject(session);
    if (closed.ok) {
      session = closed.value;
    }
    const result = selectLayer(session, 'missing');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('no-project');
    }
  });
});

describe('initializeSession', () => {
  it('sets isInitialized', () => {
    const result = initializeSession(createEmptyStudioSession());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.isInitialized).toBe(true);
    }
  });
});
