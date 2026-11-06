export type BootStepI18nKey = 'studio.boot.session' | 'studio.boot.project' | 'studio.boot.engine';

export function isStudioBootSatisfied(
  isInitialized: () => boolean,
  hasProject: () => boolean,
  isEngineReady: () => boolean,
): boolean {
  return isInitialized() && hasProject() && isEngineReady();
}

export type RunStudioBootOptions = {
  isInitialized: () => boolean;
  hasProject: () => boolean;
  initialize: () => { ok: boolean };
  createProject: (input: { name: string }) => { ok: boolean };
  isEngineReady: () => boolean;
  /** Starts the composition engine; resolves after its first frame. */
  initializeEngine: () => Promise<{ ok: boolean }>;
  onStep: (key: BootStepI18nKey) => void | Promise<void>;
  delay?: (ms: number) => Promise<void>;
  stepPauseMs?: number;
};

const defaultDelay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export async function runStudioBoot(options: RunStudioBootOptions): Promise<{ ok: true } | { ok: false }> {
  const delay = options.delay ?? defaultDelay;
  const pause = options.stepPauseMs ?? 600;

  if (!options.isInitialized()) {
    await options.onStep('studio.boot.session');
    const initialized = options.initialize();
    if (!initialized.ok) {
      return { ok: false };
    }
    await delay(pause);
  }

  if (!options.hasProject()) {
    await options.onStep('studio.boot.project');
    const created = options.createProject({ name: 'MoonBase' });
    if (!created.ok) {
      return { ok: false };
    }
    await delay(pause);
  }

  if (!options.isEngineReady()) {
    await options.onStep('studio.boot.engine');
    const started = await options.initializeEngine();
    if (!started.ok) {
      return { ok: false };
    }
    await delay(pause);
  }

  return { ok: true };
}
