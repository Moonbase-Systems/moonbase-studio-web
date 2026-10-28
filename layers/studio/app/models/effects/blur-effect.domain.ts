import type { ElementEffectBase } from './effect-base.domain';

export type BlurEffectParameters = {
  radius: number;
};

export type BlurEffect = ElementEffectBase & {
  type: 'blur';
  parameters: BlurEffectParameters;
};

export const createDefaultBlurEffect = (id: string): BlurEffect => ({
  id,
  name: 'Blur',
  enabled: true,
  type: 'blur',
  parameters: { radius: 4 },
});
