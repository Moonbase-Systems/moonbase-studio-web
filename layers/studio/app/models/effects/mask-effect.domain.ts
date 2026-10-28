import type { SourceId } from '../ids.domain';
import type { ElementEffectBase } from './effect-base.domain';

export type MaskEffectMode = 'alpha' | 'luminance';

export type MaskEffectParameters = {
  sourceId: SourceId;
  mode: MaskEffectMode;
  inverted: boolean;
};

export type MaskEffect = ElementEffectBase & {
  type: 'mask';
  parameters: MaskEffectParameters;
};
