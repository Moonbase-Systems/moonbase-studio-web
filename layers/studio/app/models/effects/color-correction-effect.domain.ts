import type { ElementEffectBase } from './effect-base.domain';

export type ColorCorrectionEffectParameters = {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  gamma: number;
  temperature: number;
};

export type ColorCorrectionEffect = ElementEffectBase & {
  type: 'color-correction';
  parameters: ColorCorrectionEffectParameters;
};

export const createDefaultColorCorrectionEffect = (id: string): ColorCorrectionEffect => ({
  id,
  name: 'Color correction',
  enabled: true,
  type: 'color-correction',
  parameters: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    gamma: 1,
    temperature: 0,
  },
});
