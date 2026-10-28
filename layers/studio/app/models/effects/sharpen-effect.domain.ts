import type { ElementEffectBase } from './effect-base.domain';

export type SharpenEffectParameters = {
  strength: number;
};

export type SharpenEffect = ElementEffectBase & {
  type: 'sharpen';
  parameters: SharpenEffectParameters;
};

export const createDefaultSharpenEffect = (id: string): SharpenEffect => ({
  id,
  name: 'Sharpen',
  enabled: true,
  type: 'sharpen',
  parameters: { strength: 0.5 },
});
