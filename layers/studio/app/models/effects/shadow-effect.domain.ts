import type { ElementEffectBase } from './effect-base.domain';

export type ShadowEffectParameters = {
  color: string;
  offsetX: number;
  offsetY: number;
  blur: number;
  opacity: number;
};

export type ShadowEffect = ElementEffectBase & {
  type: 'shadow';
  parameters: ShadowEffectParameters;
};

export const createDefaultShadowEffect = (id: string): ShadowEffect => ({
  id,
  name: 'Shadow',
  enabled: true,
  type: 'shadow',
  parameters: {
    color: '#000000',
    offsetX: 4,
    offsetY: 4,
    blur: 8,
    opacity: 0.5,
  },
});
