import type { BootStepI18nKey } from '../../application/studio-boot';

/** Boot stages in the order the progress bar shows them; "opening" is the /app entry cover. */
export const BOOT_STAGES = ['opening', 'session', 'project', 'engine'] as const;

export type BootStage = (typeof BOOT_STAGES)[number];

const STAGE_BY_STEP: Record<BootStepI18nKey, BootStage> = {
  'studio.boot.session': 'session',
  'studio.boot.project': 'project',
  'studio.boot.engine': 'engine',
};

/** Stage for the current boot step; before the first step the studio is still opening. */
export function bootStageForStep(step: BootStepI18nKey | null): BootStage {
  return step ? STAGE_BY_STEP[step] : 'opening';
}
