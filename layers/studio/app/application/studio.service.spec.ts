import { describe, expect, it } from 'vitest';

import { createTestContext } from '../test-utils/studio-session-fixtures';
import { createEmptyStudioSession } from './session';
import { createStudioService } from './studio.service';

describe('createStudioService', () => {
  it('commits session state only after successful commands', () => {
    let session = createEmptyStudioSession();
    const ctx = createTestContext(['p1', 's1']);
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

    const dirtyBefore = session.isDirty;
    expect(service.setActiveScene(session.project!.scenes[0]!.id).ok).toBe(true);
    expect(session.isDirty).toBe(dirtyBefore);
  });
});
