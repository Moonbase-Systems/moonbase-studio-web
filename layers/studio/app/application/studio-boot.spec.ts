import { describe, expect, it, vi } from 'vitest';

import { isStudioBootSatisfied, runStudioBoot } from './studio-boot';

describe('isStudioBootSatisfied', () => {
  it('is true only when session and project exist', () => {
    expect(
      isStudioBootSatisfied(
        () => false,
        () => false,
      ),
    ).toBe(false);
    expect(
      isStudioBootSatisfied(
        () => true,
        () => false,
      ),
    ).toBe(false);
    expect(
      isStudioBootSatisfied(
        () => false,
        () => true,
      ),
    ).toBe(false);
    expect(
      isStudioBootSatisfied(
        () => true,
        () => true,
      ),
    ).toBe(true);
  });
});

describe('runStudioBoot', () => {
  it('runs session then project in order', async () => {
    const steps: string[] = [];
    let initialized = false;
    let hasProject = false;

    const result = await runStudioBoot({
      isInitialized: () => initialized,
      hasProject: () => hasProject,
      initialize: () => {
        initialized = true;
        return { ok: true };
      },
      createProject: () => {
        hasProject = true;
        return { ok: true };
      },
      onStep: (key) => {
        steps.push(key);
      },
      delay: () => Promise.resolve(),
      stepPauseMs: 0,
    });

    expect(result.ok).toBe(true);
    expect(steps).toEqual(['studio.boot.session', 'studio.boot.project']);
  });

  it('skips steps that are already satisfied', async () => {
    const onStep = vi.fn();

    const result = await runStudioBoot({
      isInitialized: () => true,
      hasProject: () => true,
      initialize: () => ({ ok: false }),
      createProject: () => ({ ok: false }),
      onStep,
      delay: () => Promise.resolve(),
      stepPauseMs: 0,
    });

    expect(result.ok).toBe(true);
    expect(onStep).not.toHaveBeenCalled();
  });

  it('stops on initialize failure', async () => {
    const onStep = vi.fn();

    const result = await runStudioBoot({
      isInitialized: () => false,
      hasProject: () => false,
      initialize: () => ({ ok: false }),
      createProject: () => ({ ok: true }),
      onStep,
      delay: () => Promise.resolve(),
      stepPauseMs: 0,
    });

    expect(result.ok).toBe(false);
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenCalledWith('studio.boot.session');
  });

  it('stops on createProject failure', async () => {
    const steps: string[] = [];

    const result = await runStudioBoot({
      isInitialized: () => true,
      hasProject: () => false,
      initialize: () => ({ ok: true }),
      createProject: () => ({ ok: false }),
      onStep: (key) => {
        steps.push(key);
      },
      delay: () => Promise.resolve(),
      stepPauseMs: 0,
    });

    expect(result.ok).toBe(false);
    expect(steps).toEqual(['studio.boot.project']);
  });
});
