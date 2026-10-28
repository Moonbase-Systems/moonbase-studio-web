import { describe, expect, it } from 'vitest';

import { createTestContext } from '../test-utils/studio-session-fixtures';
import { pushHistoryEntry } from './commands/history-commands';
import { createScene, renameScene } from './commands/scene-commands';
import { createProject, initializeSession } from './commands/session-commands';
import { captureHistorySnapshot, historySnapshotsEqual } from './history-snapshot';
import { createEmptyStudioSession } from './session';

describe('history-snapshot', () => {
  it('detects scene rename and pushHistoryEntry appends', () => {
    const ctx = createTestContext(['p1', 's1', 'h1', 'h2']);
    const initialized = initializeSession(createEmptyStudioSession());
    expect(initialized.ok).toBe(true);
    if (!initialized.ok) {
      return;
    }
    let session = initialized.value;
    const created = createProject(session, { name: 'Demo' }, ctx);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    session = created.value;
    const sceneAdded = createScene(session, 'Scene 1', ctx);
    expect(sceneAdded.ok).toBe(true);
    if (!sceneAdded.ok) {
      return;
    }
    session = sceneAdded.value;
    const sceneId = session.project!.scenes[0]!.id;

    const before = captureHistorySnapshot(session)!;
    const renamed = renameScene(session, sceneId, 'Renamed', ctx);
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) {
      return;
    }
    session = renamed.value;
    const after = captureHistorySnapshot(session)!;
    expect(historySnapshotsEqual(before, after)).toBe(false);

    const pushed = pushHistoryEntry(
      session,
      {
        id: 'h1',
        label: 'Edit',
        timestamp: ctx.now(),
        patch: { inverse: before, forward: after },
      },
      ctx,
    );
    expect(pushed.ok).toBe(true);
    if (!pushed.ok) {
      return;
    }
    expect(pushed.value.project!.history.past).toHaveLength(1);
  });
});
