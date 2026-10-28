import type { ElementEffectBase } from './effect-base.domain';

export type OutlineEffectParameters = {
  color: string;
  width: number;
  opacity: number;
};

export type OutlineEffect = ElementEffectBase & {
  type: 'outline';
  parameters: OutlineEffectParameters;
};

export const createDefaultOutlineEffect = (id: string): OutlineEffect => ({
  id,
  name: 'Outline',
  enabled: true,
  type: 'outline',
  parameters: {
    color: '#ffffff',
    width: 2,
    opacity: 1,
  },
});
