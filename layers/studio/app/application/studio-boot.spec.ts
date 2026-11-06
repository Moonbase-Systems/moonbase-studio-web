import { describe, expect, it, vi } from 'vitest';

import { isStudioBootSatisfied, runStudioBoot, type RunStudioBootOptions } from './studio-boot';

const bootOptions = (overrides: Partial<RunStudioBootOptions>): RunStudioBootOptions => ({
  isInitialized: () => true,
  hasProject: () => true,
  initialize: () => ({ ok: true }),
  createProject: () => ({ ok: true }),
  isEngineReady: () => true,
  initializeEngine: () => Promise.resolve({ ok: true }),
  onStep: () => undefined,
  delay: () => Promise.resolve(),
  stepPauseMs: 0,
  ...overrides,
});

describe('isStudioBootSatisfied', () => {
  it('is true only when session, project and engine are ready', () => {
    const yes = () => true;
    const no = () => false;
    expect(isStudioBootSatisfied(no, no, no)).toBe(false);
    expect(isStudioBootSatisfied(yes, no, yes)).toBe(false);
    expect(isStudioBootSatisfied(no, yes, yes)).toBe(false);
    expect(isStudioBootSatisfied(yes, yes, no)).toBe(false);
    expect(isStudioBootSatisfied(yes, yes, yes)).toBe(true);
  });
});

describe('runStudioBoot', () => {
  it('runs session, project, then engine in order', async () => {
    const steps: string[] = [];
    let initialized = false;
    let hasProject = false;
    let engineReady = false;

    const result = await runStudioBoot(
      bootOptions({
        isInitialized: () => initialized,
        hasProject: () => hasProject,
        isEngineReady: () => engineReady,
        initialize: () => {
          initialized = true;
          return { ok: true };
        },
        createProject: () => {
          expect(initialized).toBe(true);
          hasProject = true;
          return { ok: true };
        },
        initializeEngine: () => {
          expect(hasProject).toBe(true);
          engineReady = true;
          return Promise.resolve({ ok: true });
        },
        onStep: (key) => {
          steps.push(key);
        },
      }),
    );

    expect(result.ok).toBe(true);
    expect(steps).toEqual(['studio.boot.session', 'studio.boot.project', 'studio.boot.engine']);
  });

  it('skips steps that are already satisfied', async () => {
    const onStep = vi.fn();
    const initializeEngine = vi.fn(() => Promise.resolve({ ok: false }));

    const result = await runStudioBoot(
      bootOptions({
        initialize: () => ({ ok: false }),
        createProject: () => ({ ok: false }),
        initializeEngine,
        onStep,
      }),
    );

    expect(result.ok).toBe(true);
    expect(onStep).not.toHaveBeenCalled();
    expect(initializeEngine).not.toHaveBeenCalled();
  });

  it('runs only the engine step when the workspace remounts with a live session', async () => {
    const steps: string[] = [];

    const result = await runStudioBoot(
      bootOptions({
        isEngineReady: () => false,
        onStep: (key) => {
          steps.push(key);
        },
      }),
    );

    expect(result.ok).toBe(true);
    expect(steps).toEqual(['studio.boot.engine']);
  });

  it('stops on initialize failure', async () => {
    const onStep = vi.fn();
    const initializeEngine = vi.fn(() => Promise.resolve({ ok: true }));

    const result = await runStudioBoot(
      bootOptions({
        isInitialized: () => false,
        hasProject: () => false,
        isEngineReady: () => false,
        initialize: () => ({ ok: false }),
        initializeEngine,
        onStep,
      }),
    );

    expect(result.ok).toBe(false);
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenCalledWith('studio.boot.session');
    expect(initializeEngine).not.toHaveBeenCalled();
  });

  it('stops on createProject failure', async () => {
    const steps: string[] = [];

    const result = await runStudioBoot(
      bootOptions({
        hasProject: () => false,
        isEngineReady: () => false,
        createProject: () => ({ ok: false }),
        onStep: (key) => {
          steps.push(key);
        },
      }),
    );

    expect(result.ok).toBe(false);
    expect(steps).toEqual(['studio.boot.project']);
  });

  it('stops when the composition engine fails to start', async () => {
    const steps: string[] = [];
    const delay = vi.fn(() => Promise.resolve());

    const result = await runStudioBoot(
      bootOptions({
        isEngineReady: () => false,
        initializeEngine: () => Promise.resolve({ ok: false }),
        onStep: (key) => {
          steps.push(key);
        },
        delay,
      }),
    );

    expect(result.ok).toBe(false);
    expect(steps).toEqual(['studio.boot.engine']);
    expect(delay).not.toHaveBeenCalled();
  });
});
