import type { FitMode } from '../common.domain';
import type { SourceId } from '../ids.domain';

export type VisualFitSettings = {
  fitMode: FitMode;
  cornerRadius: number;
  maskSourceId: SourceId | null;
};

export const createDefaultVisualFitSettings = (): VisualFitSettings => ({
  fitMode: 'contain',
  cornerRadius: 0,
  maskSourceId: null,
});
