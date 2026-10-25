import { describe, expect, it } from 'vitest';

import { createTestContext } from '../test-utils/studio-session-fixtures';
import { createEmptyStudioSession } from './session';
import { createStudioService } from './studio.service';

describe('createStudioService', () => {
  it('commits session state only after successful commands', () => {
    let session = createEmptyStudioSession();
    const ctx = createTestContext(['p1', 's1', 'h1']);
    const service = createStudioService({
      state: {
        get: () => session,
        set: (next) => {
          session = next;
        },
      },
      context: ctx,
    });

    expect(service.initialize().ok).toBe(true);
    expect(session.isInitialized).toBe(true);

    const failed = service.createScene('Scene');
    expect(failed.ok).toBe(false);

    expect(service.createProject({ name: 'Demo' }).ok).toBe(true);
    expect(session.project?.name).toBe('Demo');
    service.createScene('Scene 1');
    const sceneId = session.project!.scenes[0]!.id;

    const dirtyBefore = session.isDirty;
    expect(service.setActiveScene(sceneId).ok).toBe(true);
    expect(session.isDirty).toBe(dirtyBefore);
  });

  it('records undoable project edits and restores them with undo/redo', () => {
    let session = createEmptyStudioSession();
    const ctx = createTestContext(['p1', 's1', 'h1', 'h2', 'h3', 'h4']);
    const service = createStudioService({
      state: {
        get: () => session,
        set: (next) => {
          session = next;
        },
      },
      context: ctx,
    });

    service.initialize();
    service.createProject({ name: 'Original' });
    service.createScene('Scene 1');
    const sceneId = session.project!.scenes[0]!.id;

    expect(session.project!.history.past).toHaveLength(1);

    expect(service.renameScene(sceneId, 'Renamed').ok).toBe(true);
    expect(session.project!.scenes[0]!.name).toBe('Renamed');
    expect(session.project!.history.past).toHaveLength(2);

    service.undo();
    expect(session.project!.scenes[0]!.name).toBe('Scene 1');
    expect(session.project!.history.future).toHaveLength(1);

    service.redo();
    expect(session.project!.scenes[0]!.name).toBe('Renamed');
    expect(session.project!.history.past).toHaveLength(2);
    expect(session.project!.history.future).toHaveLength(0);
  });

  it('clears redo stack when a new edit happens after undo', () => {
    let session = createEmptyStudioSession();
    const ctx = createTestContext(['p1', 's1', 'h1', 'h2', 'h3', 'h4']);
    const service = createStudioService({
      state: {
        get: () => session,
        set: (next) => {
          session = next;
        },
      },
      context: ctx,
    });

    service.initialize();
    service.createProject({ name: 'Demo' });
    service.createScene('A');
    const sceneId = session.project!.scenes[0]!.id;
    service.renameScene(sceneId, 'B');
    service.undo();
    expect(session.project!.history.future).toHaveLength(1);

    service.renameScene(sceneId, 'C');
    expect(session.project!.history.future).toHaveLength(0);
    expect(session.project!.scenes[0]!.name).toBe('C');
  });

  it('does not record selection changes in history', () => {
    let session = createEmptyStudioSession();
    const ctx = createTestContext(['p1', 's1', 'src1', 'l1', 'h1', 'h2', 'h3']);
    const service = createStudioService({
      state: {
        get: () => session,
        set: (next) => {
          session = next;
        },
      },
      context: ctx,
    });

    service.initialize();
    service.createProject({ name: 'Demo' });
    service.createScene('Scene');
    const pastAfterScene = session.project!.history.past.length;

    service.addSource({ type: 'text', name: 'T', content: 'x' });
    const sceneId = session.project!.scenes[0]!.id;
    const sourceId = session.project!.sources[0]!.id;
    service.addLayer(sceneId, sourceId);
    const layerId = session.project!.scenes[0]!.elements[0]!.id;
    const pastAfterLayer = session.project!.history.past.length;

    service.selectLayer(layerId);
    expect(session.project!.history.past).toHaveLength(pastAfterLayer);
    expect(pastAfterLayer).toBeGreaterThan(pastAfterScene);
  });

  it('collapses transaction steps into one history entry', () => {
    let session = createEmptyStudioSession();
    const ctx = createTestContext(['p1', 's1', 'src1', 'l1', 'h1', 'h2', 'h3']);
    const service = createStudioService({
      state: {
        get: () => session,
        set: (next) => {
          session = next;
        },
      },
      context: ctx,
    });

    service.initialize();
    service.createProject({ name: 'Demo' });
    service.createScene('Scene');
    const pastBefore = session.project!.history.past.length;
    const sceneId = session.project!.scenes[0]!.id;

    service.runTransaction(() => {
      const source = service.addSource({ type: 'text', name: 'Label', content: 'Hi' });
      if (!source.ok) {
        return source;
      }
      const sourceId = session.project!.sources.at(-1)!.id;
      return service.addLayer(sceneId, sourceId);
    });

    expect(session.project!.history.past).toHaveLength(pastBefore + 1);
    expect(session.project!.scenes[0]!.elements).toHaveLength(1);
  });
});
