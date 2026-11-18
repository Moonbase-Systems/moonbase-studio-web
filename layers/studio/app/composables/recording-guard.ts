import type { InjectionKey } from 'vue';

export type RecordingGuard = {
  /** Asks before a change that would alter the active scene during a recording. */
  allowActiveSceneChange: () => Promise<boolean>;
};

export const STUDIO_RECORDING_GUARD: InjectionKey<RecordingGuard> = Symbol('studio-recording-guard');
